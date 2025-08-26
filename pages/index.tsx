import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import drugs from "../content/drugs.json";

/**
 * Drug of the Day — single‑page prototype (animated + audio cues + back nav + 09:00 unlock)
 * - Smooth transitions with Framer Motion
 * - Timer beeps in the last 5s + final tone at 0
 * - Back button that preserves each question's remaining time
 * - Per‑option rationales on review
 * - Streaks (localStorage)
 * - Completed page with countdown to next 09:00 local time
 * - Uses device location (Geolocation API) to reassure user about time zone
 *
 * Install framer-motion: `npm i framer-motion`
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AnchorId = "class" | "indications" | "moa" | "adrs" | "interactions";

type Option = { id: string; label: string };

type Anchor = {
  id: AnchorId;
  title: string;
  prompt: string;
  type: "single" | "multi"; // SINGLE = one answer, MULTI = select all that apply
  options: Option[];
  correct: string[]; // array of option ids that are correct
  explanation: string; // one crisp line
  rationales?: Record<string, string>; // per-option rationale
  refs?: { label: string; url?: string }[];
};

type Drug = {
  name: string;
  intro?: string;
  anchors: Anchor[];
  tags?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Content — Example: Ramipril (ACE inhibitor)
// ─────────────────────────────────────────────────────────────────────────────

const RAMIPRIL: Drug = {
  name: "ramipril",
  intro:
    "Work through the same five questions you used in teaching. Keep it snappy; aim for ~3 minutes.",
  tags: ["cardio", "renal", "safety"],
  anchors: [
    {
      id: "class",
      title: "Drug class",
      prompt: "Which class does ramipril belong to?",
      type: "single",
      options: [
        { id: "ace", label: "ACE inhibitor" },
        { id: "arb", label: "Angiotensin II receptor blocker (ARB)" },
        { id: "ccb", label: "Dihydropyridine calcium‑channel blocker" },
        { id: "bb", label: "Beta‑blocker" },
      ],
      correct: ["ace"],
      explanation: "Ramipril is an ACE inhibitor (prodrug → ramiprilat).",
      rationales: {
        ace: "Correct — ACE inhibitors reduce Ang II formation and aldosterone; ramipril is a prodrug.",
        arb: "ARB = blocks AT1 receptor (e.g., losartan). That is not ACE inhibition.",
        ccb: "DHP CCBs (e.g., amlodipine) act on L‑type Ca²⁺ channels, unrelated to RAAS.",
        bb: "β‑blockers reduce sympathetic drive; mechanism distinct from RAAS.",
      },
      refs: [
        { label: "BNF: Ramipril" },
        { label: "NICE: Hypertension" },
      ],
    },
    {
      id: "indications",
      title: "Common indications",
      prompt: "Select ALL common indications.",
      type: "multi",
      options: [
        { id: "htn", label: "Hypertension" },
        { id: "hfrEF", label: "Heart failure with reduced EF" },
        { id: "postmi", label: "Post‑MI / secondary prevention" },
        { id: "ckd", label: "CKD with albuminuria (incl. diabetic nephropathy)" },
        { id: "angina", label: "Stable angina" },
        { id: "migraine", label: "Migraine prophylaxis" },
      ],
      correct: ["htn", "hfrEF", "postmi", "ckd"],
      explanation:
        "HTN, HFrEF, post‑MI risk reduction, and CKD with albuminuria are standard indications.",
      rationales: {
        htn: "Yes — ACEi are first‑line in several groups; benefit from vasodilation & RAAS suppression.",
        hfrEF: "Yes — mortality and hospitalization benefit in HFrEF.",
        postmi: "Yes — improves remodeling and outcomes post‑MI.",
        ckd: "Yes — reduces intraglomerular pressure & albuminuria; kidney protection.",
        angina: "No — β‑blockers, nitrates, CCBs; ACEi not first‑line for angina itself.",
        migraine: "No — not an established migraine preventive.",
      },
      refs: [{ label: "BNF: Indications" }],
    },
    {
      id: "moa",
      title: "Mechanism of action",
      prompt: "Which statement best describes the mechanism?",
      type: "single",
      options: [
        {
          id: "moa_true",
          label:
            "Inhibits ACE → ↓Ang II & ↓aldosterone + ↑bradykinin → vasodilation & ↓afterload",
        },
        { id: "moa_arb", label: "Blocks AT1 receptor (ARB) to prevent Ang II binding" },
        { id: "moa_ccb", label: "Blocks L‑type Ca²⁺ channels in vascular smooth muscle" },
        { id: "moa_renin", label: "Direct renin inhibitor reduces Ang I formation" },
      ],
      correct: ["moa_true"],
      explanation:
        "ACE inhibition lowers Ang II and aldosterone; reduced bradykinin breakdown contributes to vasodilation.",
      rationales: {
        moa_true: "Correct — classic ACEi pathway with bradykinin effects.",
        moa_arb: "ARB describes losartan/valsartan class, not ACE inhibitors.",
        moa_ccb: "This is the mechanism of dihydropyridine CCBs (e.g., amlodipine).",
        moa_renin: "Aliskiren inhibits renin; different step in RAAS than ACE.",
      },
      refs: [{ label: "Katzung: RAAS" }],
    },
    {
      id: "adrs",
      title: "Important adverse reactions",
      prompt: "Select ALL clinically important ADRs you would counsel/monitor for.",
      type: "multi",
      options: [
        { id: "cough", label: "Dry cough" },
        { id: "angio", label: "Angioedema" },
        { id: "k", label: "Hyperkalaemia" },
        { id: "hypo", label: "Symptomatic hypotension/dizziness" },
        { id: "renal", label: "Rise in creatinine/AKI risk (esp. renal artery stenosis)" },
        { id: "gingiva", label: "Gingival hyperplasia" },
        { id: "brady", label: "Bradycardia" },
      ],
      correct: ["cough", "angio", "k", "hypo", "renal"],
      explanation:
        "ACEi: cough/angioedema (bradykinin), hyperkalaemia (↓aldosterone), hypotension; modest creatinine rise common.",
      rationales: {
        cough: "Yes — bradykinin accumulation causes a characteristic dry cough.",
        angio: "Yes — rare but serious; stop drug and treat urgently.",
        k: "Yes — aldosterone suppression raises serum potassium.",
        hypo: "Yes — first‑dose hypotension possible, especially if volume‑depleted.",
        renal: "Yes — efferent dilation can drop GFR; expect small creatinine bump, monitor.",
        gingiva: "No — more associated with dihydropyridine CCBs (e.g., nifedipine).",
        brady: "No — ACEi don’t directly slow heart rate; think β‑blockers or non‑DHP CCBs.",
      },
      refs: [{ label: "BNF: Adverse effects" }],
    },
    {
      id: "interactions",
      title: "Important drug–drug interactions",
      prompt: "Select ALL interactions of concern.",
      type: "multi",
      options: [
        { id: "kplus", label: "K⁺ supplements / K‑sparing diuretics (e.g., spironolactone)" },
        { id: "nsaids", label: "NSAIDs (esp. chronic)" },
        { id: "lithium", label: "Lithium" },
        { id: "dualraas", label: "Dual RAAS blockade (ARB/aliskiren), esp. in diabetes" },
        { id: "gfj", label: "Grapefruit juice" },
        { id: "ppi", label: "PPIs" },
      ],
      correct: ["kplus", "nsaids", "lithium", "dualraas"],
      explanation:
        "↑K⁺ risk (K‑sparing/K⁺ salts); NSAIDs blunt effect & ↑AKI; lithium levels ↑; avoid dual RAAS (AKI/hyperkalaemia).",
      rationales: {
        kplus: "Yes — additive hyperkalaemia risk.",
        nsaids: "Yes — the ‘triple whammy’ with diuretics/ACEi can precipitate AKI and reduce antihypertensive effect.",
        lithium: "Yes — ACEi can reduce lithium clearance → toxicity; monitor or avoid.",
        dualraas: "Yes — more renal events/hyperkalaemia without clear benefit.",
        gfj: "No — ramipril isn’t a known grapefruit‑sensitive substrate of concern.",
        ppi: "No — no clinically relevant interaction.",
      },
      refs: [{ label: "BNF: Interactions" }],
    },
  ],
};

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

const StepBadge: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <div className="text-xs text-gray-500">Step {step} / {total}</div>
);

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
    <div className="h-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
  </div>
);

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border text-gray-700">{label}</span>
);

const cardVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18, ease: "easeIn" } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio (Web Audio API)
// ─────────────────────────────────────────────────────────────────────────────

function useTimerAudio(soundOn: boolean) {
  const ctxRef = useRef<any>(null);
  const prime = () => {
    if (!soundOn) return;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
  };
  const beep = (freq = 880, duration = 0.09, gain = 0.04) => {
    const ctx = ctxRef.current;
    if (!soundOn || !ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };
  return { prime, beep } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — next 09:00 local time + Geolocation
// ─────────────────────────────────────────────────────────────────────────────

// Helper: get the next 09:00 local time from `base` (today if in the future, otherwise tomorrow)
const next9amTs = (base: number) => {
  const d = new Date(base);
  const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0);
  if (base >= candidate.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
};

// Hook: request device geolocation (for user assurance); falls back gracefully
function useDeviceLocation() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "prompt" | "granted" | "denied" | "unavailable">("idle");

  const request = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("prompt");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  return { coords, status, request } as const;
}

// Dev tests (console) to verify next9amTs logic
(function runDevTests() {
  if (typeof window === "undefined") return;
  if ((window as any).__DOTD_TESTED__) return;
  (window as any).__DOTD_TESTED__ = true;
  const log = (name: string, pass: boolean) => {
    // eslint-disable-next-line no-console
    console[pass ? "log" : "error"](`%c[TEST] ${name}: ${pass ? "PASS" : "FAIL"}`, `color:${pass ? "#16a34a" : "#dc2626"}`);
  };
  // Case A: 08:00 today -> expect today 09:00
  const d1 = new Date(); d1.setHours(8, 0, 0, 0);
  const n1 = next9amTs(d1.getTime());
  const e1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 9, 0, 0, 0).getTime();
  log("next9am - before 9am", n1 === e1);
  // Case B: 09:00 today -> expect tomorrow 09:00
  const d2 = new Date(); d2.setHours(9, 0, 0, 0);
  const n2 = next9amTs(d2.getTime());
  const e2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate() + 1, 9, 0, 0, 0).getTime();
  log("next9am - at 9am", n2 === e2);
  // Case C: 14:00 today -> expect tomorrow 09:00
  const d3 = new Date(); d3.setHours(14, 0, 0, 0);
  const n3 = next9amTs(d3.getTime());
  const e3 = new Date(d3.getFullYear(), d3.getMonth(), d3.getDate() + 1, 9, 0, 0, 0).getTime();
  log("next9am - after 9am", n3 === e3);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DrugOfTheDay() {
 const START_DATE_ISO = "2025-09-01"; // change to the date you want Day 1 to begin
const [drug] = useState<Drug>(() => pickDrugForToday());

function pickDrugForToday(): Drug {
  const now = new Date();
  // Today at 09:00 local
  const today9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  // If it's before 09:00, use yesterday's window; otherwise use today's
  const boundaryNow =
    now.getTime() >= today9.getTime() ? today9 : new Date(today9.getTime() - 24 * 3600 * 1000);

  const start9 = new Date(START_DATE_ISO + "T09:00:00");
  const days = Math.floor((boundaryNow.getTime() - start9.getTime()) / (24 * 3600 * 1000));

  const list = drugs as any[];
  const len = Array.isArray(list) ? list.length : 0;
  const idx = len > 0 ? ((days % len) + len) % len : 0; // safe modulo
  return len > 0 ? list[idx] : list[0];
}
  const total = drug.anchors.length;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<AnchorId, string[]>>({
    class: [],
    indications: [],
    moa: [],
    adrs: [],
    interactions: [],
  });
  const [showResults, setShowResults] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [timerOn, setTimerOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  // Per‑question time store (so timer does not reset when navigating back)
  const initialTimes = useMemo(() => {
    const d: Partial<Record<AnchorId, number>> = {};
    drug.anchors.forEach((a) => (d[a.id] = 35));
    return d as Record<AnchorId, number>;
  }, [drug]);
  const [secondsLeftBy, setSecondsLeftBy] = useState<Record<AnchorId, number>>(initialTimes);

  // Next-availability countdown (persisted)
  const [nextAt, setNextAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null; // SSR guard
    const v = window.localStorage.getItem("dotd_next_at");
    return v ? Number(v) : null;
  });

  const { prime, beep } = useTimerAudio(soundOn);

  // Device timezone (from runtime) and optional precise location
  const timeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "local"; }
    catch { return "local"; }
  }, []);
  const { coords, status: geoStatus, request: requestLocation } = useDeviceLocation();

  // If the user reaches the Completed screen, try to request location to reassure them
  useEffect(() => {
    if (showCompleted) requestLocation();
  }, [showCompleted, requestLocation]);

  const curr = drug.anchors[idx];
  const secondsLeft = secondsLeftBy[curr.id] ?? 35;

  // Timer: counts down for CURRENT question only; persists per question
  useEffect(() => {
    if (!timerOn || showResults || showCompleted) return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setSecondsLeftBy((prev) => ({
        ...prev,
        [curr.id]: Math.max(0, (prev[curr.id] ?? 35) - 1),
      }));
    }, 1000);
    return () => clearTimeout(t);
  }, [timerOn, showResults, showCompleted, secondsLeft, curr.id]);

  // Audio: tick only on real decrements, not on navigation
  const prevSecRef = useRef(secondsLeft);
  useEffect(() => {
    if (!timerOn || showCompleted) return;
    const prev = prevSecRef.current;
    const diff = prev - secondsLeft;
    if (diff === 1) {
      if (secondsLeft <= 5 && secondsLeft > 0) {
        const freq = 600 + (5 - secondsLeft) * 80; // 600→920 Hz as time runs out
        beep(freq, 0.09, 0.05);
      }
      if (secondsLeft === 0) beep(360, 0.3, 0.06);
    }
    prevSecRef.current = secondsLeft;
  }, [secondsLeft, timerOn, showCompleted, beep]);

  // Progress %
  const progress = useMemo(() => (idx / total) * 100, [idx, total]);

  // Selection handlers
  const toggle = (id: string) => {
    prime();
    const prev = new Set(answers[curr.id]);
    if (curr.type === "single") {
      setAnswers({ ...answers, [curr.id]: [id] });
      return;
    }
    if (prev.has(id)) prev.delete(id);
    else prev.add(id);
    setAnswers({ ...answers, [curr.id]: Array.from(prev) });
  };

  const goNext = () => {
    prime();
    if (idx + 1 < total) setIdx(idx + 1);
    else setShowResults(true);
  };
  const goBack = () => {
    prime();
    if (idx > 0) setIdx(idx - 1);
  };

  // When the user declares they've finished reviewing, start the 09:00 cooldown
  const markReviewComplete = () => {
    const target = next9amTs(Date.now());
    window.localStorage.setItem("dotd_next_at", String(target));
    setNextAt(target);
    setShowCompleted(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Results object
  // ───────────────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!showResults) return null;
    const perAnchor = drug.anchors.map((a) => {
      const sel = new Set(answers[a.id]);
      const cor = new Set(a.correct);
      const correct = setsEqual(sel, cor);
      const missed = a.options.filter((o) => cor.has(o.id) && !sel.has(o.id));
      const wrong = a.options.filter((o) => sel.has(o.id) && !cor.has(o.id));
      const selected = a.options.filter((o) => sel.has(o.id));
      const correctOpts = a.options.filter((o) => cor.has(o.id));
      return { anchor: a, correct, missed, wrong, selected, correctOpts };
    });
    return { perAnchor };
  }, [answers, drug.anchors, total, showResults]);

  // Streaks (localStorage by date key)
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setStreak(Number(window.localStorage.getItem("dotd_streak") || "0"));
  }, []);

  useEffect(() => {
    if (!results) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastDone = window.localStorage.getItem("dotd_last");
    let streakVal = Number(window.localStorage.getItem("dotd_streak") || "0");
    if (lastDone !== today) {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      streakVal = lastDone === yesterday ? streakVal + 1 : 1;
      window.localStorage.setItem("dotd_streak", String(streakVal));
      window.localStorage.setItem("dotd_last", today);
      setStreak(streakVal);
    } else {
      setStreak(streakVal);
    }
  }, [results]);

  // ───────────────────────────────────────────────────────────────────────────
  // Completed Page + Countdown
  // ───────────────────────────────────────────────────────────────────────────

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!showCompleted || !nextAt) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [showCompleted, nextAt]);

  // Count down to next 09:00 local.
  const currentLeft = nextAt ? Math.max(0, nextAt - Date.now()) : 0;

  const fmt = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  if (showCompleted) {
    const left = currentLeft;
    const ready = left <= 0;
    const unlockAt = nextAt ? new Date(nextAt) : null;
    const unlockLabel = unlockAt
      ? unlockAt.toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          weekday: "short",
          day: "2-digit",
          month: "short",
          timeZoneName: "short",
        })
      : "09:00";

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm border text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-semibold">Thanks for completing Drug of the Day!</h1>
          <p className="mt-2 text-gray-600">
            Your next dose unlocks at <span className="font-medium">09:00</span> local time ({unlockLabel}).
          </p>
          <div className="mt-6 text-5xl font-mono tracking-wider">{fmt(left)}</div>
          <div className="mt-6 flex justify-center gap-3">
            <button
              className="rounded-xl px-4 py-2 bg-white border hover:bg-gray-50"
              onClick={() => {
                setShowCompleted(false);
                setShowResults(false);
                setIdx(0);
              }}
            >
              Back to home
            </button>
            <button
              className={`rounded-xl px-4 py-2 ${
                ready
                  ? "bg-slate-900 text-white hover:bg-black"
                  : "bg-gray-200 text-gray-600 cursor-not-allowed"
              }`}
              disabled={!ready}
              onClick={() => {
                window.localStorage.removeItem("dotd_next_at");
                setNextAt(null);
                setShowCompleted(false);
                setIdx(0);
              }}
            >
              {ready ? "Start next dose" : "Locked until 09:00"}
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500 flex flex-col items-center gap-1">
            <div>Time zone: <span className="font-medium">{timeZone}</span></div>
            {coords ? (
              <div>Location detected ✓ ({coords.lat.toFixed(3)}, {coords.lon.toFixed(3)})</div>
            ) : (
              <button className="underline" onClick={requestLocation}>
                Use my location for accuracy
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render — Results
  // ───────────────────────────────────────────────────────────────────────────

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Drug of the Day — {drug.name}</h1>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Chip label={`Streak: ${streak} 🔥`} />
            </div>
          </div>

          <motion.div className="rounded-2xl bg-white p-6 shadow-sm border" variants={cardVariants} initial="initial" animate="animate">
            <div className="mt-6 space-y-6">
              {results.perAnchor.map(({ anchor, correct, missed, wrong, correctOpts }, i) => (
                <motion.div key={anchor.id} className="border rounded-xl p-4" variants={cardVariants} initial="initial" animate="animate">
                  <div className="flex items-baseline gap-2">
                    <StepBadge step={i + 1} total={total} />
                    <h3 className="font-medium">{anchor.title}</h3>
                    <span className={`ml-auto text-sm ${correct ? "text-green-600" : "text-rose-600"}`}>{correct ? "Correct" : "Review"}</span>
                  </div>
                  <p className="mt-2 text-gray-700">{anchor.prompt}</p>

                  {!correct && (
                    <div className="mt-3 text-sm space-y-2">
                      {missed.length > 0 && (
                        <div className="text-amber-800">
                          <div className="font-medium">You missed:</div>
                          <ul className="list-disc pl-5">
                            {missed.map((m) => (
                              <li key={m.id}>
                                <span className="font-medium">{m.label}</span>
                                {anchor.rationales?.[m.id] && <span className="ml-1 text-gray-700">— {anchor.rationales[m.id]}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {wrong.length > 0 && (
                        <div className="text-rose-800">
                          <div className="font-medium">Not correct:</div>
                          <ul className="list-disc pl-5">
                            {wrong.map((w) => (
                              <li key={w.id}>
                                <span className="font-medium">{w.label}</span>
                                {anchor.rationales?.[w.id] && <span className="ml-1 text-gray-700">— {anchor.rationales[w.id]}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="text-gray-800">
                        <span className="font-medium">Correct answer(s): </span>
                        {correctOpts.map((o) => o.label).join(", ")}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-gray-800">
                    <span className="font-medium">Why:</span> {anchor.explanation}
                  </div>
                  {anchor.refs && anchor.refs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {anchor.refs.map((r, k) => (
                        <Chip key={k} label={r.label} />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-black" onClick={() => { setShowResults(false); setIdx(0); setAnswers({ class: [], indications: [], moa: [], adrs: [], interactions: [] }); }}>
                Try again
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-white border hover:bg-gray-50" onClick={() => window.location.reload()}>
                New drug (swap data)
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={markReviewComplete}>
                Mark review complete →
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render — Quiz Flow
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Drug of the Day — {drug.name}</h1>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Chip label={`Streak: ${streak} 🔥`} />
          </div>
        </header>

        <AnimatePresence mode="popLayout">
          <motion.div key={curr.id} className="rounded-2xl bg-white p-6 shadow-sm border" variants={cardVariants} initial="initial" animate="animate" exit="exit" layout>
            <div className="mb-4">
              <ProgressBar value={progress} />
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <StepBadge step={idx + 1} total={total} />
              <div className="ml-auto flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" className="accent-blue-600" checked={timerOn} onChange={(e) => setTimerOn(e.target.checked)} />
                  Timer
                </label>
                <label className="flex items-center gap-1 cursor-pointer" onClick={prime}>
                  <input type="checkbox" className="accent-blue-600" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
                  Sound
                </label>
                {timerOn && (
                  <span className={`font-mono ${secondsLeft <= 5 ? "text-rose-600" : ""}`}>{String(secondsLeft).padStart(2, "0")}s</span>
                )}
              </div>
            </div>

            <h2 className="text-lg font-medium">{curr.title}</h2>
            <p className="text-gray-700 mt-1">{curr.prompt}</p>

            <div className="mt-4 grid gap-2">
              {curr.options.map((o) => {
                const selected = (answers[curr.id] || []).includes(o.id);
                return (
                  <motion.button key={o.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => toggle(o.id)} className={`text-left border rounded-xl px-4 py-2 transition ${selected ? "bg-blue-50 border-blue-500" : "bg-white hover:bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      {curr.type === "multi" ? (
                        <input type="checkbox" checked={selected} readOnly className="accent-blue-600" />
                      ) : (
                        <span className={`w-2.5 h-2.5 rounded-full border ${selected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`} />
                      )}
                      <span>{o.label}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {idx > 0 && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-white border hover:bg-gray-50" onClick={goBack}>
                  Back
                </motion.button>
              )}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-black" onClick={goNext}>
                {idx + 1 < total ? "Next" : "Finish"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="rounded-xl px-4 py-2 bg-white border hover:bg-gray-50" onClick={() => { prime(); setAnswers({ ...answers, [curr.id]: [] }); }}>
                Clear selection
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-xs text-gray-500 mt-3">Tip: swap the RAMIPRIL object for another drug to author new days. Keep the five anchors and it will auto‑render.</p>
      </div>
    </div>
  );
}
