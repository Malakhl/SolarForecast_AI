
// // }
// import { createFileRoute } from "@tanstack/react-router";
// import { useState, useEffect, useRef, useCallback } from "react";

// // ── Single background photo — place in public/
// import bgImg from "/Solar-renewables-AdobeStock_279073423-min.webp";

// export const Route = createFileRoute("/predict")({
//   component: App,
// });

// const API_BASE = "http://localhost:5000";
// const CHART_CDN = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";

// const COLORS = {
//   bg: "#F5F4EF",
//   card: "#FFFFFF",
//   border: "rgba(0,0,0,0.1)",
//   text: "#1a1a1a",
//   muted: "#6b6b6b",
//   primary: "#378ADD",
//   success: "#639922",
//   warning: "#BA7517",
//   coral: "#D85A30",
//   amber: "#EF9F27",
//   rowAlt: "#F9F8F5",
//   rowHover: "#EAF3DE",
// };

// const radius = { card: 14, btn: 8 };
// const shadow = "0 1px 3px rgba(0,0,0,0.08)";
// const fontStack = "system-ui, -apple-system, sans-serif";

// function loadChartJs() {
//   return new Promise<any>((resolve, reject) => {
//     if (typeof window === "undefined") return reject(new Error("ssr"));
//     const w = window as any;
//     if (w.Chart) return resolve(w.Chart);
//     const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
//     if (existing) {
//       existing.addEventListener("load", () => resolve(w.Chart));
//       existing.addEventListener("error", () => reject(new Error("load fail")));
//       return;
//     }
//     const s = document.createElement("script");
//     s.src = CHART_CDN;
//     s.async = true;
//     s.onload = () => resolve(w.Chart);
//     s.onerror = () => reject(new Error("load fail"));
//     document.head.appendChild(s);
//   });
// }

// function easeOutQuad(t: number) {
//   return t * (2 - t);
// }

// function useCountUp(target: number, duration = 800) {
//   const [val, setVal] = useState(0);
//   useEffect(() => {
//     if (!isFinite(target)) { setVal(0); return; }
//     let raf = 0;
//     const start = performance.now();
//     const tick = (now: number) => {
//       const p = Math.min(1, (now - start) / duration);
//       setVal(target * easeOutQuad(p));
//       if (p < 1) raf = requestAnimationFrame(tick);
//     };
//     raf = requestAnimationFrame(tick);
//     return () => cancelAnimationFrame(raf);
//   }, [target, duration]);
//   return val;
// }

// function fmtNum(n: number, decimals = 2) {
//   if (!isFinite(n)) return "—";
//   return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
// }
// function fmtMJ(j: number) { return `${fmtNum(j / 1_000_000, 2)} MJ`; }
// function fmtKWh(k: number) { return `${fmtNum(k, 3)} kWh`; }

// type Prediction    = { index: number; joule: number; kwh: number };
// type Kpis          = { avg_joule: number; max_joule: number; min_joule: number; avg_kwh: number; total_kwh: number; n_rows: number };
// type CsvInfo       = { n_rows: number; n_cols: number; columns: string[]; detected_weather_cols: string[] };
// type ScatterDswrf  = { index: number; dswrf: number };
// type ClusterPoint  = { index: number; cluster: number; pc1: number; pc2: number; kwh: number };
// type ClusterSummary= { cluster: number; count: number; avg_kwh: number; min_kwh: number; max_kwh: number };
// type ApiResp = {
//   success: boolean;
//   warnings: string[];
//   csv_info: CsvInfo;
//   kpis: Kpis;
//   predictions: Prediction[];
//   scatter_dswrf?: ScatterDswrf[];
//   cluster_points?: ClusterPoint[];
//   cluster_summary?: ClusterSummary[];
//   cluster_variance?: number[];
// };

// /* ─────────────────────────────────────────────
//    APP
// ───────────────────────────────────────────── */
// function App() {
//   const [health, setHealth]         = useState<"loading"|"ok"|"error">("loading");
//   const [file, setFile]             = useState<File | null>(null);
//   const [rowCount, setRowCount]     = useState<number | null>(null);
//   const [dragging, setDragging]     = useState(false);
//   const [loading, setLoading]       = useState(false);
//   const [error, setError]           = useState<string | null>(null);
//   const [data, setData]             = useState<ApiResp | null>(null);
//   const [warningsOpen, setWarningsOpen] = useState(true);
//   const [csvInfoOpen, setCsvInfoOpen]   = useState(false);
//   const [chartReady, setChartReady] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     let ok = true;
//     fetch(`${API_BASE}/api/health`)
//       .then(r => r.ok ? r.json() : Promise.reject())
//       .then(() => ok && setHealth("ok"))
//       .catch(() => ok && setHealth("error"));
//     return () => { ok = false; };
//   }, []);

//   useEffect(() => {
//     loadChartJs().then(() => setChartReady(true)).catch(() => setChartReady(false));
//   }, []);

//   const onFile = useCallback(async (f: File | null) => {
//     setError(null); setFile(f); setRowCount(null);
//     if (!f) return;
//     if (!f.name.toLowerCase().endsWith(".csv")) { setError("Please select a .csv file"); setFile(null); return; }
//     try {
//       const text  = await f.text();
//       const lines = text.split(/\r?\n/).filter(l => l.length > 0);
//       setRowCount(Math.max(0, lines.length - 1));
//     } catch { setRowCount(null); }
//   }, []);

//   const onDrop = (e: React.DragEvent) => {
//     e.preventDefault(); setDragging(false);
//     const f = e.dataTransfer.files?.[0];
//     if (f) onFile(f);
//   };

//   const analyze = async () => {
//     if (!file) return;
//     setLoading(true); setError(null);
//     try {
//       const fd = new FormData();
//       fd.append("file", file);
//       const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd });
//       if (!res.ok) {
//         let msg = `Request failed (${res.status})`;
//         try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
//         throw new Error(msg);
//       }
//       const json: ApiResp = await res.json();
//       if (!json.success) throw new Error("API returned unsuccessful response");
//       setData(json); setWarningsOpen(true);
//     } catch (e: any) {
//       setError(e.message || "Analysis failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const reset = () => {
//     setFile(null); setRowCount(null); setData(null); setError(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   return (
//     <>
//       <style>{`
//         * { box-sizing: border-box; }
//         html, body { margin: 0; padding: 0; color: var(--color-text-primary); font-family: ${fontStack}; }

//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadein  { from { opacity:0; } to { opacity:1; } }
//         @keyframes slideup { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes kb-predict { from { transform:scale(1.06) translate(0,0); } to { transform:scale(1.00) translate(-10px,-5px); } }
//         @keyframes scan-line  { 0%{top:0;opacity:.35} 50%{opacity:.7} 100%{top:100%;opacity:.15} }

//         .sep-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block; }
//         .sep-row     { animation:slideup 350ms ease-out both; }
//         .sep-chart   { animation:fadein 400ms ease-out both; }
//         .sep-table-row:hover          { background:${COLORS.rowHover} !important; }
//         .sep-btn-primary:hover:not(:disabled) { background:#2c75c2; }
//         .sep-btn-outline:hover        { background:rgba(55,138,221,0.08); }
//         .sep-page-btn:hover:not(:disabled)    { background:rgba(0,0,0,0.04); }
//       `}</style>

//       {/* ── FIXED BACKGROUND: single photo ── */}
//       <div style={{
//         position: "fixed", inset: 0, zIndex: 0, overflow: "hidden",
//       }}>
//         {/* Photo with Ken Burns */}
//         <img
//           src={bgImg}
//           alt=""
//           style={{
//             position: "absolute", inset: 0,
//             width: "100%", height: "100%",
//             objectFit: "cover", objectPosition: "center",
//             animation: "kb-predict 18s ease-out infinite alternate",
//           }}
//         />
//         {/* Dark overlay so content stays readable */}
//         <div style={{
//           position: "absolute", inset: 0,
//           background: "linear-gradient(to bottom, rgba(2,10,22,0.72) 0%, rgba(2,14,30,0.80) 100%)",
//         }} />
//         {/* Subtle grid overlay */}
//         <div style={{
//           position: "absolute", inset: 0, pointerEvents: "none",
//           backgroundImage: "linear-gradient(rgba(6,182,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.04) 1px,transparent 1px)",
//           backgroundSize: "60px 60px",
//         }} />
//         {/* Scanline */}
//         <div style={{
//           position: "absolute", left: 0, right: 0, height: 2, pointerEvents: "none",
//           background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.25),transparent)",
//           animation: "scan-line 12s linear infinite",
//         }} />
//         {/* Bottom vignette */}
//         <div style={{
//           position: "absolute", inset: 0,
//           background: "linear-gradient(to top, rgba(2,10,22,0.6) 0%, transparent 40%)",
//         }} />
//       </div>

//       {/* ── CONTENT ── */}
//       <div style={{
//         position: "relative", zIndex: 1,
//         minHeight: "100vh",
//         padding: "24px 16px",
//         maxWidth: 1200,
//         margin: "0 auto",
//       }}>
//         <Header health={health} />
//         <UploadZone
//           file={file} rowCount={rowCount} dragging={dragging} loading={loading}
//           error={error} hasResults={!!data}
//           onDragOver={e => { e.preventDefault(); setDragging(true); }}
//           onDragLeave={() => setDragging(false)}
//           onDrop={onDrop}
//           onPick={() => fileInputRef.current?.click()}
//           onFile={onFile} onAnalyze={analyze} onReset={reset} fileInputRef={fileInputRef}
//         />
//         {data && (
//           <Results
//             data={data} chartReady={chartReady}
//             warningsOpen={warningsOpen} setWarningsOpen={setWarningsOpen}
//             csvInfoOpen={csvInfoOpen} setCsvInfoOpen={setCsvInfoOpen}
//           />
//         )}
//       </div>
//     </>
//   );
// }

// /* ── Header ─────────────────────────────────────────────────────────────────── */
// function Header({ health }: { health: "loading"|"ok"|"error" }) {
//   const dotColor = health === "ok" ? COLORS.success : health === "error" ? COLORS.coral : "#aaa";
//   const label    = health === "ok" ? "API online"  : health === "error" ? "API offline" : "Checking…";
//   return (
//     <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
//       <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//         <div style={{ fontSize:32 }}>☀️</div>
//         <div>
//           <h1 style={{ margin:0, fontSize:20, fontWeight:600, color:"#ffffff" }}>Solar Energy Predictor</h1>
//           <div style={{ fontSize:13, color:"rgba(186,230,253,0.75)" }}>ML-powered energy forecasting</div>
//         </div>
//       </div>
//       <div style={{
//         display:"inline-flex", alignItems:"center", gap:8,
//         padding:"6px 12px",
//         background:"rgba(255,255,255,0.08)",
//         backdropFilter:"blur(8px)",
//         border:"1px solid rgba(255,255,255,0.15)",
//         borderRadius:999, fontSize:13, fontWeight:500,
//         color:"#fff", boxShadow:shadow,
//       }}>
//         <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor, boxShadow:`0 0 0 3px ${dotColor}44` }} />
//         {label}
//       </div>
//     </header>
//   );
// }

// /* ── Upload Zone ────────────────────────────────────────────────────────────── */
// function UploadZone(props: {
//   file: File|null; rowCount:number|null; dragging:boolean; loading:boolean;
//   error:string|null; hasResults:boolean;
//   onDragOver:(e:React.DragEvent)=>void; onDragLeave:()=>void; onDrop:(e:React.DragEvent)=>void;
//   onPick:()=>void; onFile:(f:File|null)=>void; onAnalyze:()=>void; onReset:()=>void;
//   fileInputRef:React.RefObject<HTMLInputElement|null>;
// }) {
//   const { file, rowCount, dragging, loading, error, hasResults,
//           onDragOver, onDragLeave, onDrop, onPick, onFile, onAnalyze, onReset, fileInputRef } = props;
//   return (
//     <section style={{
//       background:"rgba(255,255,255,0.08)",
//       backdropFilter:"blur(16px) saturate(160%)",
//       WebkitBackdropFilter:"blur(16px) saturate(160%)",
//       border:"1px solid rgba(255,255,255,0.15)",
//       borderRadius:radius.card, padding:24, boxShadow:shadow, marginBottom:24,
//     }}>
//       <div
//         onClick={onPick} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
//         style={{
//           border:`2px ${dragging?"solid":"dashed"} ${dragging?"#06b6d4":COLORS.primary}`,
//           borderRadius:radius.card, padding:"40px 20px", textAlign:"center", cursor:"pointer",
//           background:dragging?"rgba(6,182,212,0.08)":"rgba(255,255,255,0.04)",
//           transition:"all 150ms ease",
//         }}
//       >
//         <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary}
//           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:12 }}>
//           <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
//           <polyline points="17 8 12 3 7 8"/>
//           <line x1="12" y1="3" x2="12" y2="15"/>
//         </svg>
//         <div style={{ fontSize:16, fontWeight:500, color:"#ffffff" }}>
//           {file ? file.name : "Drop your CSV file here"}
//         </div>
//         <div style={{ fontSize:13, color:"rgba(186,230,253,0.7)", marginTop:4 }}>
//           {file
//             ? (rowCount !== null ? `${rowCount.toLocaleString()} rows detected` : "Reading file…")
//             : "or click to browse"}
//         </div>
//         <input ref={fileInputRef} type="file" accept=".csv" style={{ display:"none" }}
//           onChange={e => onFile(e.target.files?.[0] || null)} />
//       </div>

//       {error && (
//         <div style={{ marginTop:16, padding:"12px 14px", background:"rgba(216,90,48,0.18)",
//           border:`1px solid ${COLORS.coral}`, color:"#ffb09a", borderRadius:radius.btn, fontSize:14 }}>
//           {error}
//         </div>
//       )}

//       <div style={{ display:"flex", gap:12, marginTop:16 }}>
//         <button
//           className="sep-btn-primary" onClick={onAnalyze} disabled={!file||loading}
//           style={{
//             flex:1, height:44,
//             background:!file||loading?"#2c5a8a":COLORS.primary,
//             color:"#fff", border:"none", borderRadius:radius.btn,
//             fontSize:15, fontWeight:500,
//             cursor:!file||loading?"not-allowed":"pointer",
//             display:"inline-flex", alignItems:"center", justifyContent:"center", gap:10,
//             transition:"background 150ms ease", fontFamily:fontStack,
//           }}
//         >
//           {loading ? (<><span className="sep-spinner"/>Analyzing your data…</>) : "Analyze"}
//         </button>
//         {hasResults && (
//           <button
//             className="sep-btn-outline" onClick={onReset}
//             style={{
//               height:44, padding:"0 20px",
//               background:"rgba(255,255,255,0.06)",
//               color:"#67e8f9",
//               border:"1px solid rgba(103,232,249,0.4)",
//               borderRadius:radius.btn, fontSize:15, fontWeight:500,
//               cursor:"pointer", fontFamily:fontStack,
//             }}
//           >
//             Reset
//           </button>
//         )}
//       </div>
//     </section>
//   );
// }

// /* ── Results ────────────────────────────────────────────────────────────────── */
// function Results({ data, chartReady, warningsOpen, setWarningsOpen, csvInfoOpen, setCsvInfoOpen }: {
//   data:ApiResp; chartReady:boolean; warningsOpen:boolean; setWarningsOpen:(b:boolean)=>void;
//   csvInfoOpen:boolean; setCsvInfoOpen:(b:boolean)=>void;
// }) {
//   const { kpis, predictions, warnings, csv_info } = data;
//   return (
//     <div>
//       {warnings && warnings.length > 0 && (
//         <div style={{ background:"rgba(186,117,23,0.15)", border:`1px solid ${COLORS.warning}`,
//           borderRadius:radius.card, padding:16, marginBottom:20 }}>
//           <button onClick={() => setWarningsOpen(!warningsOpen)}
//             style={{ background:"none", border:"none", color:COLORS.amber, fontWeight:600,
//               cursor:"pointer", padding:0, fontSize:14, fontFamily:fontStack }}>
//             {warningsOpen?"▼":"▶"} {warnings.length} warning{warnings.length===1?"":"s"}
//           </button>
//           {warningsOpen && (
//             <ul style={{ margin:"10px 0 0 20px", padding:0, color:COLORS.amber, fontSize:13 }}>
//               {warnings.map((w,i)=><li key={i}>{w}</li>)}
//             </ul>
//           )}
//         </div>
//       )}
//       <CsvInfoPanel info={csv_info} open={csvInfoOpen} setOpen={setCsvInfoOpen} />
//       <KpiRow kpis={kpis} />
//       <ChartsGrid predictions={predictions} kpis={kpis} chartReady={chartReady} />
//       <ScatterDswrfSection predictions={predictions} scatter={data.csv_info?.scatter_dswrf} chartReady={chartReady} />
//       <ClusteringSection points={data.csv_info?.cluster_points} summary={data.csv_info?.cluster_summary} variance={data.csv_info?.pca_variance} chartReady={chartReady} />
//       <PredictionsTable predictions={predictions} />
//       <DownloadSection predictions={predictions} />
//     </div>
//   );
// }

// /* ── Shared glass card style ─────────────────────────────────────────────────── */
// const glassCard: React.CSSProperties = {
//   background:"rgba(255,255,255,0.09)",
//   backdropFilter:"blur(16px) saturate(160%)",
//   WebkitBackdropFilter:"blur(16px) saturate(160%)",
//   border:"1px solid rgba(255,255,255,0.15)",
//   borderRadius:radius.card,
//   boxShadow:"0 4px 24px rgba(0,0,0,0.35)",
//   color:"#fff",
// };

// /* ── CSV Info Panel ─────────────────────────────────────────────────────────── */
// function CsvInfoPanel({ info, open, setOpen }: { info:CsvInfo; open:boolean; setOpen:(b:boolean)=>void }) {
//   return (
//     <div style={{ ...glassCard, padding:16, marginBottom:20 }}>
//       <button onClick={() => setOpen(!open)} style={{ background:"none", border:"none", padding:0,
//         cursor:"pointer", fontSize:14, fontWeight:600, color:"#fff", fontFamily:fontStack }}>
//         {open?"▼":"▶"} CSV info
//       </button>
//       {open && (
//         <div style={{ marginTop:12, fontSize:13, color:"rgba(186,230,253,0.75)" }}>
//           <div style={{ marginBottom:8 }}>
//             <strong style={{ color:"#fff" }}>Rows:</strong> {info.n_rows.toLocaleString()} ·{" "}
//             <strong style={{ color:"#fff" }}>Columns:</strong> {info.n_cols}
//           </div>
//           <div style={{ marginBottom:8 }}>
//             <strong style={{ color:"#fff" }}>All columns:</strong>
//             <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
//               {info.columns.map(c => (
//                 <span key={c} style={{ background:"rgba(255,255,255,0.1)", color:"#e2f0ff",
//                   padding:"3px 8px", borderRadius:6, fontSize:12 }}>{c}</span>
//               ))}
//             </div>
//           </div>
//           <div>
//             <strong style={{ color:"#fff" }}>Detected weather columns:</strong>
//             <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
//               {info.detected_weather_cols.length === 0
//                 ? <span style={{ fontStyle:"italic" }}>none</span>
//                 : info.detected_weather_cols.map(c => (
//                     <span key={c} style={{ background:"rgba(55,138,221,0.25)", color:"#67e8f9",
//                       padding:"3px 8px", borderRadius:6, fontSize:12, fontWeight:500 }}>{c}</span>
//                   ))
//               }
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function getWeatherProfile(avgKwh: number, _clusterId: number) {
//   if (avgKwh > 6)   return { label:"Sunny",         emoji:"🌞", color:"#f5a623" };
//   if (avgKwh > 4.5) return { label:"Partly Cloudy", emoji:"⛅", color:"#4a90e2" };
//   return               { label:"Cloudy",        emoji:"☁️", color:"#7f8c8d" };
// }

// /* ── KPI Row ─────────────────────────────────────────────────────────────────── */
// function KpiRow({ kpis }: { kpis:Kpis }) {
//   const cards = [
//     { label:"Total kWh",        value:kpis.total_kwh,           color:COLORS.primary, decimals:2, trend:"▲" },
//     { label:"Avg kWh / period", value:kpis.avg_kwh,             color:COLORS.success, decimals:3, trend:"●" },
//     { label:"Max kWh",          value:kpis.max_joule/3_600_000, color:COLORS.amber,   decimals:3, trend:"▲" },
//     { label:"Min kWh",          value:kpis.min_joule/3_600_000, color:COLORS.coral,   decimals:3, trend:"▼" },
//     { label:"N rows analyzed",  value:kpis.n_rows,              color:"#aaa",          decimals:0, trend:"#" },
//   ];
//   return (
//     <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12, marginBottom:24 }}>
//       {cards.map((c,i) => <KpiCard key={i} {...c}/>)}
//     </div>
//   );
// }

// function KpiCard({ label, value, color, decimals, trend }: {
//   label:string; value:number; color:string; decimals:number; trend:string;
// }) {
//   const animated = useCountUp(value||0, 800);
//   return (
//     <div className="sep-row" style={{ ...glassCard, padding:16, minWidth:160 }}>
//       <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
//         <span style={{ fontSize:12, fontWeight:500, color:"rgba(186,230,253,0.7)",
//           textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
//         <span style={{ color, fontSize:14 }}>{trend}</span>
//       </div>
//       <div style={{ fontSize:28, fontWeight:600, color:"#ffffff", lineHeight:1.1 }}>
//         {fmtNum(animated, decimals)}
//       </div>
//     </div>
//   );
// }

// /* ── Charts Grid ─────────────────────────────────────────────────────────────── */
// function ChartsGrid({ predictions, kpis, chartReady }: {
//   predictions:Prediction[]; kpis:Kpis; chartReady:boolean;
// }) {
//   return (
//     <div style={{ marginBottom:24 }}>
//       <div className="sep-chart" style={{ animationDelay:"0ms", marginBottom:16 }}>
//         <ChartCard title="Energy output over time" height={300}>
//           <LineChart predictions={predictions} chartReady={chartReady}/>
//         </ChartCard>
//       </div>
//       <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:16, marginBottom:16 }}>
//         <div className="sep-chart" style={{ animationDelay:"100ms" }}>
//           <ChartCard title="Distribution of predicted values" height={260}>
//             <BarChart predictions={predictions} chartReady={chartReady}/>
//           </ChartCard>
//         </div>
//         <div className="sep-chart" style={{ animationDelay:"200ms" }}>
//           <ChartCard title="Performance range" height={260}>
//             <DoughnutChart kpis={kpis} chartReady={chartReady}/>
//           </ChartCard>
//         </div>
//       </div>
//       <div className="sep-chart" style={{ animationDelay:"300ms" }}>
//         <ChartCard title="Cumulative production" height={300}>
//           <AreaChart predictions={predictions} chartReady={chartReady}/>
//         </ChartCard>
//       </div>
//     </div>
//   );
// }

// function ChartCard({ title, height, children }: { title:string; height:number; children:React.ReactNode }) {
//   return (
//     <div style={{ ...glassCard, padding:16 }}>
//       <div style={{ fontSize:14, fontWeight:600, marginBottom:12, color:"#ffffff" }}>{title}</div>
//       <div style={{ height, position:"relative" }}>{children}</div>
//     </div>
//   );
// }

// function useChart(builder: ()=>any, deps: any[], chartReady: boolean) {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const chartRef  = useRef<any>(null);
//   useEffect(() => {
//     if (!chartReady) return;
//     const w = window as any;
//     if (!w.Chart || !canvasRef.current) return;
//     chartRef.current?.destroy();
//     chartRef.current = new w.Chart(canvasRef.current, builder());
//     return () => { chartRef.current?.destroy(); chartRef.current = null; };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [chartReady, ...deps]);
//   return canvasRef;
// }

// function chartDefaults() {
//   return {
//     color: "rgba(186,230,253,0.8)",
//     scaleColor: "rgba(186,230,253,0.6)",
//     gridColor: "rgba(255,255,255,0.06)",
//   };
// }

// function LineChart({ predictions, chartReady }: { predictions:Prediction[]; chartReady:boolean }) {
//   const ref = useChart(() => {
//     const { scaleColor, gridColor } = chartDefaults();
//     return {
//       type:"line",
//       data:{ labels:predictions.map(p=>p.index), datasets:[{
//         data:predictions.map(p=>p.kwh),
//         borderColor:COLORS.primary,
//         backgroundColor:"rgba(55,138,221,0.15)",
//         fill:true, tension:0.4, pointRadius:0, borderWidth:2,
//       }]},
//       options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
//         scales:{
//           x:{ title:{display:true,text:"Index",color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//           y:{ title:{display:true,text:"kWh",color:scaleColor}, beginAtZero:true, grid:{color:gridColor}, ticks:{color:scaleColor} },
//         },
//       },
//     };
//   }, [predictions], chartReady);
//   return <canvas ref={ref}/>;
// }

// function BarChart({ predictions, chartReady }: { predictions:Prediction[]; chartReady:boolean }) {
//   const ref = useChart(() => {
//     const { scaleColor, gridColor } = chartDefaults();
//     const vals=predictions.map(p=>p.kwh);
//     const min=Math.min(...vals), max=Math.max(...vals), buckets=8, step=(max-min)/buckets||1;
//     const counts=new Array(buckets).fill(0), labels:string[]=[];
//     for(let i=0;i<buckets;i++) labels.push(`${(min+step*i).toFixed(2)}–${(min+step*(i+1)).toFixed(2)}`);
//     vals.forEach(v=>{ let idx=Math.floor((v-min)/step); if(idx>=buckets)idx=buckets-1; if(idx<0)idx=0; counts[idx]++; });
//     return {
//       type:"bar",
//       data:{ labels, datasets:[{ data:counts, backgroundColor:COLORS.success, borderRadius:4 }] },
//       options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
//         scales:{
//           x:{ ticks:{font:{size:10},color:scaleColor}, grid:{display:false} },
//           y:{ beginAtZero:true, title:{display:true,text:"Count",color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//         },
//       },
//     };
//   }, [predictions], chartReady);
//   return <canvas ref={ref}/>;
// }

// function DoughnutChart({ kpis, chartReady }: { kpis:Kpis; chartReady:boolean }) {
//   const minK=kpis.min_joule/3_600_000, avgK=kpis.avg_kwh, maxK=kpis.max_joule/3_600_000;
//   const ref = useChart(() => ({
//     type:"doughnut",
//     data:{ labels:["Min kWh","Avg kWh","Max kWh"], datasets:[{
//       data:[minK,avgK,maxK],
//       backgroundColor:[COLORS.coral,COLORS.primary,COLORS.amber],
//       borderWidth:0,
//     }]},
//     options:{ responsive:true, maintainAspectRatio:false, cutout:"65%",
//       plugins:{legend:{display:false}} },
//   }), [minK,avgK,maxK], chartReady);
//   return (
//     <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
//       <div style={{ flex:1, position:"relative" }}>
//         <canvas ref={ref}/>
//         <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
//           justifyContent:"center", pointerEvents:"none", fontSize:14, fontWeight:600, color:"rgba(186,230,253,0.7)" }}>
//           KPI
//         </div>
//       </div>
//       <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:8, flexWrap:"wrap" }}>
//         {[{c:COLORS.coral,l:"Min",v:minK},{c:COLORS.primary,l:"Avg",v:avgK},{c:COLORS.amber,l:"Max",v:maxK}].map(it=>(
//           <div key={it.l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"rgba(186,230,253,0.8)" }}>
//             <span style={{ width:10, height:10, background:it.c, borderRadius:2 }}/>
//             <span style={{ color:"rgba(186,230,253,0.6)" }}>{it.l}</span>
//             <strong style={{ color:"#fff" }}>{fmtNum(it.v,3)}</strong>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// function AreaChart({ predictions, chartReady }: { predictions:Prediction[]; chartReady:boolean }) {
//   const ref = useChart(() => {
//     const { scaleColor, gridColor } = chartDefaults();
//     let cum=0;
//     const cumData=predictions.map(p=>(cum+=p.kwh));
//     const finalVal=cumData[cumData.length-1]||0;
//     return {
//       type:"line",
//       data:{ labels:predictions.map(p=>p.index), datasets:[{
//         data:cumData,
//         borderColor:COLORS.success, backgroundColor:"rgba(99,153,34,0.18)",
//         fill:true, tension:0.3, pointRadius:0, borderWidth:2,
//       }]},
//       options:{ responsive:true, maintainAspectRatio:false,
//         plugins:{legend:{display:false},tooltip:{enabled:true}},
//         scales:{
//           x:{ title:{display:true,text:"Index",color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//           y:{ title:{display:true,text:`kWh (final: ${fmtNum(finalVal,2)})`,color:scaleColor}, beginAtZero:true, grid:{color:gridColor}, ticks:{color:scaleColor} },
//         },
//       },
//     };
//   }, [predictions], chartReady);
//   return <canvas ref={ref}/>;
// }

// /* ── Predictions Table ─────────────────────────────────────────────────────── */
// function PredictionsTable({ predictions }: { predictions:Prediction[] }) {
//   const [search,setSearch] = useState("");
//   const [sortKey,setSortKey] = useState<"index"|"joule"|"kwh">("index");
//   const [sortDir,setSortDir] = useState<"asc"|"desc">("asc");
//   const [page,setPage] = useState(1);
//   const PER = 10;

//   const filtered = predictions.filter(p => {
//     if (!search.trim()) return true;
//     const s = search.trim();
//     const m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
//     if (m) { const a=parseFloat(m[1]),b=parseFloat(m[2]); return(p.index>=a&&p.index<=b)||(p.kwh>=a&&p.kwh<=b); }
//     return String(p.index).includes(s)||String(p.kwh).includes(s);
//   });
//   const sorted = [...filtered].sort((a,b)=>sortDir==="asc"?a[sortKey]-b[sortKey]:b[sortKey]-a[sortKey]);
//   const totalPages = Math.max(1,Math.ceil(sorted.length/PER));
//   const safePage   = Math.min(page,totalPages);
//   const pageRows   = sorted.slice((safePage-1)*PER, safePage*PER);
//   const toggleSort = (k:"index"|"joule"|"kwh") => { if(sortKey===k)setSortDir(sortDir==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} };
//   const arrow      = (k:string) => sortKey===k?(sortDir==="asc"?" ▲":" ▼"):"";

//   return (
//     <div style={{ ...glassCard, padding:16, marginBottom:24 }}>
//       <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
//         <div style={{ fontSize:14, color:"rgba(186,230,253,0.7)" }}>
//           Showing <strong style={{ color:"#fff" }}>{filtered.length.toLocaleString()}</strong> of{" "}
//           <strong style={{ color:"#fff" }}>{predictions.length.toLocaleString()}</strong> predictions
//         </div>
//         <input
//           value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
//           placeholder="Filter (e.g. 5.2 or 0-100)"
//           style={{ padding:"8px 12px", border:"1px solid rgba(255,255,255,0.2)",
//             borderRadius:radius.btn, fontSize:13, outline:"none", minWidth:220,
//             background:"rgba(255,255,255,0.08)", color:"#fff", fontFamily:fontStack }}
//         />
//       </div>
//       <div style={{ overflowX:"auto" }}>
//         <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
//           <thead>
//             <tr style={{ background:"rgba(255,255,255,0.06)" }}>
//               {(["index","joule","kwh"] as const).map(k => (
//                 <th key={k} onClick={()=>toggleSort(k)}
//                   style={{ textAlign:"left", padding:"10px 12px", fontWeight:600, cursor:"pointer",
//                     color:"rgba(186,230,253,0.9)", userSelect:"none",
//                     borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
//                   {k==="index"?"Index":k==="joule"?"Energy (J)":"Energy (kWh)"}{arrow(k)}
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {pageRows.map((p,i) => (
//               <tr key={p.index} className="sep-table-row sep-row"
//                 style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.04)",
//                   animationDelay:`${i*20}ms`, transition:"background 100ms" }}>
//                 <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"#fff" }}>{p.index}</td>
//                 <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"#e2f0ff" }}>{fmtMJ(p.joule)}</td>
//                 <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"#e2f0ff" }}>{fmtKWh(p.kwh)}</td>
//               </tr>
//             ))}
//             {pageRows.length===0 && (
//               <tr><td colSpan={3} style={{ padding:24, textAlign:"center", color:"rgba(186,230,253,0.5)" }}>No matching rows</td></tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//       <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, fontSize:13 }}>
//         <div style={{ color:"rgba(186,230,253,0.6)" }}>Page {safePage} of {totalPages}</div>
//         <div style={{ display:"flex", gap:6 }}>
//           <button className="sep-page-btn" onClick={()=>setPage(Math.max(1,safePage-1))} disabled={safePage<=1} style={pageBtnStyle(safePage<=1)}>← Prev</button>
//           <button className="sep-page-btn" onClick={()=>setPage(Math.min(totalPages,safePage+1))} disabled={safePage>=totalPages} style={pageBtnStyle(safePage>=totalPages)}>Next →</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function pageBtnStyle(disabled:boolean): React.CSSProperties {
//   return {
//     padding:"6px 12px",
//     background:"rgba(255,255,255,0.06)",
//     border:"1px solid rgba(255,255,255,0.15)",
//     borderRadius:radius.btn,
//     cursor:disabled?"not-allowed":"pointer",
//     color:disabled?"rgba(186,230,253,0.35)":"rgba(186,230,253,0.85)",
//     fontSize:13, fontFamily:fontStack,
//   };
// }

// /* ── Download Section ──────────────────────────────────────────────────────── */
// function DownloadSection({ predictions }: { predictions:Prediction[] }) {
//   const downloadCsv  = () => { const h="index,joule,kwh\n", rows=predictions.map(p=>`${p.index},${p.joule},${p.kwh}`).join("\n"); triggerDownload(h+rows,"predictions.csv","text/csv"); };
//   const downloadJson = () => { triggerDownload(JSON.stringify(predictions,null,2),"predictions.json","application/json"); };
//   const icon = (
//     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
//       strokeLinecap="round" strokeLinejoin="round" style={{ marginRight:6 }}>
//       <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
//       <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
//     </svg>
//   );
//   const btn: React.CSSProperties = {
//     flex:1, minWidth:200, padding:"12px 16px",
//     background:"rgba(255,255,255,0.07)",
//     color:"#67e8f9", border:"1px solid rgba(103,232,249,0.35)",
//     borderRadius:radius.btn, fontSize:14, fontWeight:500, cursor:"pointer",
//     display:"inline-flex", alignItems:"center", justifyContent:"center",
//     fontFamily:fontStack,
//   };
//   return (
//     <div style={{ display:"flex", gap:12, marginBottom:32, flexWrap:"wrap" }}>
//       <button className="sep-btn-outline" onClick={downloadCsv}  style={btn}>{icon}Download predictions CSV</button>
//       <button className="sep-btn-outline" onClick={downloadJson} style={btn}>{icon}Download predictions JSON</button>
//     </div>
//   );
// }

// function triggerDownload(content:string, filename:string, mime:string) {
//   const blob=new Blob([content],{type:mime}), url=URL.createObjectURL(blob);
//   const a=document.createElement("a"); a.href=url; a.download=filename;
//   document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
// }

// function PlaceholderCard({ text }: { text:string }) {
//   return (
//     <div style={{ ...glassCard, padding:24, textAlign:"center",
//       color:"rgba(186,230,253,0.5)", fontSize:13, marginBottom:24,
//       border:"1px dashed rgba(255,255,255,0.15)" }}>
//       {text}
//     </div>
//   );
// }

// /* ── Scatter DSWRF ─────────────────────────────────────────────────────────── */
// function ScatterDswrfSection({ predictions, scatter, chartReady }: {
//   predictions:Prediction[]; scatter?:ScatterDswrf[]; chartReady:boolean;
// }) {
//   if (!scatter||scatter.length===0) return <PlaceholderCard text="dswrf data not returned by API — add scatter_dswrf to backend response"/>;
//   const kwhByIdx=new Map(predictions.map(p=>[p.index,p.kwh]));
//   const pts=scatter.map(s=>({x:s.dswrf,y:kwhByIdx.get(s.index)??NaN})).filter(p=>isFinite(p.x)&&isFinite(p.y));
//   const n=pts.length; let slope=0,intercept=0,r2=0;
//   if(n>=2){
//     const sumX=pts.reduce((a,p)=>a+p.x,0),sumY=pts.reduce((a,p)=>a+p.y,0),
//       sumXY=pts.reduce((a,p)=>a+p.x*p.y,0),sumX2=pts.reduce((a,p)=>a+p.x*p.x,0),
//       denom=n*sumX2-sumX*sumX;
//     slope=denom!==0?(n*sumXY-sumX*sumY)/denom:0; intercept=(sumY-slope*sumX)/n;
//     const meanY=sumY/n,ssTot=pts.reduce((a,p)=>a+(p.y-meanY)**2,0),ssRes=pts.reduce((a,p)=>a+(p.y-(slope*p.x+intercept))**2,0);
//     r2=ssTot>0?1-ssRes/ssTot:0;
//   }
//   const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
//   const trend=[{x:minX,y:slope*minX+intercept},{x:maxX,y:slope*maxX+intercept}];
//   const r2Color=r2>0.7?COLORS.primary:r2>=0.4?COLORS.amber:COLORS.coral;
//   return (
//     <div className="sep-chart" style={{ ...glassCard, padding:16, marginBottom:24 }}>
//       <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
//         <div style={{ fontSize:14, fontWeight:600, color:"#fff" }}>Solar radiation effect on energy output</div>
//         <span style={{ background:`${r2Color}33`, color:r2Color, padding:"4px 10px", borderRadius:999, fontSize:12, fontWeight:600 }}>
//           R² = {r2.toFixed(3)}
//         </span>
//       </div>
//       <div style={{ height:340, position:"relative" }}>
//         <ScatterDswrfChart pts={pts} trend={trend} r2={r2} chartReady={chartReady}/>
//       </div>
//       {r2>0.5
//         ? <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(99,153,34,0.18)",
//             border:`1px solid ${COLORS.success}`, color:"#a3e06b", borderRadius:radius.btn, fontSize:13 }}>
//             Strong positive correlation detected. Solar radiation explains {(r2*100).toFixed(1)}% of variance in energy output.
//           </div>
//         : <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(239,159,39,0.18)",
//             border:`1px solid ${COLORS.amber}`, color:COLORS.amber, borderRadius:radius.btn, fontSize:13 }}>
//             Weak correlation — other weather factors may dominate energy output for this dataset.
//           </div>
//       }
//     </div>
//   );
// }

// function ScatterDswrfChart({ pts, trend, r2, chartReady }: {
//   pts:{x:number;y:number}[]; trend:{x:number;y:number}[]; r2:number; chartReady:boolean;
// }) {
//   const { scaleColor, gridColor } = chartDefaults();
//   const ref=useChart(()=>({
//     type:"scatter",
//     data:{ datasets:[
//       { label:`Observations (n=${pts.length})`, data:pts, backgroundColor:COLORS.amber,
//         borderColor:COLORS.warning, borderWidth:1, pointStyle:"circle", pointRadius:5, pointHoverRadius:7 },
//       { type:"line", label:`Trend (r² = ${r2.toFixed(3)})`, data:trend, borderColor:COLORS.primary,
//         borderDash:[5,4], borderWidth:2, pointRadius:0, fill:false, showLine:true },
//     ]},
//     options:{ responsive:true, maintainAspectRatio:false,
//       plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx:any)=>
//         ctx.datasetIndex===0
//           ?`Radiation: ${ctx.parsed.x.toFixed(1)} W/m²  |  Output: ${ctx.parsed.y.toFixed(2)} kWh`
//           :`Trend: ${ctx.parsed.y.toFixed(2)} kWh`
//       }}},
//       scales:{
//         x:{ title:{display:true,text:"Solar radiation (W/m²)",color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//         y:{ title:{display:true,text:"Energy output (kWh)",color:scaleColor}, beginAtZero:true, grid:{color:gridColor}, ticks:{color:scaleColor} },
//       },
//     },
//   }),[pts,trend,r2],chartReady);
//   return <canvas ref={ref}/>;
// }

// /* ── Clustering ────────────────────────────────────────────────────────────── */
// const CLUSTER_COLORS  = [COLORS.primary, COLORS.amber, COLORS.coral];
// const CLUSTER_BORDERS = ["#2c75c2", COLORS.warning, "#a13f1f"];
// const CLUSTER_SHAPES: ("circle"|"triangle"|"rectRot")[] = ["circle","triangle","rectRot"];
// const CLUSTER_SHAPE_LABEL = ["circle","triangle","diamond"];

// function ClusteringSection({ points, summary, variance, chartReady }: {
//   points?:ClusterPoint[]; summary?:ClusterSummary[]; variance?:number[]; chartReady:boolean;
// }) {
//   if (!points||points.length===0||!summary||summary.length===0)
//     return <PlaceholderCard text="Weather clustering unavailable — install scikit-learn and add clustering to the backend (see documentation)"/>;
//   const v0=variance?.[0]??0, v1=variance?.[1]??0;
//   const clusters=Array.from(new Set(points.map(p=>p.cluster))).sort();
//   const counts=new Map<number,number>();
//   points.forEach(p=>counts.set(p.cluster,(counts.get(p.cluster)||0)+1));
//   const best=summary.reduce((a,b)=>b.avg_kwh>a.avg_kwh?b:a);
//   return (
//     <div style={{ marginBottom:24 }}>
//       <div style={{ fontSize:16, fontWeight:600, color:"#ffffff", marginBottom:12 }}>Weather clustering</div>
//       <div style={{ display:"grid", gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr)", gap:16 }} className="sep-clustering-grid">
//         <style>{`@media (max-width:768px){.sep-clustering-grid{grid-template-columns:1fr!important}}`}</style>
//         <div className="sep-chart" style={{ ...glassCard, padding:16 }}>
//           <div style={{ fontSize:14, fontWeight:600, color:"#fff", marginBottom:10 }}>Weather profiles in PCA space</div>
//           <div style={{ display:"flex", flexWrap:"wrap", gap:14, fontSize:12, color:"rgba(186,230,253,0.7)", marginBottom:10 }}>
//             {clusters.map(c=>(
//               <span key={c} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
//                 <ClusterShape cluster={c}/> Cluster {c} — {counts.get(c)||0} rows
//               </span>
//             ))}
//           </div>
//           <div style={{ height:320, position:"relative" }}>
//             <PcaScatterChart points={points} chartReady={chartReady} v0={v0} v1={v1}/>
//           </div>
//         </div>
//         <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
//           {summary.map(s=><ClusterSummaryCard key={s.cluster} s={s} maxAvg={Math.max(...summary.map(x=>x.avg_kwh))}/>)}
//         </div>
//       </div>
//       <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(99,153,34,0.18)",
//         border:`1px solid ${COLORS.success}`, color:"#a3e06b", borderRadius:radius.btn, fontSize:13 }}>
//         Cluster {best.cluster} produces the most energy on average ({fmtNum(best.avg_kwh,3)} kWh/period) — likely corresponds to clear-sky, high-radiation days.
//       </div>
//     </div>
//   );
// }

// function ClusterShape({ cluster }: { cluster:number }) {
//   const color=CLUSTER_COLORS[cluster%CLUSTER_COLORS.length];
//   const shape=CLUSTER_SHAPE_LABEL[cluster%CLUSTER_SHAPE_LABEL.length];
//   if(shape==="triangle") return <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,11 1,11" fill={color}/></svg>;
//   if(shape==="diamond")  return <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,6 6,11 1,6" fill={color}/></svg>;
//   return <span style={{ width:12, height:12, background:color, borderRadius:"50%", display:"inline-block" }}/>;
// }

// function ClusterSummaryCard({ s, maxAvg }: { s:ClusterSummary; maxAvg:number }) {
//   const color=CLUSTER_COLORS[s.cluster%CLUSTER_COLORS.length];
//   const pct=maxAvg>0?(s.avg_kwh/maxAvg)*100:0;
//   const weather=getWeatherProfile(s.avg_kwh,s.cluster);
//   return (
//     <div style={{ ...glassCard, padding:14 }}>
//       <div style={{ display:"inline-block", background:`${color}33`, color, padding:"3px 10px",
//         borderRadius:999, fontSize:12, fontWeight:600, marginBottom:10 }}>
//         Cluster {s.cluster}
//       </div>
//       <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(186,230,253,0.6)", marginBottom:4 }}>
//         <span>Periods analyzed</span>
//         <strong style={{ color:"#fff" }}>{s.count}</strong>
//       </div>
//       <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:999,
//         fontSize:12, fontWeight:600, background:`${weather.color}33`, color:weather.color, marginBottom:10 }}>
//         <span>{weather.emoji}</span><span>{weather.label} Weather</span>
//       </div>
//       <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
//         <span style={{ fontSize:12, color:"rgba(186,230,253,0.6)" }}>Average output</span>
//         <span style={{ fontSize:20, fontWeight:600, color }}>{fmtNum(s.avg_kwh,3)} kWh</span>
//       </div>
//       <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(186,230,253,0.6)", marginBottom:8 }}>
//         <span>Range</span>
//         <span style={{ color:"rgba(186,230,253,0.9)" }}>{fmtNum(s.min_kwh,3)} – {fmtNum(s.max_kwh,3)} kWh</span>
//       </div>
//       <div style={{ height:6, background:"rgba(255,255,255,0.1)", borderRadius:999, overflow:"hidden" }}>
//         <div style={{ width:`${pct}%`, height:"100%", background:color, transition:"width 600ms ease" }}/>
//       </div>
//     </div>
//   );
// }

// function PcaScatterChart({ points, chartReady, v0, v1 }: {
//   points:ClusterPoint[]; chartReady:boolean; v0:number; v1:number;
// }) {
//   const { scaleColor, gridColor } = chartDefaults();
//   const ref=useChart(()=>{
//     const byCluster=new Map<number,ClusterPoint[]>();
//     points.forEach(p=>{ if(!byCluster.has(p.cluster))byCluster.set(p.cluster,[]); byCluster.get(p.cluster)!.push(p); });
//     const datasets=Array.from(byCluster.entries()).sort((a,b)=>a[0]-b[0]).map(([cluster,pts])=>({
//       label:`Cluster ${cluster}`, data:pts.map(p=>({x:p.pc1,y:p.pc2,_raw:p})),
//       backgroundColor:CLUSTER_COLORS[cluster%CLUSTER_COLORS.length],
//       borderColor:CLUSTER_BORDERS[cluster%CLUSTER_BORDERS.length],
//       borderWidth:1.5, pointStyle:CLUSTER_SHAPES[cluster%CLUSTER_SHAPES.length],
//       pointRadius:7, pointHoverRadius:9,
//     }));
//     return {
//       type:"scatter", data:{datasets},
//       options:{ responsive:true, maintainAspectRatio:false,
//         plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx:any)=>{
//           const raw=ctx.raw?._raw as ClusterPoint|undefined;
//           if(!raw)return"";
//           return `Cluster ${raw.cluster}  |  PC1: ${raw.pc1.toFixed(2)}  PC2: ${raw.pc2.toFixed(2)}  Energy: ${raw.kwh.toFixed(4)} kWh`;
//         }}}},
//         scales:{
//           x:{ title:{display:true,text:`PC1 (${(v0*100).toFixed(1)}% variance explained)`,color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//           y:{ title:{display:true,text:`PC2 (${(v1*100).toFixed(1)}% variance explained)`,color:scaleColor}, grid:{color:gridColor}, ticks:{color:scaleColor} },
//         },
//       },
//     };
//   },[points,v0,v1],chartReady);
//   return <canvas ref={ref}/>;
// }
// }
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Single background photo — place in public/
import bgImg from "/Solar-renewables-AdobeStock_279073423-min.webp";

export const Route = createFileRoute("/predict")({
  component: App,
});

const API_BASE = "http://localhost:5000";
const CHART_CDN = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";

const COLORS = {
  bg: "#F5F4EF",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.1)",
  text: "#1a1a1a",
  muted: "#6b6b6b",
  primary: "#378ADD",
  success: "#639922",
  warning: "#BA7517",
  coral: "#D85A30",
  amber: "#EF9F27",
  rowAlt: "#F9F8F5",
  rowHover: "#EAF3DE",
};

// ── Per-horizon identity — used consistently across KPIs, charts, table, badges
const HORIZONS = ["H1", "H6", "H24"];
const HORIZON_META = {
  H1:  { label: "H+1",  fullLabel: "1 heure",   model: "XGBoost",       color: "#378ADD", soft: "rgba(55,138,221,0.18)" },
  H6:  { label: "H+6",  fullLabel: "6 heures",  model: "Random Forest",      color: "#EF9F27", soft: "rgba(239,159,39,0.18)" },
  H24: { label: "H+24", fullLabel: "24 heures", model: "Random Forest", color: "#639922", soft: "rgba(99,153,34,0.18)" },
};

const radius = { card: 14, btn: 8 };
const shadow = "0 1px 3px rgba(0,0,0,0.08)";
const fontStack = "system-ui, -apple-system, sans-serif";

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("ssr"));
    const w = window;
    if (w.Chart) return resolve(w.Chart);
    const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(w.Chart));
      existing.addEventListener("error", () => reject(new Error("load fail")));
      return;
    }
    const s = document.createElement("script");
    s.src = CHART_CDN;
    s.async = true;
    s.onload = () => resolve(w.Chart);
    s.onerror = () => reject(new Error("load fail"));
    document.head.appendChild(s);
  });
}

function easeOutQuad(t) {
  return t * (2 - t);
}

function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!isFinite(target)) { setVal(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(target * easeOutQuad(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function fmtNum(n, decimals = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
function fmtKW(k) { return `${fmtNum(k, 2)} kW`; }

/*
  ── API response shape (matches app.py exactly) ────────────────────────────
  Prediction   = { index, datetime, pred_H1_kW, pred_H6_kW, pred_H24_kW }
  Kpis         = { H1: {...}, H6: {...}, H24: {...} }   one block per horizon
  HorizonKpi   = { model, horizon_hours, avg_kW, max_kW, min_kW, n_rows }
  CsvInfo      = { n_rows, n_cols, columns, has_pv_production }
  ApiResp      = { success, warnings, csv_info, kpis, predictions }
*/

/* ─────────────────────────────────────────────
   APP
───────────────────────────────────────────── */
function App() {
  const [health, setHealth]         = useState("loading");
  const [file, setFile]             = useState(null);
  const [rowCount, setRowCount]     = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [data, setData]             = useState(null);
  const [warningsOpen, setWarningsOpen] = useState(true);
  const [csvInfoOpen, setCsvInfoOpen]   = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let ok = true;
    fetch(`${API_BASE}/api/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((j) => ok && setHealth(j.models_loaded ? "ok" : "error"))
      .catch(() => ok && setHealth("error"));
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    loadChartJs().then(() => setChartReady(true)).catch(() => setChartReady(false));
  }, []);

  const onFile = useCallback(async (f) => {
    setError(null); setFile(f); setRowCount(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) { setError("Merci de sélectionner un fichier .csv"); setFile(null); return; }
    try {
      const text  = await f.text();
      const lines = text.split(/\r?\n/).filter(l => l.length > 0);
      setRowCount(Math.max(0, lines.length - 1));
    } catch { setRowCount(null); }
  }, []);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Échec de la requête (${res.status})`;
        try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
        throw new Error(msg);
      }
      const json = await res.json();
      if (!json.success) throw new Error("L'API a retourné une réponse en échec");
      setData(json); setWarningsOpen(true);
    } catch (e) {
      setError(e.message || "L'analyse a échoué");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null); setRowCount(null); setData(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; color: var(--color-text-primary); font-family: ${fontStack}; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadein  { from { opacity:0; } to { opacity:1; } }
        @keyframes slideup { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes kb-predict { from { transform:scale(1.06) translate(0,0); } to { transform:scale(1.00) translate(-10px,-5px); } }
        @keyframes scan-line  { 0%{top:0;opacity:.35} 50%{opacity:.7} 100%{top:100%;opacity:.15} }

        .sep-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block; }
        .sep-row     { animation:slideup 350ms ease-out both; }
        .sep-chart   { animation:fadein 400ms ease-out both; }
        .sep-table-row:hover          { background:${COLORS.rowHover} !important; }
        .sep-btn-primary:hover:not(:disabled) { background:#2c75c2; }
        .sep-btn-outline:hover        { background:rgba(55,138,221,0.08); }
        .sep-page-btn:hover:not(:disabled)    { background:rgba(0,0,0,0.04); }
      `}</style>

      {/* ── FIXED BACKGROUND: single photo ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <img
          src={bgImg}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
            animation: "kb-predict 18s ease-out infinite alternate",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(2,10,22,0.72) 0%, rgba(2,14,30,0.80) 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(6,182,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div style={{
          position: "absolute", left: 0, right: 0, height: 2, pointerEvents: "none",
          background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.25),transparent)",
          animation: "scan-line 12s linear infinite",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(2,10,22,0.6) 0%, transparent 40%)",
        }} />
      </div>

      {/* ── CONTENT ── */}
      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        padding: "24px 16px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <Header health={health} />
        <UploadZone
          file={file} rowCount={rowCount} dragging={dragging} loading={loading}
          error={error} hasResults={!!data}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onPick={() => fileInputRef.current?.click()}
          onFile={onFile} onAnalyze={analyze} onReset={reset} fileInputRef={fileInputRef}
        />
        {data && (
          <Results
            data={data} chartReady={chartReady}
            warningsOpen={warningsOpen} setWarningsOpen={setWarningsOpen}
            csvInfoOpen={csvInfoOpen} setCsvInfoOpen={setCsvInfoOpen}
          />
        )}
      </div>
    </>
  );
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
function Header({ health }) {
  const dotColor = health === "ok" ? COLORS.success : health === "error" ? COLORS.coral : "#aaa";
  const label    = health === "ok" ? "API connectée — 3 modèles chargés" : health === "error" ? "API hors ligne" : "Vérification…";
  return (
    <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:32 }}>☀️</div>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:600, color:"#ffffff" }}>SolarForecast AI</h1>
          <div style={{ fontSize:13, color:"rgba(186,230,253,0.75)" }}>Prévision multi-horizon H+1 · H+6 · H+24</div>
        </div>
      </div>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:8,
        padding:"6px 12px",
        background:"rgba(255,255,255,0.08)",
        backdropFilter:"blur(8px)",
        border:"1px solid rgba(255,255,255,0.15)",
        borderRadius:999, fontSize:13, fontWeight:500,
        color:"#fff", boxShadow:shadow,
      }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor, boxShadow:`0 0 0 3px ${dotColor}44` }} />
        {label}
      </div>
    </header>
  );
}

/* ── Upload Zone ────────────────────────────────────────────────────────────── */
function UploadZone(props) {
  const { file, rowCount, dragging, loading, error, hasResults,
          onDragOver, onDragLeave, onDrop, onPick, onFile, onAnalyze, onReset, fileInputRef } = props;
  return (
    <section style={{
      background:"rgba(255,255,255,0.08)",
      backdropFilter:"blur(16px) saturate(160%)",
      WebkitBackdropFilter:"blur(16px) saturate(160%)",
      border:"1px solid rgba(255,255,255,0.15)",
      borderRadius:radius.card, padding:24, boxShadow:shadow, marginBottom:24,
    }}>
      <div
        onClick={onPick} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        style={{
          border:`2px ${dragging?"solid":"dashed"} ${dragging?"#06b6d4":COLORS.primary}`,
          borderRadius:radius.card, padding:"40px 20px", textAlign:"center", cursor:"pointer",
          background:dragging?"rgba(6,182,212,0.08)":"rgba(255,255,255,0.04)",
          transition:"all 150ms ease",
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:12 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div style={{ fontSize:16, fontWeight:500, color:"#ffffff" }}>
          {file ? file.name : "Déposez votre CSV météo ici"}
        </div>
        <div style={{ fontSize:13, color:"rgba(186,230,253,0.7)", marginTop:4 }}>
          {file
            ? (rowCount !== null ? `${rowCount.toLocaleString()} lignes détectées` : "Lecture du fichier…")
            : "colonnes attendues : datetime, temperature, humidity, solar_irradiance, atm_irradiance"}
        </div>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display:"none" }}
          onChange={e => onFile(e.target.files?.[0] || null)} />
      </div>

      {error && (
        <div style={{ marginTop:16, padding:"12px 14px", background:"rgba(216,90,48,0.18)",
          border:`1px solid ${COLORS.coral}`, color:"#ffb09a", borderRadius:radius.btn, fontSize:14 }}>
          {error}
        </div>
      )}

      <div style={{ display:"flex", gap:12, marginTop:16 }}>
        <button
          className="sep-btn-primary" onClick={onAnalyze} disabled={!file||loading}
          style={{
            flex:1, height:44,
            background:!file||loading?"#2c5a8a":COLORS.primary,
            color:"#fff", border:"none", borderRadius:radius.btn,
            fontSize:15, fontWeight:500,
            cursor:!file||loading?"not-allowed":"pointer",
            display:"inline-flex", alignItems:"center", justifyContent:"center", gap:10,
            transition:"background 150ms ease", fontFamily:fontStack,
          }}
        >
          {loading ? (<><span className="sep-spinner"/>Prédiction en cours…</>) : "Analyser"}
        </button>
        {hasResults && (
          <button
            className="sep-btn-outline" onClick={onReset}
            style={{
              height:44, padding:"0 20px",
              background:"rgba(255,255,255,0.06)",
              color:"#67e8f9",
              border:"1px solid rgba(103,232,249,0.4)",
              borderRadius:radius.btn, fontSize:15, fontWeight:500,
              cursor:"pointer", fontFamily:fontStack,
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Results ────────────────────────────────────────────────────────────────── */
function Results({ data, chartReady, warningsOpen, setWarningsOpen, csvInfoOpen, setCsvInfoOpen }) {
  const { kpis, predictions, warnings, csv_info } = data;
  return (
    <div>
      {warnings && warnings.length > 0 && (
        <div style={{ background:"rgba(186,117,23,0.15)", border:`1px solid ${COLORS.warning}`,
          borderRadius:radius.card, padding:16, marginBottom:20 }}>
          <button onClick={() => setWarningsOpen(!warningsOpen)}
            style={{ background:"none", border:"none", color:COLORS.amber, fontWeight:600,
              cursor:"pointer", padding:0, fontSize:14, fontFamily:fontStack }}>
            {warningsOpen?"▼":"▶"} {warnings.length} avertissement{warnings.length===1?"":"s"}
          </button>
          {warningsOpen && (
            <ul style={{ margin:"10px 0 0 20px", padding:0, color:COLORS.amber, fontSize:13 }}>
              {warnings.map((w,i)=><li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
      <CsvInfoPanel info={csv_info} open={csvInfoOpen} setOpen={setCsvInfoOpen} />
      <HorizonKpiGrid kpis={kpis} />
      <MultiHorizonChart predictions={predictions} chartReady={chartReady} />
      <HorizonDistributionSection predictions={predictions} chartReady={chartReady} />
      <DailyProfileSection predictions={predictions} chartReady={chartReady} />
      <HorizonSpreadSection predictions={predictions} chartReady={chartReady} />
      <PredictionsTable predictions={predictions} />
      <DownloadSection predictions={predictions} />
    </div>
  );
}

/* ── Shared glass card style ─────────────────────────────────────────────────── */
const glassCard = {
  background:"rgba(255,255,255,0.09)",
  backdropFilter:"blur(16px) saturate(160%)",
  WebkitBackdropFilter:"blur(16px) saturate(160%)",
  border:"1px solid rgba(255,255,255,0.15)",
  borderRadius:radius.card,
  boxShadow:"0 4px 24px rgba(0,0,0,0.35)",
  color:"#fff",
};

/* ── CSV Info Panel ─────────────────────────────────────────────────────────── */
function CsvInfoPanel({ info, open, setOpen }) {
  return (
    <div style={{ ...glassCard, padding:16, marginBottom:20 }}>
      <button onClick={() => setOpen(!open)} style={{ background:"none", border:"none", padding:0,
        cursor:"pointer", fontSize:14, fontWeight:600, color:"#fff", fontFamily:fontStack }}>
        {open?"▼":"▶"} Infos CSV
      </button>
      {open && (
        <div style={{ marginTop:12, fontSize:13, color:"rgba(186,230,253,0.75)" }}>
          <div style={{ marginBottom:8 }}>
            <strong style={{ color:"#fff" }}>Lignes :</strong> {info.n_rows.toLocaleString()} ·{" "}
            <strong style={{ color:"#fff" }}>Colonnes :</strong> {info.n_cols} ·{" "}
            <strong style={{ color:"#fff" }}>Historique pv_production :</strong>{" "}
            <span style={{ color: info.has_pv_production ? "#a3e06b" : COLORS.amber }}>
              {info.has_pv_production ? "fourni" : "absent"}
            </span>
          </div>
          <div>
            <strong style={{ color:"#fff" }}>Colonnes :</strong>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
              {info.columns.map(c => (
                <span key={c} style={{ background:"rgba(255,255,255,0.1)", color:"#e2f0ff",
                  padding:"3px 8px", borderRadius:6, fontSize:12 }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI Grid — one block per horizon ─────────────────────────────────────────── */
function HorizonKpiGrid({ kpis }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:16, fontWeight:600, color:"#ffffff", marginBottom:12 }}>Production prédite par horizon</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
        {HORIZONS.map((h, i) => <HorizonKpiCard key={h} hKey={h} kpi={kpis[h]} delay={i*80} />)}
      </div>
    </div>
  );
}

function HorizonKpiCard({ hKey, kpi, delay }) {
  const meta = HORIZON_META[hKey];
  const avg = useCountUp(kpi?.avg_kW || 0, 800);
  const max = useCountUp(kpi?.max_kW || 0, 800);
  const min = useCountUp(kpi?.min_kW || 0, 800);
  return (
    <div className="sep-row" style={{ ...glassCard, padding:18, animationDelay:`${delay}ms`, borderTop:`3px solid ${meta.color}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:15, fontWeight:700, color: meta.color }}>{meta.label}</span>
        <span style={{ background: meta.soft, color: meta.color, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:600 }}>
          {meta.model}
        </span>
      </div>
      <div style={{ fontSize:28, fontWeight:600, color:"#ffffff", lineHeight:1.1, marginBottom:10 }}>
        {fmtNum(avg, 2)} <span style={{ fontSize:14, fontWeight:400, color:"rgba(186,230,253,0.6)" }}>kW moy.</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(186,230,253,0.65)" }}>
        <span>Min <strong style={{ color:"#fff" }}>{fmtNum(min,1)} kW</strong></span>
        <span>Max <strong style={{ color:"#fff" }}>{fmtNum(max,1)} kW</strong></span>
        <span>n=<strong style={{ color:"#fff" }}>{kpi?.n_rows ?? 0}</strong></span>
      </div>
    </div>
  );
}

/* ── Charts shared infra ──────────────────────────────────────────────────────── */
function ChartCard({ title, subtitle, height, children }) {
  return (
    <div style={{ ...glassCard, padding:16 }}>
      <div style={{ fontSize:14, fontWeight:600, color:"#ffffff" }}>{title}</div>
      {subtitle && <div style={{ fontSize:12, color:"rgba(186,230,253,0.6)", marginTop:2, marginBottom:10 }}>{subtitle}</div>}
      <div style={{ height, position:"relative", marginTop: subtitle ? 0 : 12 }}>{children}</div>
    </div>
  );
}

function useChart(builder, deps, chartReady) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  useEffect(() => {
    if (!chartReady) return;
    const w = window;
    if (!w.Chart || !canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new w.Chart(canvasRef.current, builder());
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, ...deps]);
  return canvasRef;
}

function chartDefaults() {
  return {
    color: "rgba(186,230,253,0.8)",
    scaleColor: "rgba(186,230,253,0.6)",
    gridColor: "rgba(255,255,255,0.06)",
  };
}

/* ── Multi-horizon overlay line chart ─────────────────────────────────────────── */
function MultiHorizonChart({ predictions, chartReady }) {
  return (
    <div className="sep-chart" style={{ marginBottom:16 }}>
      <ChartCard title="Production prédite dans le temps" subtitle="H+1, H+6 et H+24 superposés" height={320}>
        <MultiHorizonLineChart predictions={predictions} chartReady={chartReady} />
      </ChartCard>
    </div>
  );
}

function MultiHorizonLineChart({ predictions, chartReady }) {
  const ref = useChart(() => {
    const { scaleColor, gridColor } = chartDefaults();
    return {
      type: "line",
      data: {
        labels: predictions.map(p => p.index),
        datasets: HORIZONS.map(h => ({
          label: HORIZON_META[h].label,
          data: predictions.map(p => p[`pred_${h}_kW`]),
          borderColor: HORIZON_META[h].color,
          backgroundColor: HORIZON_META[h].soft,
          fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: { color: scaleColor, boxWidth: 14 } },
          tooltip: { mode: "index", intersect: false },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { title: { display: true, text: "Index (heure)", color: scaleColor }, grid: { color: gridColor }, ticks: { color: scaleColor } },
          y: { title: { display: true, text: "Production (kW)", color: scaleColor }, beginAtZero: true, grid: { color: gridColor }, ticks: { color: scaleColor } },
        },
      },
    };
  }, [predictions], chartReady);
  return <canvas ref={ref} />;
}

/* ── Distribution per horizon (3 histograms side by side) ────────────────────── */
function HorizonDistributionSection({ predictions, chartReady }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:16, fontWeight:600, color:"#ffffff", marginBottom:12 }}>Distribution des valeurs prédites</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
        {HORIZONS.map((h, i) => (
          <div key={h} className="sep-chart" style={{ animationDelay:`${i*100}ms` }}>
            <ChartCard title={`Histogramme — ${HORIZON_META[h].label}`} height={220}>
              <HorizonHistogram predictions={predictions} hKey={h} chartReady={chartReady} />
            </ChartCard>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizonHistogram({ predictions, hKey, chartReady }) {
  const ref = useChart(() => {
    const { scaleColor, gridColor } = chartDefaults();
    const vals = predictions.map(p => p[`pred_${hKey}_kW`]);
    const min = Math.min(...vals), max = Math.max(...vals), buckets = 8, step = (max - min) / buckets || 1;
    const counts = new Array(buckets).fill(0), labels = [];
    for (let i = 0; i < buckets; i++) labels.push(`${(min + step*i).toFixed(0)}`);
    vals.forEach(v => { let idx = Math.floor((v - min) / step); if (idx >= buckets) idx = buckets - 1; if (idx < 0) idx = 0; counts[idx]++; });
    return {
      type: "bar",
      data: { labels, datasets: [{ data: counts, backgroundColor: HORIZON_META[hKey].color, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, color: scaleColor }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "Occurrences", color: scaleColor }, grid: { color: gridColor }, ticks: { color: scaleColor } },
        },
      },
    };
  }, [predictions, hKey], chartReady);
  return <canvas ref={ref} />;
}

/* ── Daily average profile per horizon (derived from datetime hour) ──────────── */
function DailyProfileSection({ predictions, chartReady }) {
  const hasDatetime = predictions.length > 0 && !!predictions[0].datetime;
  if (!hasDatetime) return null;
  return (
    <div className="sep-chart" style={{ marginBottom:16 }}>
      <ChartCard title="Profil horaire moyen" subtitle="Production moyenne prédite par heure de la journée, pour chaque horizon" height={300}>
        <DailyProfileChart predictions={predictions} chartReady={chartReady} />
      </ChartCard>
    </div>
  );
}

function DailyProfileChart({ predictions, chartReady }) {
  const ref = useChart(() => {
    const { scaleColor, gridColor } = chartDefaults();
    const sums = HORIZONS.reduce((acc, h) => ({ ...acc, [h]: new Array(24).fill(0) }), {});
    const counts = new Array(24).fill(0);
    predictions.forEach(p => {
      const hour = new Date(p.datetime.replace(" ", "T")).getHours();
      if (isNaN(hour)) return;
      counts[hour]++;
      HORIZONS.forEach(h => { sums[h][hour] += p[`pred_${h}_kW`]; });
    });
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,"0")}h`);
    return {
      type: "line",
      data: {
        labels,
        datasets: HORIZONS.map(h => ({
          label: HORIZON_META[h].label,
          data: sums[h].map((s, i) => counts[i] > 0 ? s / counts[i] : 0),
          borderColor: HORIZON_META[h].color,
          backgroundColor: HORIZON_META[h].soft,
          fill: false, tension: 0.4, pointRadius: 3, borderWidth: 2,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: { color: scaleColor, boxWidth: 14 } } },
        scales: {
          x: { title: { display: true, text: "Heure de la journée", color: scaleColor }, grid: { color: gridColor }, ticks: { color: scaleColor } },
          y: { title: { display: true, text: "Production moyenne (kW)", color: scaleColor }, beginAtZero: true, grid: { color: gridColor }, ticks: { color: scaleColor } },
        },
      },
    };
  }, [predictions], chartReady);
  return <canvas ref={ref} />;
}

/* ── Spread between horizons — how much H6/H24 diverge from H1 ───────────────── */
function HorizonSpreadSection({ predictions, chartReady }) {
  return (
    <div className="sep-chart" style={{ marginBottom:24 }}>
      <ChartCard
        title="Écart entre horizons"
        subtitle="Différence (kW) entre H+6/H+24 et H+1 — mesure l'incertitude qui grandit avec l'horizon"
        height={260}
      >
        <HorizonSpreadChart predictions={predictions} chartReady={chartReady} />
      </ChartCard>
    </div>
  );
}

function HorizonSpreadChart({ predictions, chartReady }) {
  const ref = useChart(() => {
    const { scaleColor, gridColor } = chartDefaults();
    return {
      type: "line",
      data: {
        labels: predictions.map(p => p.index),
        datasets: [
          {
            label: "H+6 − H+1",
            data: predictions.map(p => p.pred_H6_kW - p.pred_H1_kW),
            borderColor: HORIZON_META.H6.color, backgroundColor: HORIZON_META.H6.soft,
            fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
          },
          {
            label: "H+24 − H+1",
            data: predictions.map(p => p.pred_H24_kW - p.pred_H1_kW),
            borderColor: HORIZON_META.H24.color, backgroundColor: HORIZON_META.H24.soft,
            fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: { color: scaleColor, boxWidth: 14 } } },
        scales: {
          x: { title: { display: true, text: "Index (heure)", color: scaleColor }, grid: { color: gridColor }, ticks: { color: scaleColor } },
          y: { title: { display: true, text: "Écart (kW)", color: scaleColor }, grid: { color: gridColor }, ticks: { color: scaleColor } },
        },
      },
    };
  }, [predictions], chartReady);
  return <canvas ref={ref} />;
}

/* ── Predictions Table ─────────────────────────────────────────────────────── */
function PredictionsTable({ predictions }) {
  const [search,setSearch] = useState("");
  const [sortKey,setSortKey] = useState("index");
  const [sortDir,setSortDir] = useState("asc");
  const [page,setPage] = useState(1);
  const PER = 10;

  const filtered = predictions.filter(p => {
    if (!search.trim()) return true;
    const s = search.trim();
    const m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const a=parseFloat(m[1]),b=parseFloat(m[2]);
      return (p.index>=a&&p.index<=b)||(p.pred_H1_kW>=a&&p.pred_H1_kW<=b);
    }
    return String(p.index).includes(s) || (p.datetime||"").includes(s);
  });
  const sorted = [...filtered].sort((a,b)=>sortDir==="asc"?a[sortKey]-b[sortKey]:b[sortKey]-a[sortKey]);
  const totalPages = Math.max(1,Math.ceil(sorted.length/PER));
  const safePage   = Math.min(page,totalPages);
  const pageRows   = sorted.slice((safePage-1)*PER, safePage*PER);
  const toggleSort = (k) => { if(sortKey===k)setSortDir(sortDir==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} };
  const arrow      = (k) => sortKey===k?(sortDir==="asc"?" ▲":" ▼"):"";

  const cols = [
    { key:"index", label:"Index" },
    { key:"datetime", label:"Date/Heure", sortable:false },
    { key:"pred_H1_kW", label:"H+1 (kW)" },
    { key:"pred_H6_kW", label:"H+6 (kW)" },
    { key:"pred_H24_kW", label:"H+24 (kW)" },
  ];

  return (
    <div style={{ ...glassCard, padding:16, marginBottom:24 }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:14, color:"rgba(186,230,253,0.7)" }}>
          Affichage de <strong style={{ color:"#fff" }}>{filtered.length.toLocaleString()}</strong> sur{" "}
          <strong style={{ color:"#fff" }}>{predictions.length.toLocaleString()}</strong> prédictions
        </div>
        <input
          value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
          placeholder="Filtrer (ex. 5.2 ou 0-100)"
          style={{ padding:"8px 12px", border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:radius.btn, fontSize:13, outline:"none", minWidth:220,
            background:"rgba(255,255,255,0.08)", color:"#fff", fontFamily:fontStack }}
        />
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"rgba(255,255,255,0.06)" }}>
              {cols.map(c => (
                <th key={c.key} onClick={()=> c.sortable!==false && toggleSort(c.key)}
                  style={{ textAlign:"left", padding:"10px 12px", fontWeight:600,
                    cursor: c.sortable!==false ? "pointer" : "default",
                    color:"rgba(186,230,253,0.9)", userSelect:"none",
                    borderBottom:"1px solid rgba(255,255,255,0.12)" }}>
                  {c.label}{c.sortable!==false ? arrow(c.key) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p,i) => (
              <tr key={p.index} className="sep-table-row sep-row"
                style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.04)",
                  animationDelay:`${i*20}ms`, transition:"background 100ms" }}>
                <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"#fff" }}>{p.index}</td>
                <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color:"rgba(186,230,253,0.8)", fontSize:12 }}>{p.datetime}</td>
                <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color: HORIZON_META.H1.color, fontWeight:500 }}>{fmtKW(p.pred_H1_kW)}</td>
                <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color: HORIZON_META.H6.color, fontWeight:500 }}>{fmtKW(p.pred_H6_kW)}</td>
                <td style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", color: HORIZON_META.H24.color, fontWeight:500 }}>{fmtKW(p.pred_H24_kW)}</td>
              </tr>
            ))}
            {pageRows.length===0 && (
              <tr><td colSpan={5} style={{ padding:24, textAlign:"center", color:"rgba(186,230,253,0.5)" }}>Aucune ligne correspondante</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, fontSize:13 }}>
        <div style={{ color:"rgba(186,230,253,0.6)" }}>Page {safePage} sur {totalPages}</div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="sep-page-btn" onClick={()=>setPage(Math.max(1,safePage-1))} disabled={safePage<=1} style={pageBtnStyle(safePage<=1)}>← Préc.</button>
          <button className="sep-page-btn" onClick={()=>setPage(Math.min(totalPages,safePage+1))} disabled={safePage>=totalPages} style={pageBtnStyle(safePage>=totalPages)}>Suiv. →</button>
        </div>
      </div>
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    padding:"6px 12px",
    background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.15)",
    borderRadius:radius.btn,
    cursor:disabled?"not-allowed":"pointer",
    color:disabled?"rgba(186,230,253,0.35)":"rgba(186,230,253,0.85)",
    fontSize:13, fontFamily:fontStack,
  };
}

/* ── Download Section ──────────────────────────────────────────────────────── */
function DownloadSection({ predictions }) {
  const downloadCsv  = () => {
    const h = "index,datetime,pred_H1_kW,pred_H6_kW,pred_H24_kW\n";
    const rows = predictions.map(p => `${p.index},${p.datetime},${p.pred_H1_kW},${p.pred_H6_kW},${p.pred_H24_kW}`).join("\n");
    triggerDownload(h+rows, "predictions_solarforecast.csv", "text/csv");
  };
  const downloadJson = () => { triggerDownload(JSON.stringify(predictions,null,2), "predictions_solarforecast.json", "application/json"); };
  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight:6 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
  const btn = {
    flex:1, minWidth:200, padding:"12px 16px",
    background:"rgba(255,255,255,0.07)",
    color:"#67e8f9", border:"1px solid rgba(103,232,249,0.35)",
    borderRadius:radius.btn, fontSize:14, fontWeight:500, cursor:"pointer",
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    fontFamily:fontStack,
  };
  return (
    <div style={{ display:"flex", gap:12, marginBottom:32, flexWrap:"wrap" }}>
      <button className="sep-btn-outline" onClick={downloadCsv}  style={btn}>{icon}Télécharger les prédictions (CSV)</button>
      <button className="sep-btn-outline" onClick={downloadJson} style={btn}>{icon}Télécharger les prédictions (JSON)</button>
    </div>
  );
}

function triggerDownload(content, filename, mime) {
  const blob=new Blob([content],{type:mime}), url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
