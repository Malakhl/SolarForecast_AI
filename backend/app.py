"""
☀️ SolarForecast AI — Flask Backend API
==============================================
Pipeline identique au notebook SolarForecast_AI.ipynb :
  - Nettoyage (NaN, valeurs négatives, outliers IQR)
  - Feature Engineering complet (lags, rolling, cycliques, interactions)
  - Imputation (médiane) + StandardScaler (fittés sur le train, chargés depuis disque)
  - Prédiction multi-horizon : H+1 (Random Forest), H+6 (XGBoost), H+24 (LightGBM)
  - Les modèles prédisent log1p(pv_production) → np.expm1() appliqué en sortie

Endpoints :
  POST /api/predict     — Upload CSV brut (colonnes météo) → prédictions JSON (H1, H6, H24)
  GET  /api/health      — Statut des modèles
  GET  /api/model-info  — Métadonnées des modèles (features, importances)
"""

import io
import os
import numpy as np
import pandas as pd
import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_last_96h, insert_solar_data
# ══════════════════════════════════════════════════════════════
# APP INIT
# ══════════════════════════════════════════════════════════════
app = Flask(__name__)
CORS(app)  # autorise les requêtes depuis le frontend React

# ══════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════
# Tous les fichiers modèles sont placés dans le même dossier que app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_FILES = {
    "H1":  os.path.join(BASE_DIR, "model_H1_XGBoost.pkl"),
    "H6":  os.path.join(BASE_DIR, "model_H6_Random_Forest.pkl"),   # ⬅️ changé (était LightGBM)
    "H24": os.path.join(BASE_DIR, "model_H24_Random_Forest.pkl"),
}
SCALER_PATH   = os.path.join(BASE_DIR, "scaler.pkl")
IMPUTER_PATH  = os.path.join(BASE_DIR, "imputer.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "feature_cols.pkl")

HORIZON_LABELS = {
    "H1":  {"name": "XGBoost",       "hours": 1},
    "H6":  {"name": "Random Forest", "hours": 6},    # ⬅️ changé (était LightGBM)
    "H24": {"name": "Random Forest", "hours": 24},
}
FEATURE_COLS_PATHS = {
    "H1":  os.path.join(BASE_DIR, "feature_cols_H1.pkl"),
    "H6":  os.path.join(BASE_DIR, "feature_cols_H6.pkl"),
    "H24": os.path.join(BASE_DIR, "feature_cols_H24.pkl"),
}
REQUIRED_RAW_COLS = ["datetime", "temperature", "humidity", "solar_irradiance", "atm_irradiance"]
PV_CAPACITY_W = 4500.0   # ✅ FIX #2 — unité correcte : Watts (max train = 4500 W)
# ══════════════════════════════════════════════════════════════
# CHARGEMENT DES MODÈLES & OBJETS DE PRÉTRAITEMENT
# ══════════════════════════════════════════════════════════════
models = {}
scaler = None
imputer = None
FEATURE_COLS = None
MODEL_LOADED = False
FEATURE_COLS_BY_HORIZON = {}
try:
    for h_key, path in MODEL_FILES.items():
        models[h_key] = joblib.load(path)
    for h_key, path in FEATURE_COLS_PATHS.items():
        FEATURE_COLS_BY_HORIZON[h_key] = joblib.load(path)
    scaler  = joblib.load(SCALER_PATH)
    imputer = joblib.load(IMPUTER_PATH)
    FEATURE_COLS = joblib.load(FEATURES_PATH)

    MODEL_LOADED = True
    print(f"[✅] 3 modèles chargés — base 48 features, "
          f"H1={len(FEATURE_COLS_BY_HORIZON['H1'])}, "
          f"H6={len(FEATURE_COLS_BY_HORIZON['H6'])}, "
          f"H24={len(FEATURE_COLS_BY_HORIZON['H24'])}")
except FileNotFoundError as e:
    MODEL_LOADED = False
    print(f"[⚠️] Fichier manquant dans '{BASE_DIR}' — mode démo actif. Détail : {e}")


# ══════════════════════════════════════════════════════════════
# FEATURE ENGINEERING — IDENTIQUE AU NOTEBOOK (Section 4 & 5)
# ══════════════════════════════════════════════════════════════
def clean_raw_data(df: pd.DataFrame) -> pd.DataFrame:
    """Reproduit la Section 4 — Data Cleaning du notebook."""
    df = df.copy()

    # Tri chronologique
    df.sort_values("datetime", inplace=True)
    df.drop_duplicates(subset="datetime", inplace=True)
    df.reset_index(drop=True, inplace=True)
    if "humidity" in df.columns and df["humidity"].max() > 1.0:
        df["humidity"] = df["humidity"] / 100.0
    # Interpolation temporelle des NaN sur les colonnes météo
    numeric_cols = ["temperature", "humidity", "solar_irradiance", "atm_irradiance"]
    df = df.set_index("datetime")
    for col in numeric_cols:
        if col in df.columns and df[col].isnull().any():
            df[col] = df[col].interpolate(method="time")
    df = df.reset_index()

    # Contraintes physiques : pas de valeurs négatives
    for col in ["solar_irradiance", "atm_irradiance"]:
        if col in df.columns:
            df[col] = df[col].clip(lower=0)

    # Pas de suppression d'outliers IQR ici : on garde toutes les lignes
    # envoyées par le client (l'API doit répondre pour chaque ligne fournie).

    return df


def add_features(df_clean: pd.DataFrame) -> pd.DataFrame:
    import numpy as np
    df_clean = df_clean.sort_values("datetime").reset_index(drop=True)

    if len(df_clean) < 60:
       raise ValueError("Not enough continuous history for feature engineering")
    df_feat = df_clean.copy()

    # ── 1. Variables temporelles ─────────────────────────────
    df_feat['hour'] = df_feat['datetime'].dt.hour
    df_feat['day'] = df_feat['datetime'].dt.dayofyear
    df_feat['month'] = df_feat['datetime'].dt.month
    df_feat['weekday'] = df_feat['datetime'].dt.dayofweek

    season_map = {'winter': 0, 'spring': 1, 'summer': 2, 'autumn': 3}
    if 'season' in df_feat.columns:
        df_feat['season_num'] = df_feat['season'].map(season_map)
    else:
        # df_feat['season_num'] = 0  # fallback باش ما يطيحش
         df_feat['season_num'] = df_feat['month'].map({
            12:0,1:0,2:0,
            3:1,4:1,5:1,
            6:2,7:2,8:2,
            9:3,10:3,11:3
        })
    # ── 2. Lags ───────────────────────────────────────────────
    for lag in [1, 6, 24]:
        df_feat[f'lag_{lag}'] = df_feat['pv_production'].shift(lag)

    # extra lags (important H24)
    for lag in [12, 48]:
        df_feat[f'lag_{lag}'] = df_feat['pv_production'].shift(lag)

    # ── 3. Rolling ────────────────────────────────────────────
    df_feat['rolling_mean_6'] = df_feat['pv_production'].shift(1).rolling(6, min_periods=1).mean()
    df_feat['rolling_mean_24'] = df_feat['pv_production'].shift(1).rolling(24, min_periods=1).mean()
    df_feat['rolling_std_6'] = df_feat['pv_production'].shift(1).rolling(6, min_periods=1).std().fillna(0)

    # ── 4. Cyclical encoding ─────────────────────────────────
    df_feat['sin_hour'] = np.sin(2*np.pi*df_feat['hour']/24)
    df_feat['cos_hour'] = np.cos(2*np.pi*df_feat['hour']/24)

    df_feat['sin_month'] = np.sin(2*np.pi*df_feat['month']/12)
    df_feat['cos_month'] = np.cos(2*np.pi*df_feat['month']/12)

    df_feat['sin_day'] = np.sin(2*np.pi*df_feat['day']/365)
    df_feat['cos_day'] = np.cos(2*np.pi*df_feat['day']/365)

    # ── 5. Weather diffs ─────────────────────────────────────
    df_feat['irradiance_change_1h'] = df_feat['solar_irradiance'].diff(1)
    df_feat['irradiance_change_6h'] = df_feat['solar_irradiance'].diff(6)

    df_feat['temp_change_1h'] = df_feat['temperature'].diff(1)
    df_feat['humidity_change_1h'] = df_feat['humidity'].diff(1)

    # ── 6. Interactions ──────────────────────────────────────
    df_feat['temp_anomaly'] = df_feat['temperature'] - df_feat['temperature'].rolling(6).mean()
    df_feat['irradiance_roll_3h'] = df_feat['solar_irradiance'].shift(1).rolling(3).mean()

    # ── 7. Day / Night ───────────────────────────────────────
    df_feat['is_daylight'] = df_feat['hour'].between(6, 18).astype(int)
    day_only = df_feat['pv_production'].copy()

    day_only[df_feat['is_daylight'] == 0] = np.nan
    df_feat['rolling_day_6'] = day_only.shift(1).rolling(6, min_periods=1).mean()
    df_feat['rolling_day_24'] = day_only.shift(1).rolling(24, min_periods=1).mean()

    # ── 8. Rolling stats avancées ────────────────────────────
    shifted = df_feat['pv_production'].shift(1)

    for w in [3, 6, 12, 24]:
        df_feat[f'rolling_max_{w}'] = shifted.rolling(w, min_periods=1).max()
        df_feat[f'rolling_min_{w}'] = shifted.rolling(w, min_periods=1).min()
        df_feat[f'rolling_std_{w}'] = shifted.rolling(w, min_periods=1).std().fillna(0)

    # ── 9. Irradiance normalization ─────────────────────────
    daily_max_irr = df_feat.groupby(df_feat['datetime'].dt.date)['solar_irradiance'].transform('max')
    df_feat['irradiance_ratio_daily'] = df_feat['solar_irradiance'] / (daily_max_irr + 1e-6)

    df_feat['irr_temp_interact'] = df_feat['solar_irradiance'] * df_feat['temperature']
    # ── 9.b Clear Sky Index ──────────────────────────────────
    df_feat['CSI'] = df_feat['solar_irradiance'] / (df_feat['atm_irradiance'] + 1e-6)
    # ── 10. Irradiance lags ──────────────────────────────────
    for lag in [1, 6, 12, 24]:
        df_feat[f'irr_lag_{lag}'] = df_feat['solar_irradiance'].shift(lag)

    df_feat['irr_rolling_max_6'] = df_feat['solar_irradiance'].shift(1).rolling(6, min_periods=1).max()
    df_feat['irr_rolling_max_24'] = df_feat['solar_irradiance'].shift(1).rolling(24, min_periods=1).max()

    # ── 11. Solar hour ───────────────────────────────────────
    df_feat['solar_hour_sin'] = np.where(
        df_feat['hour'].between(5, 20),
        np.sin(np.pi * (df_feat['hour'] - 5) / 15),
        0
    )

    # ── 12. IMPORTANT: drop NaN (same as notebook) ───────────
    # df_feat.dropna(inplace=True)
    # ── 12. IMPORTANT: drop NaN — identique au notebook Section 5 ───────────
    # ── 12. Nettoyage NaN/Inf ────────────────────────────────────────────────
    df_feat = df_feat.replace([np.inf, -np.inf], np.nan)

    # ✅ CORRECTION — dropna uniquement sur les colonnes utilisées par le modèle
    # lag_48 est dans df_feat mais l'imputer gère ses NaN en inférence
    # On drop uniquement si les features CRITIQUES sont manquantes (lag_1, lag_6, lag_24)
    critical_cols = [c for c in ['lag_1', 'lag_6', 'lag_24',
                                  'rolling_mean_6', 'rolling_mean_24',
                                  'irradiance_change_1h', 'irradiance_change_6h',
                                  'temp_anomaly', 'irradiance_roll_3h'] if c in df_feat.columns]

    df_feat.dropna(subset=critical_cols, inplace=True)

    if df_feat.shape[0] == 0:
        raise ValueError(
            "All rows dropped after NaN cleaning. "
            "Send at least 30h of continuous history data."
        )

    df_feat.reset_index(drop=True, inplace=True)

    return df_feat

def preprocess_csv(df_raw: pd.DataFrame) -> tuple:
    import numpy as np
    import pandas as pd

    warnings_list = []
    df = df_raw.copy()

    # ── 0. datetime parsing + SORT (IMPORTANT FIX) ─────────────
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values("datetime").reset_index(drop=True)

    # ── 1. check required columns ──────────────────────────────
    missing_raw = [c for c in REQUIRED_RAW_COLS if c not in df.columns]
    if missing_raw:
        raise ValueError(f"Colonnes manquantes dans le CSV : {missing_raw}")

    if "pv_production" not in df.columns:
        warnings_list.append(
            "pv_production missing → lag/rolling will be imputed"
        )

    # ── 2. CLEANING ────────────────────────────────────────────
    df_clean = clean_raw_data(df)

    # ── 3. FEATURE ENGINEERING ────────────────────────────────
    df_feat = add_features(df_clean)
    if df_feat.shape[0] == 0:
        raise ValueError(
            f"No rows after feature engineering. "
            f"Try sending more history data (min 48-72h)."
        )

    # ── 4. ALIGN FEATURES STRICTLY (CRITICAL PART) ─────────────
    X = df_feat.reindex(columns=FEATURE_COLS).copy()

    # ── 5. FORCE numeric + clean NaN/Inf ───────────────────────
    X = X.apply(pd.to_numeric, errors="coerce")
    X.replace([np.inf, -np.inf], np.nan, inplace=True)
    X = X.clip(-1e5, 1e5)

    # ── 6. IMPUTE + SCALE ──────────────────────────────────────
    X_clean = imputer.transform(X)
    X_scaled = scaler.transform(X_clean)

    X_scaled = np.array(X_scaled)
   
    # ── 7. DEBUG SAFE (no mismatch anymore) ────────────────────
    print("FEATURES EXPECTED:", len(FEATURE_COLS))
    print("FEATURES USED:", X.shape[1])
    print("MATCH:", list(X.columns) == FEATURE_COLS)

    df_feat.reset_index(drop=True, inplace=True)
    X_scaled = np.array(X_scaled)  # aligné avec df_feat row-for-row
    return X_scaled, df_feat, warnings_list


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

# ── GET /api/health ──────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    payload = {
        "status": "ok",
        "models_loaded": MODEL_LOADED,
        "horizons": list(MODEL_FILES.keys()) if MODEL_LOADED else [],
        "n_features": len(FEATURE_COLS) if MODEL_LOADED else None,
    }
    return jsonify(payload), 200


# ── GET /api/model-info ──────────────────────────────────────────────────
@app.route("/api/model-info", methods=["GET"])
def model_info():
    if not MODEL_LOADED:
        return jsonify({"error": "Modèles non chargés"}), 503

    info = {}
    for h_key, model in models.items():
        entry = {
            "model_name": HORIZON_LABELS[h_key]["name"],
            "horizon_hours": HORIZON_LABELS[h_key]["hours"],
            "model_type": type(model).__name__,
        }
        if hasattr(model, "feature_importances_"):
            pairs = sorted(
                zip(FEATURE_COLS, model.feature_importances_),
                key=lambda x: x[1],
                reverse=True,
            )
            entry["top_features"] = [
                {"feature": f, "importance": round(float(imp), 6)}
                for f, imp in pairs[:15]
            ]
        info[h_key] = entry

    return jsonify({
        "n_features": len(FEATURE_COLS),
        "feature_names": FEATURE_COLS,
        "models": info,
    }), 200

@app.route("/api/insert", methods=["POST"])
def insert():
    file = request.files["file"]
    df = pd.read_csv(file)

    insert_solar_data(df)

    return jsonify({"success": True})
# ── POST /api/predict ─────────────────────────────────────────────────────


@app.route("/api/predict", methods=["POST"])
def predict():

    # ── 1. Récupération du fichier ─────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu. Envoyez un champ 'file'."}), 400

    file = request.files["file"]

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Seuls les fichiers .csv sont acceptés."}), 400

    # ── 2. Lecture CSV ─────────────────────────────────────────
    try:
        df_raw = pd.read_csv(io.BytesIO(file.read()))
    except Exception as e:
        return jsonify({"error": f"Impossible de lire le CSV : {str(e)}"}), 422

    if df_raw.empty:
        return jsonify({"error": "Le CSV est vide."}), 422

    if not MODEL_LOADED:
        return jsonify({
            "error": "Modèles non chargés"
        }), 503

    # ── 🔥 3. BUFFER SYSTEM (DB HISTORY) ────────────────────────
    # ── 🔥 3. BUFFER SYSTEM (DB HISTORY) ────────────────────────
    try:
        history = get_last_96h()
        history = history.sort_values("datetime")
        history = history.drop_duplicates("datetime")
        # datetime conversion
        history["datetime"] = pd.to_datetime(history["datetime"])
        df_raw["datetime"] = pd.to_datetime(df_raw["datetime"])

        # ❌ REMOVE DUPLICATES / OVERLAP
        history = history[~history["datetime"].isin(df_raw["datetime"])]

        # 🔥 CONCAT CLEANLY
        full_df = pd.concat([history, df_raw], ignore_index=True)
        full_df = full_df.sort_values("datetime").reset_index(drop=True)

    except Exception as e:
        return jsonify({"error": f"DB error: {str(e)}"}), 500
    if len(full_df) < 72:
        return jsonify({
            "error": (
                f"Not enough data: got {len(full_df)} rows, need at least 72. "
                f"History in DB: {len(history)} rows, input: {len(df_raw)} rows. "
                f"lag_48 requires 48h of warmup before predictions are valid."
            )
        }), 400
    # ── 4. FEATURE ENGINEERING ────────────────────────────────
    try:
        X_scaled, df_feat, warnings_list = preprocess_csv(full_df)
    except Exception as e:
        return jsonify({"error": f"Preprocessing error: {str(e)}"}), 500

    # ── 5. KEEP ONLY USER ROWS (IMPORTANT 🔥) ────────────────
    n_user = len(df_raw)
    X_scaled = X_scaled[-n_user:]
    df_feat = df_feat.iloc[-n_user:].reset_index(drop=True)
    
    # ── 6. PREDICTION ─────────────────────────────────────────

    try:
            # ✅ FIX #4 — unité correcte : le modèle prédit des Watts (entraîné sur W)
            PV_CAPACITY_W = 4500.0   # capacité du site d'ENTRAÎNEMENT (référence)
            results_per_horizon = {}
            base_datetimes = pd.to_datetime(df_feat["datetime"].values[-n_user:])

            # ✅ FIX #6 — CALIBRATION PAR CAPACITÉ DE SITE
            # full_df contient history (96h) + df_raw (n_user lignes) → estimation robuste
            TRAIN_CAPACITY_W = 4500.0
            site_capacity_w = full_df['pv_production'].quantile(0.99)

            MIN_VALID_CAPACITY_W = 50.0
            # ✅ Zone morte : on ne corrige que si l'écart est net (>20%)
            SCALE_TOLERANCE = 0.20

            if pd.isna(site_capacity_w) or site_capacity_w < MIN_VALID_CAPACITY_W:
                scale_factor = 1.0
                site_capacity_w = TRAIN_CAPACITY_W
            else:
                raw_ratio = site_capacity_w / TRAIN_CAPACITY_W
                if abs(raw_ratio - 1.0) <= SCALE_TOLERANCE:
                    # écart probablement dû au bruit d'estimation sur fenêtre courte → ignorer
                    scale_factor = 1.0
                    site_capacity_w = TRAIN_CAPACITY_W  # garde le clip à la capacité train par défaut
                else:
                    scale_factor = raw_ratio

            warnings_list.append(
                f"Site capacity estimated at {site_capacity_w:.1f} W "
                f"(scale_factor={scale_factor:.3f} vs train capacity {TRAIN_CAPACITY_W:.0f} W)"
            )

            # X_scaled est dans l'ordre de FEATURE_COLS (les 48) → on le remet en DataFrame
            X_scaled_df = pd.DataFrame(X_scaled, columns=FEATURE_COLS)

            for h_key, model in models.items():
                horizon_cols = FEATURE_COLS_BY_HORIZON[h_key]
                X_h = X_scaled_df[horizon_cols].values   # ⬅️ sous-ensemble propre au modèle

                pred_log = model.predict(X_h)
                pred_w = np.expm1(pred_log)

                # ✅ Calibration capacité (corrige le facteur ×2 à ×4 observé sur sites plus petits)
                pred_w = pred_w * scale_factor

                pred_w = np.clip(pred_w, 0, site_capacity_w)

                horizon_h = HORIZON_LABELS[h_key]["hours"]
                future_times = base_datetimes + pd.Timedelta(hours=horizon_h)
                future_hours = future_times.hour
                night_mask = (future_hours <= 5) | (future_hours >= 20)
                pred_w[night_mask] = 0.0

                results_per_horizon[h_key] = pred_w

    except Exception as e:
            return jsonify({"error": f"Erreur prediction: {str(e)}"}), 500
    # ── 7. BUILD RESPONSE ─────────────────────────────────────
    datetimes = df_feat["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()

    predictions = []
    for i in range(n_user):
        row = {
            "index": i,
            "datetime": datetimes[i],
        }

        for h_key in models.keys():
            val_w = float(results_per_horizon[h_key][i])
            # ✅ FIX #5 — exposer en W ET en kW pour la lisibilité
            row[f"pred_{h_key}_W"]  = round(val_w, 2)
            row[f"pred_{h_key}_kW"] = round(val_w / 1000.0, 4)

        predictions.append(row)

    # ── 8. KPIs ───────────────────────────────────────────────
    kpis = {}
    for h_key in models.keys():
        arr = results_per_horizon[h_key]
        kpis[h_key] = {
            "model": HORIZON_LABELS[h_key]["name"],
            "horizon_hours": HORIZON_LABELS[h_key]["hours"],
            "unit": "W",                                   # ✅ unité explicite
            "avg_W":  round(float(arr.mean()), 2),
            "max_W":  round(float(arr.max()),  2),
            "min_W":  round(float(arr.min()),  2),
            "avg_kW": round(float(arr.mean()) / 1000.0, 4),
            "max_kW": round(float(arr.max())  / 1000.0, 4),
        }

    # ── 9. RESPONSE ───────────────────────────────────────────
    return jsonify({
        "success": True,
        "warnings": warnings_list,
        "n_user_rows": n_user,
        "used_history_rows": len(history),
        "predictions": predictions,
        "kpis": kpis
    }), 200

# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
# """
# ☀️ SolarForecast AI — Flask Backend API (VERSION CORRIGÉE)
# ==============================================
# CORRECTIONS APPLIQUÉES :
#   [FIX-A] Night mask H6 étendu : irradiance_current == 0 → pred = 0 (phantom nuit 00h-05h)
#   [FIX-B] Night mask H24 boundary corrigé : >=19 au lieu de >=20 (phantom sunset 19h)
#   [FIX-C] Night mask robuste : basé sur irradiance_future ET heure_future ET heure_courante
#   [FIX-D] Post-processing peak correction H6 : si irr_actuelle > 50 ET pred_H6 < 0.05*irr_ratio → clamp
#   [FIX-E] Post-processing morning correction H6 : si heure ∈ [6-10] ET lag_6 ≈ 0 → scale par irradiance ratio
# """

# import io
# import os
# import numpy as np
# import pandas as pd
# import joblib
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# from db import get_last_96h, insert_solar_data

# app = Flask(__name__)
# CORS(app)

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# MODEL_FILES = {
#     "H1":  os.path.join(BASE_DIR, "model_H1_XGBoost.pkl"),
#     "H6":  os.path.join(BASE_DIR, "model_H6_LightGBM.pkl"),
#     "H24": os.path.join(BASE_DIR, "model_H24_Random_Forest.pkl"),
# }
# SCALER_PATH   = os.path.join(BASE_DIR, "scaler.pkl")
# IMPUTER_PATH  = os.path.join(BASE_DIR, "imputer.pkl")
# FEATURES_PATH = os.path.join(BASE_DIR, "feature_cols.pkl")

# HORIZON_LABELS = {
#     "H1":  {"name": "XGBoost",       "hours": 1},
#     "H6":  {"name": "LightGBM",      "hours": 6},
#     "H24": {"name": "Random Forest", "hours": 24},
# }

# REQUIRED_RAW_COLS = ["datetime", "temperature", "humidity", "solar_irradiance", "atm_irradiance"]
# PV_CAPACITY_W      = 4500.0
# # Facteur linéaire calibré : max_pv_observed / max_irr_observed sur données train
# # Représente le rendement global du système : ~1.136 W produit par W/m² d'irradiance
# # À recalculer si la capacité ou la localisation change
# SOLAR_LINEAR_FACTOR = 1.136

# models = {}
# scaler = None
# imputer = None
# FEATURE_COLS = None
# MODEL_LOADED = False

# try:
#     for h_key, path in MODEL_FILES.items():
#         models[h_key] = joblib.load(path)
#     scaler  = joblib.load(SCALER_PATH)
#     imputer = joblib.load(IMPUTER_PATH)
#     FEATURE_COLS = joblib.load(FEATURES_PATH)
#     MODEL_LOADED = True
#     print(f"[✅] 3 modèles chargés (H1/H6/H24) — {len(FEATURE_COLS)} features attendues")
# except FileNotFoundError as e:
#     MODEL_LOADED = False
#     print(f"[⚠️] Fichier manquant dans '{BASE_DIR}' — mode démo actif. Détail : {e}")


# # ══════════════════════════════════════════════════════════════
# # FEATURE ENGINEERING — IDENTIQUE AU NOTEBOOK
# # ══════════════════════════════════════════════════════════════
# def clean_raw_data(df: pd.DataFrame) -> pd.DataFrame:
#     df = df.copy()
#     df.sort_values("datetime", inplace=True)
#     df.drop_duplicates(subset="datetime", inplace=True)
#     df.reset_index(drop=True, inplace=True)
#     if "humidity" in df.columns and df["humidity"].max() > 1.0:
#         df["humidity"] = df["humidity"] / 100.0
#     numeric_cols = ["temperature", "humidity", "solar_irradiance", "atm_irradiance"]
#     df = df.set_index("datetime")
#     for col in numeric_cols:
#         if col in df.columns and df[col].isnull().any():
#             df[col] = df[col].interpolate(method="time")
#     df = df.reset_index()
#     for col in ["solar_irradiance", "atm_irradiance"]:
#         if col in df.columns:
#             df[col] = df[col].clip(lower=0)
#     return df


# def add_features(df_clean: pd.DataFrame) -> pd.DataFrame:
#     df_clean = df_clean.sort_values("datetime").reset_index(drop=True)
#     if len(df_clean) < 60:
#         raise ValueError("Not enough continuous history for feature engineering")
#     df_feat = df_clean.copy()

#     df_feat['hour']    = df_feat['datetime'].dt.hour
#     df_feat['day']     = df_feat['datetime'].dt.dayofyear
#     df_feat['month']   = df_feat['datetime'].dt.month
#     df_feat['weekday'] = df_feat['datetime'].dt.dayofweek

#     season_map = {'winter': 0, 'spring': 1, 'summer': 2, 'autumn': 3}
#     if 'season' in df_feat.columns:
#         df_feat['season_num'] = df_feat['season'].map(season_map)
#     else:
#         df_feat['season_num'] = df_feat['month'].map({
#             12:0,1:0,2:0, 3:1,4:1,5:1, 6:2,7:2,8:2, 9:3,10:3,11:3
#         })

#     for lag in [1, 6, 24]:
#         df_feat[f'lag_{lag}'] = df_feat['pv_production'].shift(lag)
#     for lag in [12, 48]:
#         df_feat[f'lag_{lag}'] = df_feat['pv_production'].shift(lag)

#     df_feat['rolling_mean_6']  = df_feat['pv_production'].shift(1).rolling(6,  min_periods=1).mean()
#     df_feat['rolling_mean_24'] = df_feat['pv_production'].shift(1).rolling(24, min_periods=1).mean()
#     df_feat['rolling_std_6']   = df_feat['pv_production'].shift(1).rolling(6,  min_periods=1).std().fillna(0)

#     df_feat['sin_hour']  = np.sin(2*np.pi*df_feat['hour']/24)
#     df_feat['cos_hour']  = np.cos(2*np.pi*df_feat['hour']/24)
#     df_feat['sin_month'] = np.sin(2*np.pi*df_feat['month']/12)
#     df_feat['cos_month'] = np.cos(2*np.pi*df_feat['month']/12)
#     df_feat['sin_day']   = np.sin(2*np.pi*df_feat['day']/365)
#     df_feat['cos_day']   = np.cos(2*np.pi*df_feat['day']/365)

#     df_feat['irradiance_change_1h'] = df_feat['solar_irradiance'].diff(1)
#     df_feat['irradiance_change_6h'] = df_feat['solar_irradiance'].diff(6)
#     df_feat['temp_change_1h']       = df_feat['temperature'].diff(1)
#     df_feat['humidity_change_1h']   = df_feat['humidity'].diff(1)

#     df_feat['temp_anomaly']       = df_feat['temperature'] - df_feat['temperature'].rolling(6).mean()
#     df_feat['irradiance_roll_3h'] = df_feat['solar_irradiance'].shift(1).rolling(3).mean()

#     df_feat['is_daylight'] = df_feat['hour'].between(6, 18).astype(int)
#     day_only = df_feat['pv_production'].copy()
#     day_only[df_feat['is_daylight'] == 0] = np.nan
#     df_feat['rolling_day_6']  = day_only.shift(1).rolling(6,  min_periods=1).mean()
#     df_feat['rolling_day_24'] = day_only.shift(1).rolling(24, min_periods=1).mean()

#     shifted = df_feat['pv_production'].shift(1)
#     for w in [3, 6, 12, 24]:
#         df_feat[f'rolling_max_{w}'] = shifted.rolling(w, min_periods=1).max()
#         df_feat[f'rolling_min_{w}'] = shifted.rolling(w, min_periods=1).min()
#         df_feat[f'rolling_std_{w}'] = shifted.rolling(w, min_periods=1).std().fillna(0)

#     daily_max_irr = df_feat.groupby(df_feat['datetime'].dt.date)['solar_irradiance'].transform('max')
#     df_feat['irradiance_ratio_daily'] = df_feat['solar_irradiance'] / (daily_max_irr + 1e-6)
#     df_feat['irr_temp_interact']      = df_feat['solar_irradiance'] * df_feat['temperature']

#     for lag in [1, 6, 12, 24]:
#         df_feat[f'irr_lag_{lag}'] = df_feat['solar_irradiance'].shift(lag)
#     df_feat['irr_rolling_max_6']  = df_feat['solar_irradiance'].shift(1).rolling(6,  min_periods=1).max()
#     df_feat['irr_rolling_max_24'] = df_feat['solar_irradiance'].shift(1).rolling(24, min_periods=1).max()

#     df_feat['solar_hour_sin'] = np.where(
#         df_feat['hour'].between(5, 20),
#         np.sin(np.pi * (df_feat['hour'] - 5) / 15),
#         0
#     )

#     df_feat = df_feat.replace([np.inf, -np.inf], np.nan)
#     critical_cols = [c for c in ['lag_1', 'lag_6', 'lag_24',
#                                   'rolling_mean_6', 'rolling_mean_24',
#                                   'irradiance_change_1h', 'irradiance_change_6h',
#                                   'temp_anomaly', 'irradiance_roll_3h'] if c in df_feat.columns]
#     df_feat.dropna(subset=critical_cols, inplace=True)

#     if df_feat.shape[0] == 0:
#         raise ValueError("All rows dropped after NaN cleaning. Send at least 30h of continuous history data.")

#     df_feat.reset_index(drop=True, inplace=True)
#     return df_feat


# def preprocess_csv(df_raw: pd.DataFrame) -> tuple:
#     warnings_list = []
#     df = df_raw.copy()

#     df["datetime"] = pd.to_datetime(df["datetime"])
#     df = df.sort_values("datetime").reset_index(drop=True)

#     missing_raw = [c for c in REQUIRED_RAW_COLS if c not in df.columns]
#     if missing_raw:
#         raise ValueError(f"Colonnes manquantes dans le CSV : {missing_raw}")

#     if "pv_production" not in df.columns:
#         warnings_list.append("pv_production missing → lag/rolling will be imputed")

#     df_clean = clean_raw_data(df)
#     df_feat  = add_features(df_clean)

#     if df_feat.shape[0] == 0:
#         raise ValueError("No rows after feature engineering. Try sending more history data (min 48-72h).")

#     X = df_feat.reindex(columns=FEATURE_COLS).copy()
#     X = X.apply(pd.to_numeric, errors="coerce")
#     X.replace([np.inf, -np.inf], np.nan, inplace=True)
#     X = X.clip(-1e5, 1e5)

#     X_clean  = imputer.transform(X)
#     X_scaled = scaler.transform(X_clean)
#     X_scaled = np.array(X_scaled)

#     print("FEATURES EXPECTED:", len(FEATURE_COLS))
#     print("FEATURES USED:", X.shape[1])
#     print("MATCH:", list(X.columns) == FEATURE_COLS)

#     df_feat.reset_index(drop=True, inplace=True)
#     return X_scaled, df_feat, warnings_list


# # ══════════════════════════════════════════════════════════════
# # [FIX] NIGHT MASK CORRIGÉ — FONCTION CENTRALE
# # ══════════════════════════════════════════════════════════════
# def apply_night_mask(pred_w: np.ndarray,
#                      base_datetimes: pd.DatetimeIndex,
#                      current_irradiance: np.ndarray,
#                      horizon_h: int) -> np.ndarray:
#     """
#     Masque nuit ROBUSTE — triple condition :
#       1. future_hour hors plage solaire (adapté par horizon)
#       2. irradiance actuelle == 0 ET heure courante < 6 (phantom nuit)
#       3. [FIX-B] H24 boundary 19h → sunset phantom corrigé
#     """
#     pred_w = pred_w.copy()
#     current_hours = base_datetimes.hour
#     future_times  = base_datetimes + pd.Timedelta(hours=horizon_h)
#     future_hours  = future_times.hour

#     # ── Condition 1 : heure future hors plage solaire ─────────────────────────
#     # [FIX-B] boundary corrigé : >=19 (sunset) au lieu de >=20
#     night_future = (future_hours <= 5) | (future_hours >= 19)
#     pred_w[night_future] = 0.0

#     # ── Condition 2 : [FIX-A] heure courante nocturne + irradiance nulle ─────
#     # Corrige les "phantoms" H6 aux heures 0-5 (future_hour=6-11 non masqué
#     # par la condition 1, mais production actuelle = nuit réelle)
#     current_night = (current_hours <= 5) & (current_irradiance < 5.0)
#     pred_w[current_night] = 0.0

#     # ── Condition 3 : irradiance actuelle strictement nulle → 0 (sécurité) ───
#     zero_irr = (current_irradiance < 1.0) & (current_hours >= 20)
#     pred_w[zero_irr] = 0.0

#     return pred_w


# # ══════════════════════════════════════════════════════════════
# # [FIX] POST-PROCESSING H6 — CORRECTION PEAK/MORNING
# # ══════════════════════════════════════════════════════════════
# def postprocess_h6(pred_w: np.ndarray,
#                    df_feat: pd.DataFrame,
#                    base_datetimes: pd.DatetimeIndex) -> np.ndarray:
#     """
#     Deux corrections post-modèle pour H6 :

#     [FIX-D] Peak collapse (11h-16h) :
#       lag_6 at 11h = pv[5h] ≈ 0 → model predicts ~0 despite high irradiance.
#       Fix: replace with physics estimate = irr * SOLAR_LINEAR_FACTOR * 0.92

#     [FIX-E] Morning overestimate (6h-10h) :
#       Model predicts ~1.5 kW when actual is ~0.44 kW.
#       Cap if pred > 3× physics estimate.
#     """
#     pred_w = pred_w.copy()
#     hours  = base_datetimes.hour
#     irr    = df_feat["solar_irradiance"].values[-len(pred_w):]

#     # [FIX-D] Peak collapse
#     peak_mask = (hours >= 11) & (hours <= 16) & (irr > 200) & (pred_w < 50.0)
#     if peak_mask.any():
#         phys = np.clip(irr[peak_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W)
#         pred_w[peak_mask] = phys
#         print(f"[FIX-D] H6 peak collapse corrigé sur {peak_mask.sum()} rows")

#     # [FIX-E] Morning overestimate
#     morn_mask = (hours >= 6) & (hours <= 10) & (irr > 10)
#     if morn_mask.any():
#         phys_morn    = np.clip(irr[morn_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W)
#         overest_mask = morn_mask.copy()
#         overest_mask[morn_mask] = pred_w[morn_mask] > (phys_morn * 3.0)
#         if overest_mask.any():
#             pred_w[overest_mask] = np.clip(
#                 irr[overest_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W
#             )
#             print(f"[FIX-E] H6 morning overestimate corrigé sur {overest_mask.sum()} rows")
#     return pred_w


# def postprocess_h24(pred_w: np.ndarray,
#                     df_feat: pd.DataFrame,
#                     base_datetimes: pd.DatetimeIndex) -> np.ndarray:
#     """
#     Même logique que H6 mais pour l'horizon H24.
#     [FIX-D'] Peak collapse H24 (11h-16h)
#     [FIX-E'] Morning overestimate H24 (6h-9h)
#     """
#     pred_w = pred_w.copy()
#     hours  = base_datetimes.hour
#     irr    = df_feat["solar_irradiance"].values[-len(pred_w):]

#     # [FIX-D'] Peak collapse
#     peak_mask = (hours >= 11) & (hours <= 16) & (irr > 200) & (pred_w < 50.0)
#     if peak_mask.any():
#         phys = np.clip(irr[peak_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W)
#         pred_w[peak_mask] = phys
#         print(f"[FIX-D'] H24 peak collapse corrigé sur {peak_mask.sum()} rows")

#     # [FIX-E'] Morning overestimate
#     morn_mask = (hours >= 6) & (hours <= 9) & (irr > 10)
#     if morn_mask.any():
#         phys_morn    = np.clip(irr[morn_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W)
#         overest_mask = morn_mask.copy()
#         overest_mask[morn_mask] = pred_w[morn_mask] > (phys_morn * 3.0)
#         if overest_mask.any():
#             pred_w[overest_mask] = np.clip(
#                 irr[overest_mask] * SOLAR_LINEAR_FACTOR * 0.92, 0, PV_CAPACITY_W
#             )
#             print(f"[FIX-E'] H24 morning overestimate corrigé sur {overest_mask.sum()} rows")
#     return pred_w


# # ══════════════════════════════════════════════════════════════
# # ROUTES
# # ══════════════════════════════════════════════════════════════

# @app.route("/api/health", methods=["GET"])
# def health():
#     return jsonify({
#         "status": "ok",
#         "models_loaded": MODEL_LOADED,
#         "horizons": list(MODEL_FILES.keys()) if MODEL_LOADED else [],
#         "n_features": len(FEATURE_COLS) if MODEL_LOADED else None,
#     }), 200


# @app.route("/api/model-info", methods=["GET"])
# def model_info():
#     if not MODEL_LOADED:
#         return jsonify({"error": "Modèles non chargés"}), 503
#     info = {}
#     for h_key, model in models.items():
#         entry = {
#             "model_name":    HORIZON_LABELS[h_key]["name"],
#             "horizon_hours": HORIZON_LABELS[h_key]["hours"],
#             "model_type":    type(model).__name__,
#         }
#         if hasattr(model, "feature_importances_"):
#             pairs = sorted(zip(FEATURE_COLS, model.feature_importances_),
#                            key=lambda x: x[1], reverse=True)
#             entry["top_features"] = [
#                 {"feature": f, "importance": round(float(imp), 6)}
#                 for f, imp in pairs[:15]
#             ]
#         info[h_key] = entry
#     return jsonify({
#         "n_features": len(FEATURE_COLS),
#         "feature_names": FEATURE_COLS,
#         "models": info,
#     }), 200


# @app.route("/api/insert", methods=["POST"])
# def insert():
#     file = request.files["file"]
#     df   = pd.read_csv(file)
#     insert_solar_data(df)
#     return jsonify({"success": True})


# @app.route("/api/predict", methods=["POST"])
# def predict():
#     # ── 1. Récupération du fichier ─────────────────────────────
#     if "file" not in request.files:
#         return jsonify({"error": "Aucun fichier reçu. Envoyez un champ 'file'."}), 400
#     file = request.files["file"]
#     if not file.filename.endswith(".csv"):
#         return jsonify({"error": "Seuls les fichiers .csv sont acceptés."}), 400

#     # ── 2. Lecture CSV ─────────────────────────────────────────
#     try:
#         df_raw = pd.read_csv(io.BytesIO(file.read()))
#     except Exception as e:
#         return jsonify({"error": f"Impossible de lire le CSV : {str(e)}"}), 422
#     if df_raw.empty:
#         return jsonify({"error": "Le CSV est vide."}), 422
#     if not MODEL_LOADED:
#         return jsonify({"error": "Modèles non chargés"}), 503

#     # ── 3. BUFFER SYSTEM (DB HISTORY) ──────────────────────────
#     try:
#         history = get_last_96h()
#         history = history.sort_values("datetime").drop_duplicates("datetime")
#         history["datetime"] = pd.to_datetime(history["datetime"])
#         df_raw["datetime"]  = pd.to_datetime(df_raw["datetime"])
#         history = history[~history["datetime"].isin(df_raw["datetime"])]
#         full_df = pd.concat([history, df_raw], ignore_index=True)
#         full_df = full_df.sort_values("datetime").reset_index(drop=True)
#     except Exception as e:
#         return jsonify({"error": f"DB error: {str(e)}"}), 500

#     if len(full_df) < 72:
#         return jsonify({
#             "error": (
#                 f"Not enough data: got {len(full_df)} rows, need at least 72. "
#                 f"History in DB: {len(history)} rows, input: {len(df_raw)} rows."
#             )
#         }), 400

#     # ── 4. FEATURE ENGINEERING ────────────────────────────────
#     try:
#         X_scaled, df_feat, warnings_list = preprocess_csv(full_df)
#     except Exception as e:
#         return jsonify({"error": f"Preprocessing error: {str(e)}"}), 500

#     # ── 5. KEEP ONLY USER ROWS ────────────────────────────────
#     n_user   = len(df_raw)
#     X_scaled = X_scaled[-n_user:]
#     df_feat  = df_feat.iloc[-n_user:].reset_index(drop=True)

#     # ── 6. PREDICTION + CORRECTIONS ───────────────────────────
#     try:
#         results_per_horizon = {}
#         base_datetimes = pd.to_datetime(df_feat["datetime"].values)
#         current_irr    = df_feat["solar_irradiance"].values.astype(float)

#         for h_key, model in models.items():
#             horizon_h = HORIZON_LABELS[h_key]["hours"]

#             # Prédiction brute du modèle (log1p space → expm1)
#             pred_log = model.predict(X_scaled)
#             pred_w   = np.expm1(pred_log)
#             pred_w   = np.clip(pred_w, 0, PV_CAPACITY_W)

#             # ── [FIX-A/B/C] Night mask robuste ────────────────
#             pred_w = apply_night_mask(
#                 pred_w, base_datetimes, current_irr, horizon_h
#             )

#             # ── [FIX-D/E] Post-processing physique ────────────
#             if h_key == "H6":
#                 pred_w = postprocess_h6(pred_w, df_feat, base_datetimes)
#             elif h_key == "H24":
#                 pred_w = postprocess_h24(pred_w, df_feat, base_datetimes)

#             # Cap final
#             pred_w = np.clip(pred_w, 0, PV_CAPACITY_W)
#             results_per_horizon[h_key] = pred_w

#     except Exception as e:
#         return jsonify({"error": f"Erreur prediction: {str(e)}"}), 500

#     # ── 7. BUILD RESPONSE ─────────────────────────────────────
#     datetimes   = df_feat["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()
#     predictions = []
#     for i in range(n_user):
#         row = {"index": i, "datetime": datetimes[i]}
#         for h_key in models.keys():
#             val_w = float(results_per_horizon[h_key][i])
#             row[f"pred_{h_key}_W"]  = round(val_w, 2)
#             row[f"pred_{h_key}_kW"] = round(val_w / 1000.0, 4)
#         predictions.append(row)

#     # ── 8. KPIs ───────────────────────────────────────────────
#     kpis = {}
#     for h_key in models.keys():
#         arr = results_per_horizon[h_key]
#         kpis[h_key] = {
#             "model":        HORIZON_LABELS[h_key]["name"],
#             "horizon_hours": HORIZON_LABELS[h_key]["hours"],
#             "unit":         "W",
#             "avg_W":  round(float(arr.mean()), 2),
#             "max_W":  round(float(arr.max()),  2),
#             "min_W":  round(float(arr.min()),  2),
#             "avg_kW": round(float(arr.mean()) / 1000.0, 4),
#             "max_kW": round(float(arr.max())  / 1000.0, 4),
#         }

#     return jsonify({
#         "success":            True,
#         "warnings":           warnings_list,
#         "n_user_rows":        n_user,
#         "used_history_rows":  len(history),
#         "predictions":        predictions,
#         "kpis":               kpis
#     }), 200


# if __name__ == "__main__":
#     app.run(debug=True, host="0.0.0.0", port=5000)