




import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// ── Photo imports — copy these 3 files into your project's public/ folder
// images.jpg                                      → slide 1 (blue sky panels)
// Solar-renewables-AdobeStock_279073423-min.webp  → slide 2 (sunset panels)
// future-of-solar-cover.jpg                       → slide 3 (angled bright panels)
import slide1Img from "/public/solarpowerma_cover.jpg";
import slide2Img from "/public/Solar-renewables-AdobeStock_279073423-min.webp";
import slide3Img from "/public/future-of-solar-cover.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

/* ─── Particle Canvas ──────────────────────────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.4 + 0.3,
      speedX: (Math.random() - 0.5) * 0.28,
      speedY: (Math.random() - 0.5) * 0.28,
      opacity: Math.random() * 0.45 + 0.1,
    }));
    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "#06b6d4";
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(6,182,212,${0.07 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
    />
  );
}

/* ─── Wind Icon ────────────────────────────────────────────────────────────── */
function WindIcon({ color = "#06b6d4" }: { color?: string }) {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" fill="none">
      <path d="M2 4 Q10 4 14 4 Q20 4 22 2 Q24 0 22 0 Q18 0 18 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M2 9 Q12 9 18 9 Q22 9 24 7 Q26 5 24 5 Q20 5 20 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M2 14 Q10 14 16 14 Q20 14 22 16 Q24 18 22 18 Q18 18 18 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ─── Slides config ─────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    img: slide1Img,
    overlay: "linear-gradient(to right, rgba(2,10,22,0.84) 42%, rgba(2,10,22,0.32) 100%)",
    label: "BIENVENUE CHEZ",
    title: "Solar Energy ",
    subtitle: "Prédiction de la Production par Intelligence Artificielle et Données Météorologiques",
    cta: "EN SAVOIR PLUS",
    ctaTo: "/predict",
  },
  {
    img: slide2Img,
    overlay: "linear-gradient(to right, rgba(8,4,2,0.82) 42%, rgba(8,4,2,0.28) 100%)",
    label: "",
    title: "Solar Energy ",
    subtitle: "Prédiction de la Production par Intelligence Artificielle et Données Météorologiques",
    cta: "predict",
    ctaTo: "/predict",
  },
  {
    img: slide3Img,
    overlay: "linear-gradient(to right, rgba(2,12,26,0.82) 42%, rgba(2,12,26,0.28) 100%)",
    label: "DÉCOUVREZ",
    title: "Solar Energy ",
    subtitle: "Prédiction de la Production par Intelligence Artificielle et Données Météorologiques",
    cta: "COMMENCER",
    ctaTo: "/predict",
  },
];

const DURATION = 7000; // ms per slide

/* ─── Landing Page ─────────────────────────────────────────────────────────── */
function LandingPage() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [bgFade, setBgFade] = useState(false);
  const [contentIn, setContentIn] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [arrowHover, setArrowHover] = useState<"left" | "right" | null>(null);
  const [progressKey, setProgressKey] = useState(0); // forces progress bar restart
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=Barlow:wght@300;400;500&family=Space+Mono&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    setTimeout(() => setMounted(true), 120);
  }, []);

  const goToSlide = (target: number) => {
    setContentIn(false);
    setBgFade(true);
    setTimeout(() => {
      setSlide(target);
      setProgressKey((k) => k + 1);
      setBgFade(false);
      setTimeout(() => setContentIn(true), 60);
    }, 520);
  };

  const startInterval = (currentSlide: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = (currentSlide + 1) % SLIDES.length;
      goToSlide(next);
      currentSlide = next; // won't work in closure — use ref approach below
    }, DURATION);
  };

  // Cleaner interval using ref for slide value
  const slideRef = useRef(slide);
  useEffect(() => { slideRef.current = slide; }, [slide]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = (slideRef.current + 1) % SLIDES.length;
      goToSlide(next);
    }, DURATION);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleNav = (dir: "prev" | "next" | number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const target =
      typeof dir === "number"
        ? dir
        : dir === "next"
        ? (slide + 1) % SLIDES.length
        : (slide - 1 + SLIDES.length) % SLIDES.length;
    goToSlide(target);
    // restart auto-play from new slide
    intervalRef.current = setInterval(() => {
      const next = (slideRef.current + 1) % SLIDES.length;
      goToSlide(next);
    }, DURATION);
  };

  const current = SLIDES[slide];

  return (
    <>
      <style>{`
        @keyframes kb0 { from { transform: scale(1.08) translate(0,0); } to { transform: scale(1.00) translate(-14px,-7px); } }
        @keyframes kb1 { from { transform: scale(1.10) translate(10px,5px); } to { transform: scale(1.01) translate(-7px,-9px); } }
        @keyframes kb2 { from { transform: scale(1.07) translate(-9px,6px); } to { transform: scale(1.00) translate(10px,-5px); } }

        @keyframes labelIn    { from { opacity:0; letter-spacing:.4em; } to { opacity:1; letter-spacing:.2em; } }
        @keyframes titleSlide { from { opacity:0; transform:translateX(-45px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lineGrow   { from { width:0; opacity:0; } to { width:clamp(55px,7vw,95px); opacity:1; } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

        @keyframes scanline { 0%{top:0;opacity:.4} 50%{opacity:.8} 100%{top:100%;opacity:.2} }
        @keyframes breathe  { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.55);opacity:1} }
        @keyframes arrowR   { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
        @keyframes progress { from{width:0} to{width:100%} }

        .cta-btn { position:relative; overflow:hidden; transition:all .32s cubic-bezier(.16,1,.3,1); }
        .cta-btn::after {
          content:''; position:absolute; top:0; left:-130%;
          width:55%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
          transform:skewX(-18deg); transition:left .52s ease;
        }
        .cta-btn:hover::after { left:165%; }
        .cta-btn:hover { transform:translateY(-3px) !important; box-shadow:0 10px 36px rgba(6,182,212,.5) !important; }
        .nav-btn { transition:all .25s ease; }
        .nav-btn:hover { background:rgba(6,182,212,.18) !important; border-color:rgba(6,182,212,.7) !important; }
      `}</style>

      <div style={{
        position: "relative",
        width: "100%", height: "100vh",
        overflow: "hidden",
        fontFamily: "'Barlow', sans-serif",
        background: "#020c1a",
      }}>

        {/* ── BACKGROUND PHOTOS ── */}
        {SLIDES.map((s, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0, zIndex: 0,
            opacity: i === slide ? (bgFade ? 0 : 1) : 0,
            transition: "opacity 0.55s ease",
          }}>
            <img
              src={s.img}
              alt=""
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                animation: i === slide ? `kb${i % 3} 8s ease-out forwards` : "none",
              }}
            />
            {/* Left-to-right overlay */}
            <div style={{ position: "absolute", inset: 0, background: s.overlay }} />
            {/* Bottom vignette */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(2,8,20,.75) 0%, transparent 52%)",
            }} />
            {/* Top vignette */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(2,8,20,.3) 0%, transparent 30%)",
            }} />
          </div>
        ))}

        {/* Scanline */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: 2,
          zIndex: 4, pointerEvents: "none",
          background: "linear-gradient(90deg,transparent,rgba(6,182,212,.18),transparent)",
          animation: "scanline 14s linear infinite",
        }} />

        {/* Particles */}
        <ParticleField />

        {/* ── TEXT CONTENT ── */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 clamp(44px, 9vw, 145px)",
          opacity: mounted ? 1 : 0,
          transition: "opacity .9s ease",
        }}>

          {/* Label / wind icon */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
            opacity: contentIn ? 1 : 0,
            animation: contentIn ? "labelIn .7s ease forwards" : "none",
          }}>
            <WindIcon color="#06b6d4" />
            {current.label && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(11px, 1.3vw, 14px)",
                fontWeight: 400, letterSpacing: ".2em",
                color: "#06b6d4", textTransform: "uppercase",
              }}>
                {current.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            margin: 0,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(50px, 9.5vw, 128px)",
            fontWeight: 900, lineHeight: .93,
            letterSpacing: "-.01em", textTransform: "uppercase",
            color: "#fff",
            textShadow: "0 4px 40px rgba(0,0,0,.55)",
            opacity: contentIn ? 1 : 0,
            animation: contentIn ? "titleSlide .75s cubic-bezier(.16,1,.3,1) .07s both" : "none",
          }}>
            {current.title}
          </h1>

          {/* Accent line */}
          <div style={{
            height: 3, background: "#06b6d4",
            margin: "22px 0 20px", borderRadius: 2,
            opacity: contentIn ? 1 : 0,
            animation: contentIn ? "lineGrow .6s ease .2s both" : "none",
          }} />

          {/* Subtitle */}
          <p style={{
            margin: "0 0 38px",
            fontFamily: "'Barlow', sans-serif",
            fontSize: "clamp(14px, 1.5vw, 18px)",
            fontWeight: 300, lineHeight: 1.7,
            color: "rgba(215,232,250,.9)",
            maxWidth: 500, letterSpacing: ".01em",
            opacity: contentIn ? 1 : 0,
            animation: contentIn ? "fadeUp .7s ease .17s both" : "none",
          }}>
            {current.subtitle}
          </p>

          {/* CTA */}
          <div style={{
            opacity: contentIn ? 1 : 0,
            animation: contentIn ? "fadeUp .7s ease .32s both" : "none",
          }}>
            <button
              className="cta-btn"
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={() => navigate({ to: current.ctaTo as "/" })}
              style={{
                display: "inline-flex", alignItems: "center", gap: 14,
                padding: "15px 42px",
                background: "#06b6d4", border: "none", borderRadius: 0,
                cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: "clamp(12px,1.1vw,14px)",
                letterSpacing: ".2em", textTransform: "uppercase",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(6,182,212,.3)",
              }}
            >
              {current.cta}
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none"
                style={{ animation: btnHover ? "arrowR .55s ease infinite" : "none" }}>
                <path d="M1 7H17M11 1L17 7L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── LEFT ARROW ── */}
        <button className="nav-btn" onClick={() => handleNav("prev")}
          onMouseEnter={() => setArrowHover("left")}
          onMouseLeave={() => setArrowHover(null)}
          style={{
            position: "absolute", left: "clamp(14px,3vw,36px)", top: "50%",
            transform: "translateY(-50%)", zIndex: 20,
            width: 48, height: 48, borderRadius: "50%",
            background: arrowHover === "left" ? "rgba(6,182,212,.18)" : "rgba(255,255,255,.07)",
            border: `1px solid ${arrowHover === "left" ? "rgba(6,182,212,.7)" : "rgba(255,255,255,.22)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(6px)",
          }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8 2L2 8L8 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ── RIGHT ARROW ── */}
        <button className="nav-btn" onClick={() => handleNav("next")}
          onMouseEnter={() => setArrowHover("right")}
          onMouseLeave={() => setArrowHover(null)}
          style={{
            position: "absolute", right: "clamp(14px,3vw,36px)", top: "50%",
            transform: "translateY(-50%)", zIndex: 20,
            width: 48, height: 48, borderRadius: "50%",
            background: arrowHover === "right" ? "rgba(6,182,212,.18)" : "rgba(255,255,255,.07)",
            border: `1px solid ${arrowHover === "right" ? "rgba(6,182,212,.7)" : "rgba(255,255,255,.22)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(6px)",
          }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M2 2L8 8L2 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ── THUMBNAIL DOTS (bottom center) ── */}
        <div style={{
          position: "absolute", bottom: 36, left: "50%",
          transform: "translateX(-50%)", zIndex: 20,
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          {SLIDES.map((s, i) => (
            <button key={i} onClick={() => handleNav(i)}
              style={{ padding: 0, background: "none", border: "none", cursor: "pointer" }}>
              {/* Photo thumbnail */}
              <div style={{
                width: i === slide ? 66 : 46,
                height: i === slide ? 44 : 30,
                borderRadius: 4, overflow: "hidden",
                border: `2px solid ${i === slide ? "#06b6d4" : "rgba(255,255,255,.28)"}`,
                boxShadow: i === slide ? "0 0 14px rgba(6,182,212,.55)" : "none",
                opacity: i === slide ? 1 : 0.55,
                transition: "all .38s cubic-bezier(.16,1,.3,1)",
              }}>
                <img src={s.img} alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              {/* Progress bar under active thumbnail */}
              {i === slide && (
                <div style={{
                  height: 2, marginTop: 5, borderRadius: 1,
                  background: "rgba(6,182,212,.22)", overflow: "hidden",
                }}>
                  <div key={progressKey} style={{
                    height: "100%", borderRadius: 1, background: "#06b6d4",
                    animation: `progress ${DURATION}ms linear forwards`,
                  }} />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* ── SLIDE COUNTER (bottom right) ── */}
        <div style={{
          position: "absolute", bottom: 44, right: "clamp(20px,4vw,54px)",
          zIndex: 20, display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#06b6d4", fontWeight: 700 }}>
            {String(slide + 1).padStart(2, "0")}
          </span>
          <div style={{ width: 28, height: 1, background: "rgba(255,255,255,.25)" }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "rgba(255,255,255,.35)" }}>
            {String(SLIDES.length).padStart(2, "0")}
          </span>
        </div>

        {/* ── LIVE BADGE (bottom left) ── */}
        <div style={{
          position: "absolute", bottom: 40, left: "clamp(20px,4vw,54px)",
          zIndex: 20, display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: "#06b6d4",
            boxShadow: "0 0 7px #06b6d4",
            animation: "breathe 2.3s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 10, color: "rgba(6,182,212,.75)",
            letterSpacing: ".12em", textTransform: "uppercase",
          }}>
            AI · Météo · Temps réel
          </span>
        </div>

      </div>
    </>
  );
}
