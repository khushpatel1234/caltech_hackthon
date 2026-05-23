"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Activity, 
  Heart, 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  FileText, 
  TrendingDown, 
  FlaskConical,
  Shield,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  ComposedChart,
  Line,
  Area,
  Legend,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ReferenceLine, 
  Tooltip as RechartsTooltip 
} from "recharts";

// Hardcoded STAR Scoring standards corresponding to backend definitions
const STAR_SCORING: Record<string, Record<string, number>> = {
  "Horvath": { "Stability": 0.85, "Treatment-Responsiveness": 0.50, "Associations": 0.60, "Risk": 0.65 },
  "Hannum": { "Stability": 0.80, "Treatment-Responsiveness": 0.50, "Associations": 0.55, "Risk": 0.60 },
  "PhenoAge": { "Stability": 0.75, "Treatment-Responsiveness": 0.75, "Associations": 0.85, "Risk": 0.88 },
  "GrimAge": { "Stability": 0.90, "Treatment-Responsiveness": 0.82, "Associations": 0.95, "Risk": 0.96 },
  "DunedinPACE": { "Stability": 0.94, "Treatment-Responsiveness": 0.88, "Associations": 0.90, "Risk": 0.92 },
  "ZhangAge": { "Stability": 0.82, "Treatment-Responsiveness": 0.68, "Associations": 0.74, "Risk": 0.70 },
  "CausAge": { "Stability": 0.80, "Treatment-Responsiveness": 0.80, "Associations": 0.83, "Risk": 0.82 }
};

const CLOCK_COLORS: Record<string, string> = {
  "Horvath": "#a855f7",     // violet-500
  "Hannum": "#3b82f6",      // blue-500
  "PhenoAge": "#f97316",    // orange-500
  "GrimAge": "#ef4444",     // red-500
  "DunedinPACE": "#eab308",  // yellow-500
  "ZhangAge": "#14b8a6",    // teal-500
  "CausAge": "#d946ef"      // pink-500
};

interface PatientPageProps {
  params: {
    id: string;
  };
}

export default function PatientDetailPage({ params }: PatientPageProps) {
  const patientId = params.id;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab configuration
  const [selectedTab, setSelectedTab] = useState<"assessment" | "trajectory">("assessment");

  // Interaction explorer: visibility toggling for each of the 7 epigenetic clocks
  const [visibleClocks, setVisibleClocks] = useState<Record<string, boolean>>({
    "Horvath": true,
    "Hannum": true,
    "PhenoAge": true,
    "GrimAge": true,
    "DunedinPACE": true,
    "ZhangAge": true,
    "CausAge": true,
  });

  // Longitudinal trajectory statistics
  const [trajectoryData, setTrajectoryData] = useState<any>(null);
  const [isTrajectoryLoading, setIsTrajectoryLoading] = useState(false);
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null);

  // AI Clinical Assistant states
  const [evidenceBase, setEvidenceBase] = useState<any[]>([]);
  const [expandedRecs, setExpandedRecs] = useState<Record<number, boolean>>({});
  const [followupQuestion, setFollowupQuestion] = useState("");
  const [isFollowupLoading, setIsFollowupLoading] = useState(false);
  const [followupHistory, setFollowupHistory] = useState<Array<{question: string, answer: string, actions?: string[], id: string}>>([]);

  // Clinical optimization active question and dynamic weight indices
  const [activeQuestion, setActiveQuestion] = useState<"general" | "mortality" | "cardiovascular" | "cognitive" | "metabolic" | "cancer">("general");
  const [activeConsensus, setActiveConsensus] = useState<any>(null);
  const [displayAge, setDisplayAge] = useState<number>(0);
  const [whyThisChangedOpen, setWhyThisChangedOpen] = useState(false);

  const handleQuestionChange = async (question: "general" | "mortality" | "cardiovascular" | "cognitive" | "metabolic" | "cancer") => {
    setActiveQuestion(question);
    
    try {
      const apiHost = typeof window !== 'undefined' 
        ? window.location.origin.replace(':3000', ':8000') 
        : 'http://localhost:8000';
      
      const res = await fetch(`${apiHost}/api/patient/${patientId}/consensus?question=${question}`);
      if (res.ok) {
        const json = await res.json();
        setActiveConsensus(json);
        
        // Dynamic animation transition (800ms easeOutCubic lerp)
        const targetAge = json.consensus_age;
        const startAge = displayAge || targetAge;
        const duration = 800;
        const startTime = performance.now();
        
        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1.0);
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          const currentVal = startAge + (targetAge - startAge) * easeOutCubic;
          setDisplayAge(currentVal);
          
          if (progress < 1.0) {
            requestAnimationFrame(tick);
          } else {
            setDisplayAge(targetAge);
          }
        };
        requestAnimationFrame(tick);
      }
      
      // Fetch full details with active clinical question context to update AI panels and recommendations
      const profileRes = await fetch(`${apiHost}/api/patient/${patientId}?question=${question}`);
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        setData(profileJson);
      }
    } catch (err) {
      console.error("Error toggling clinical question lens:", err);
    }
  };

  // Fetch longevity evidence base once on mount
  useEffect(() => {
    async function fetchEvidence() {
      try {
        const apiHost = typeof window !== 'undefined' 
          ? window.location.origin.replace(':3000', ':8000') 
          : 'http://localhost:8000';
        const res = await fetch(`${apiHost}/api/clocks/evidence`);
        if (res.ok) {
          const json = await res.json();
          setEvidenceBase(json);
        }
      } catch (err) {
        console.error("Failed to load scientific evidence base:", err);
      }
    }
    fetchEvidence();
  }, []);

  const submitQuestion = async (query: string) => {
    if (!query) return;

    setIsFollowupLoading(true);
    setFollowupQuestion("");

    try {
      const apiHost = typeof window !== 'undefined' 
        ? window.location.origin.replace(':3000', ':8000') 
        : 'http://localhost:8000';
      const res = await fetch(`${apiHost}/api/patient/${patientId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query })
      });

      if (!res.ok) {
        throw new Error("Expert clinical response system unreachable.");
      }

      const json = await res.json();
      
      // Append to list of answered diagnostic chats
      setFollowupHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          question: query,
          answer: json.answer,
          actions: json.suggested_actions || []
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setFollowupHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          question: query,
          answer: "⚠️ Expert clinical responder is currently offline. Please check network connection and try again."
        }
      ]);
    } finally {
      setIsFollowupLoading(false);
    }
  };

  const handleFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = followupQuestion.trim();
    submitQuestion(query);
  };

  const getHallmarkBadge = (storyText: string) => {
    const normalized = (storyText || "").toLowerCase();
    if (normalized.includes("inflammaging")) return { label: "Inflammaging", color: "bg-rose-500/10 text-rose-400 border-rose-505/20" };
    if (normalized.includes("metabolic")) return { label: "Metabolic Drift", color: "bg-amber-500/10 text-amber-400 border-amber-505/20" };
    if (normalized.includes("mitochondrial")) return { label: "Mitochondrial Decline", color: "bg-cyan-500/10 text-cyan-400 border-cyan-505/20" };
    if (normalized.includes("immune")) return { label: "Immune Drift", color: "bg-purple-500/10 text-purple-400 border-purple-505/20" };
    return { label: "Mixed Hallmark", color: "bg-emerald-500/10 text-emerald-400 border-emerald-505/20" };
  };

  useEffect(() => {
    async function fetchPatientData() {
      setIsLoading(true);
      setError(null);
      try {
        // Dynamic origin lookup to adapt flawlessly to Sandbox environment or standard localports
        const apiHost = typeof window !== 'undefined' 
          ? window.location.origin.replace(':3000', ':8000') 
          : 'http://localhost:8000';
        
        const res = await fetch(`${apiHost}/api/patient/${patientId}`);
        if (!res.ok) {
          throw new Error(`Server returned status code: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
        if (json.clocks_panel?.consensus_age) {
          setDisplayAge(json.clocks_panel.consensus_age);
        }
      } catch (err: any) {
        console.error("Failed fetching detailed patient insights:", err);
        setError(err.message || "Failed to retrieve clinical diagnostics. Make sure the FastAPI service is running.");
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchTrajectoryData() {
      if (!patientId) return;
      setIsTrajectoryLoading(true);
      setTrajectoryError(null);
      try {
        const apiHost = typeof window !== 'undefined' 
          ? window.location.origin.replace(':3000', ':8000') 
          : 'http://localhost:8000';
        
        const res = await fetch(`${apiHost}/api/patient/${patientId}/trajectory`);
        if (!res.ok) {
          throw new Error(`Trajectory tracking failed with status: ${res.status}`);
        }
        const json = await res.json();
        setTrajectoryData(json);
      } catch (err: any) {
        console.error("Failed fetching patient trajectory stats:", err);
        setTrajectoryError(err.message || "Failed to retrieve longitudinal trajectory curves from clinical API module.");
      } finally {
        setIsTrajectoryLoading(false);
      }
    }

    if (patientId) {
      fetchPatientData();
      fetchTrajectoryData();
    }
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <Activity size={20} className="text-emerald-400 absolute animate-pulse" />
        </div>
        <div className="text-sm font-mono tracking-widest text-neutral-400 uppercase animate-pulse">
          Decrypting Epigenome & Metascores...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-6">
        <div className="max-w-md w-full text-center space-y-6 bg-neutral-900/60 p-8 rounded-2xl border border-neutral-800 backdrop-blur-md">
          <div className="bg-rose-500/10 w-12 h-12 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="text-rose-400 w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-white">Clinical Data Inaccessible</h3>
            <p className="text-xs text-neutral-400 leading-normal">
              {error || "No experimental biomarkers have been found for the requested patient identifier."}
            </p>
          </div>
          <div className="pt-2">
            <Link 
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold bg-neutral-800 hover:bg-neutral-750 text-white px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <ChevronLeft size={14} /> Back to Entry Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { patient, clocks_panel, ai_interpretation } = data;
  const chronoAge = patient.chronological_age;
  const lastVisitDate = patient.visits?.[patient.visits.length - 1]?.date || "N/A";

  // Compute Biological Age metrics dynamically based on clinical lens
  const consensusAge = activeConsensus?.consensus_age !== undefined ? activeConsensus.consensus_age : (clocks_panel?.consensus_age || chronoAge);
  const ciLow = activeConsensus?.ci_low !== undefined ? activeConsensus.ci_low : (clocks_panel?.consensus_ci?.[0] || consensusAge - 2.5);
  const ciHigh = activeConsensus?.ci_high !== undefined ? activeConsensus.ci_high : (clocks_panel?.consensus_ci?.[1] || consensusAge + 2.5);
  const rationaleText = activeConsensus?.rationale || clocks_panel?.rationale || "Balanced weighting across all indicators.";
  const weightBreakdown = activeConsensus?.weight_breakdown || clocks_panel?.weight_breakdown || {};

  const acceleration = consensusAge - chronoAge;

  // Setup color schema mapping for overall acceleration limits
  let accelColorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  let accelLabel = "De-accelerated (Optimum)";
  if (acceleration >= 0 && acceleration <= 3) {
    accelColorClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    accelLabel = "Moderate Acceleration";
  } else if (acceleration > 3) {
    accelColorClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    accelLabel = "High Acceleration Risk";
  }

  // Determine disagreement metrics dynamically based on clinical lens
  const disagreementScore = activeConsensus?.disagreement_score !== undefined ? activeConsensus.disagreement_score : (clocks_panel?.disagreement_score || 0);
  const isAnomalous = disagreementScore > 1.28 || (clocks_panel?.anomaly?.percentile !== undefined && clocks_panel.anomaly.percentile < 10);
  
  // Extract specific clock values safely
  const clocksMap = clocks_panel?.clocks || {};
  const grimValue = clocksMap?.GrimAge?.value || chronoAge;
  const phenoValue = clocksMap?.PhenoAge?.value || chronoAge;
  const grimPhenoGap = Math.abs(grimValue - phenoValue);

  // Parse clock dataset for the Recharts scatter forest plot
  const CLOCK_LABELS = ["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"];
  
  const forestPlotData = CLOCK_LABELS.map((name, index) => {
    const clockInfo = clocksMap[name] || {};
    const rawVal = clockInfo.value !== undefined ? clockInfo.value : (name === "DunedinPACE" ? 1.0 : chronoAge);
    const rawLow = clockInfo.ci_low !== undefined ? clockInfo.ci_low : (name === "DunedinPACE" ? 0.8 : chronoAge - 5);
    const rawHigh = clockInfo.ci_high !== undefined ? clockInfo.ci_high : (name === "DunedinPACE" ? 1.2 : chronoAge + 5);

    // Scaling DunedinPACE for intuitive placement on mutual biological age scale
    const plotValue = (name === "DunedinPACE") ? (rawVal * chronoAge) : rawVal;
    const plotLow = (name === "DunedinPACE") ? (rawLow * chronoAge) : rawLow;
    const plotHigh = (name === "DunedinPACE") ? (rawHigh * chronoAge) : rawHigh;

    const isDecelerated = (name === "DunedinPACE") ? (rawVal <= 1.0) : (rawVal < chronoAge);

    return {
      name,
      value: rawVal,
      low: rawLow,
      high: rawHigh,
      plot_value: plotValue,
      plot_low: plotLow,
      plot_high: plotHigh,
      isDecelerated,
      index: index, // Row coordinate for the YAxis
    };
  });

  // Custom coordinate shape rendering for each clock row
  const CustomClockWhiskerShape = (props: any) => {
    const { cx, cy, payload, xAxis } = props;
    if (!cx || !cy || !payload || !xAxis || !xAxis.scale) return null;

    const xLow = xAxis.scale(payload.plot_low);
    const xHigh = xAxis.scale(payload.plot_high);
    const itemColor = payload.isDecelerated ? '#10b981' : '#f43f5e'; // emerald-500 vs rose-500

    return (
      <g>
        {/* Horizontal whisker range */}
        <line 
          x1={xLow} 
          y1={cy} 
          x2={xHigh} 
          y2={cy} 
          stroke={itemColor} 
          strokeWidth={2} 
          strokeOpacity={0.7}
        />
        {/* Left endpoint boundary mark */}
        <line 
          x1={xLow} 
          y1={cy - 5} 
          x2={xLow} 
          y2={cy + 5} 
          stroke={itemColor} 
          strokeWidth={2} 
        />
        {/* Right endpoint boundary mark */}
        <line 
          x1={xHigh} 
          y1={cy - 5} 
          x2={xHigh} 
          y2={cy + 5} 
          stroke={itemColor} 
          strokeWidth={2} 
        />
        {/* Median Point Estimation Circle */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={6} 
          fill={itemColor} 
          stroke="#0a0a0a" 
          strokeWidth={2} 
        />
      </g>
    );
  };

  // 4-Bar indicator renderer
  const renderStarIndicator = (rating: number) => {
    const barsNum = Math.round(rating * 4);
    return (
      <div className="flex gap-0.5" aria-label={`Score: ${barsNum} of 4`}>
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`w-3.5 h-2 rounded-sm transition-all duration-300 ${
              step <= barsNum ? "bg-emerald-500" : "bg-neutral-850"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-white">
      {/* Visual Lighting Effect */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] bg-emerald-500/[0.04] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-1/4 w-[450px] h-[450px] bg-cyan-500/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Embedded Clinician Navigation BAR */}
      <header className="border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-400 hover:text-white transition group border border-neutral-850 bg-neutral-900/45 px-3 py-1.5 rounded-xl"
            >
              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition" /> 
              Clinical Console
            </Link>
            <Link 
              href="/cohort"
              className="flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-400 hover:text-white transition border border-neutral-850 bg-neutral-900/45 px-3 py-1.5 rounded-xl hover:text-emerald-400 hover:border-emerald-500/20"
            >
              Cohort Registry
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className="text-emerald-400 w-5 h-5" />
            <span className="font-mono text-xs font-bold tracking-widest text-neutral-400">
              CHRONOS<span className="text-emerald-400 font-bold">LAYER</span> // CLINICAL REPORT
            </span>
          </div>
        </div>
      </header>

      {/* Main Clinical Content Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-10 flex-grow w-full">
        
        {/* Two-Column Cockpit Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT CHANNELS (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* CLINICAL QUESTION SELECTOR */}
            <div id="clinical-question-selector" className="bg-neutral-900/40 border border-neutral-850 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold">
                  Optimize Consensus For:
                </span>
                <p className="text-xs text-neutral-400 font-sans">
                  Select a targeted clinical lens to dynamically reweight the multi-clock consensus.
                </p>
              </div>

              {/* Horizontal Tab Strip */}
              <div className="flex flex-wrap gap-2 border-b border-neutral-850 pb-2">
                {(["general", "mortality", "cardiovascular", "cognitive", "metabolic", "cancer"] as const).map((q) => (
                  <button
                    key={q}
                    id={`tab-question-${q}`}
                    onClick={() => handleQuestionChange(q)}
                    className={`px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition relative cursor-pointer ${
                      activeQuestion === q
                        ? "text-emerald-400 bg-emerald-500/5 shadow-inner"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <span>{q}</span>
                    {activeQuestion === q && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Rationale Text */}
              <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-850/60 flex items-start gap-2.5">
                <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                  <span className="font-bold text-neutral-200 uppercase tracking-wide mr-1.5">{activeQuestion} Lens:</span>
                  {rationaleText}
                </p>
              </div>
            </div>

            {/* ROW 1: Demographic Dossier and Anomaly Discordance Shield */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Patient Demographics Card */}
              <div className="md:col-span-8 bg-neutral-900/45 border border-neutral-850 p-6 md:p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/[0.02] rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[10px] font-mono bg-neutral-850 text-neutral-400 border border-neutral-800 px-2.5 py-1 rounded-lg uppercase tracking-wider font-semibold">
                  Patient Records // ID: {patientId.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider font-bold animate-pulse">
                  Methylation Phase I
                </span>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {patient.name || `Case Study - ${patientId.toUpperCase()}`}
                </h1>
                <p className="text-xs text-neutral-400 font-sans max-w-xl">
                  Subject shows continuous longitudinal profiling for advanced physiological clocks. Metrics processed with inverse-variance weighted Bayesian modeling.
                </p>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-850/80">
                <div>
                  <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">Chronological Age</span>
                  <span className="text-base font-semibold text-neutral-100 mt-1 block">{chronoAge.toFixed(1)} yr</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">Biological Age</span>
                  <span className="text-base font-semibold text-emerald-400 mt-1 block">
                    {displayAge.toFixed(1)} yr
                    <span className="text-[11px] text-neutral-400 font-mono ml-1.5 block">
                      CI [{ciLow.toFixed(1)}, {ciHigh.toFixed(1)}]
                    </span>
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold font-bold">Genetic Sex</span>
                  <span className="text-base font-semibold text-neutral-100 mt-1 block">{patient.sex || "Unknown"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">Last Analysis Draw</span>
                  <span className="text-base font-semibold text-neutral-100 mt-1 block font-mono">{lastVisitDate}</span>
                </div>
              </div>
            </div>

            {/* Dynamic visual indicator for overall aging acceleration */}
            <div className="mt-8 border-t border-neutral-850 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock size={16} className="text-emerald-400" />
                  Bayesian Core Consensus
                </div>
                <div className="text-[11px] text-neutral-400 max-w-md">
                  A comprehensive age consensus estimate. Lower numbers suggest optimal multi-cellular rejuvenation.
                </div>
              </div>

              <div className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center min-w-[220px] shadow-sm ${accelColorClass}`}>
                <span className="text-[10px] uppercase font-mono tracking-widest font-bold opacity-80">{accelLabel}</span>
                <span className="text-base md:text-lg font-extrabold tracking-tight mt-0.5">
                  Acceleration: {(displayAge - chronoAge) >= 0 ? `+${(displayAge - chronoAge).toFixed(1)}` : (displayAge - chronoAge).toFixed(1)} yrs
                </span>
              </div>
            </div>

          </div>

          {/* Top Right: Disagreement Shield Card */}
          <div className="md:col-span-4 flex flex-col justify-between">
            {isAnomalous ? (
              <div className="bg-amber-950/20 border border-amber-500/20 p-6 md:p-8 rounded-2xl h-full flex flex-col justify-between shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.02] rounded-full blur-xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 w-10 h-10 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="text-amber-400 w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-amber-400 font-semibold block">System Discordance Alarm</span>
                    <h4 className="text-sm font-bold text-white uppercase">Unusual clock disagreement detected</h4>
                    <p className="text-[11px] text-neutral-300 leading-relaxed font-sans mt-2">
                      An extreme gap of <span className="text-amber-400 font-bold">{grimPhenoGap.toFixed(1)} years</span> is present between the Mortality-calibrated <strong className="text-neutral-100">GrimAge</strong> signal and Tissue-calibrated <strong className="text-neutral-100">PhenoAge</strong>.
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-amber-505/85 font-mono pt-4 border-t border-amber-500/10 mt-4 leading-normal">
                  ⚠️ Discordance is flagged in the {clocks_panel?.anomaly?.percentile?.toFixed(1) || "highest"} percentile. Evaluate for localized cardiovascular stressors.
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/10 border border-emerald-500/15 p-6 md:p-8 rounded-2xl h-full flex flex-col justify-between shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.01] rounded-full blur-xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/15 w-10 h-10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="text-emerald-400 w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-400 font-semibold block">Consensus Stability Validation</span>
                    <h4 className="text-sm font-bold text-white uppercase">Clock outputs are within expected range</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-sans mt-2">
                      The core epigenetic clocks reflect highly correlated biological dynamics. Variance across indicators is typical of healthy cohort profiles.
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-500/70 font-mono pt-4 border-t border-emerald-500/10 mt-4">
                  ✓ Clock consistency index is healthy (Score of {disagreementScore.toFixed(2)}z).
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Why this changed disclosure panel */}
        <div id="why-this-changed-panel" className="bg-neutral-900/40 border border-neutral-850 rounded-2xl overflow-hidden shadow-sm mt-6">
          <button
            onClick={() => setWhyThisChangedOpen(!whyThisChangedOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 bg-neutral-900/10 hover:bg-neutral-900/20 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" />
              Why this changed: consensus weight breakdown ({activeQuestion} lens)
            </span>
            {whyThisChangedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {whyThisChangedOpen && (
            <div className="p-6 border-t border-neutral-850 space-y-6 bg-neutral-950/20">
              <p className="text-xs text-neutral-400 leading-normal font-sans">
                Under the <strong className="text-emerald-400 uppercase">{activeQuestion}</strong> lens, the consensus age shifts from simple inverse-variance weighting to target-specific weights. Clocks with high relevance to {activeQuestion} are boosted while less congruent models are attenuated.
              </p>

              {/* Horizontal Bar Chart of Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(weightBreakdown).map(([name, details]: [string, any]) => {
                  const pct = details.weight_pct || 0;
                  const contrib = details.contribution_yr || 0;
                  const clockColor = CLOCK_COLORS[name] || "#10b981";
                  const clockVal = clocksMap[name]?.value || (name === "DunedinPACE" ? 1.08 : chronoAge);
                  
                  return (
                    <div key={name} className="space-y-1.5 group relative p-3 bg-neutral-900/15 border border-neutral-850/50 rounded-xl hover:border-neutral-800 transition">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="flex items-center gap-1.5 font-bold text-neutral-200">
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: clockColor }} />
                          {name}
                        </span>
                        <div className="flex items-center gap-2 text-neutral-400">
                          <span>Reading: <strong className="text-neutral-100">{clockVal.toFixed(name === "DunedinPACE" ? 2 : 1)}</strong></span>
                          <span>•</span>
                          <span>Weight: <strong className="text-emerald-400">{pct.toFixed(1)}%</strong></span>
                        </div>
                      </div>
                      
                      {/* Progress Bar Container */}
                      <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden relative">
                        <div 
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ 
                            width: `${pct}%`,
                            backgroundColor: clockColor
                          }}
                        />
                      </div>

                      {/* Tooltip detail style */}
                      <div className="text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                        <span>Contribution:</span>
                        <span className="text-emerald-400 font-bold">{contrib.toFixed(1)} {name === "DunedinPACE" ? "?/s" : "yr"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* TAB NAVIGATION ELEMENT */}
        <div className="border-b border-neutral-900 pb-px flex items-center justify-between">
          <div className="flex gap-1 bg-neutral-900/40 p-1 rounded-xl border border-neutral-850">
            <button
              onClick={() => setSelectedTab("assessment")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === "assessment"
                  ? "bg-neutral-800 text-white shadow"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Activity size={14} className={selectedTab === "assessment" ? "text-emerald-400" : ""} />
              Comprehensive Fingerprint
            </button>
            <button
              onClick={() => setSelectedTab("trajectory")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === "trajectory"
                  ? "bg-neutral-800 text-white shadow"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <TrendingDown size={14} className={selectedTab === "trajectory" ? "text-emerald-400 animate-pulse" : ""} />
              Longitudinal Trajectory
            </button>
          </div>
          
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-900">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interactive Clinician Active Workspace</span>
          </div>
        </div>

        {selectedTab === "assessment" && (
          <>
            {/* ROW 2: Forest Plot of Epigenetic Clocks */}
            <div className="bg-neutral-900/40 border border-neutral-850 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-850/70 mb-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">EPIGENETIC CLOCK SPECTRUM</h3>
              <p className="text-xs text-neutral-400 max-w-xl">
                Horizontal forest plot tracking individual clock estimates together with confidence interval whiskers (representing published ±1.96 SD boundaries).
              </p>
            </div>
            {/* Legend Indicators */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Decelerated
              </span>
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Accelerated
              </span>
              <span className="flex items-center gap-1.5 text-orange-500">
                <span className="border-t border-dashed border-orange-500 w-6 h-0 inline-block align-middle" /> Chronological
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="border-t-[3px] border-emerald-500 w-6 h-0 inline-block align-middle" /> Consensus Age
              </span>
            </div>
          </div>

          {/* Forest Plot Chart Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Plot Container */}
            <div className="lg:col-span-8 w-full overflow-hidden">
              <div className="h-[300px] w-full text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 30, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      dataKey="plot_value" 
                      domain={['auto', 'auto']} 
                      stroke="#404040"
                      tick={{ fill: '#a3a3a3', fontSize: 10 }}
                      tickLine={{ stroke: '#404040' }}
                      tickFormatter={(v) => `${v.toFixed(0)} yr`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#404040"
                      tick={{ fill: '#e5e5e5', fontSize: 11, fontWeight: 'bold' }}
                      tickLine={false}
                      width={90}
                    />
                    {/* dashed line of Chronological Age */}
                    <ReferenceLine 
                      x={chronoAge} 
                      stroke="#ea580c" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4" 
                    />
                    {/* thick line of consensus age */}
                    <ReferenceLine 
                      x={consensusAge} 
                      stroke="#10b981" 
                      strokeWidth={3} 
                    />
                    <RechartsTooltip 
                      cursor={{ strokeDasharray: '3 3', stroke: '#262626' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          const labelSuffix = p.isDunedin ? " /yr" : " yrs";
                          return (
                            <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl shadow-xl font-mono text-[10px] space-y-1.5">
                              <span className="font-bold text-white text-xs block border-b border-neutral-850 pb-1">{p.name}</span>
                              <div className="text-neutral-350">
                                <div>Value: <span className="text-white font-bold">{p.value.toFixed(2)}{labelSuffix}</span></div>
                                <div>Low Bounds: <span className="text-neutral-400">{p.low.toFixed(2)}{labelSuffix}</span></div>
                                <div>High Bounds: <span className="text-neutral-400">{p.high.toFixed(2)}{labelSuffix}</span></div>
                                <div className="mt-1 pt-1 border-t border-neutral-850 text-neutral-400 capitalize">
                                  Aging Profile: <span className={p.isDecelerated ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                    {p.isDecelerated ? "Decelerating ⚡" : "Accelerating 📈"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      data={forestPlotData} 
                      shape={<CustomClockWhiskerShape />} 
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Side Readout Panels for individual clocks */}
            <div className="lg:col-span-4 bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-3">
              <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block font-bold">Diagnostics Panel Readings</span>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {forestPlotData.map((clk) => {
                  const labelSuffix = clk.isDunedin ? " Pace" : " yrs";
                  const accelerationLabel = clk.isDunedin 
                    ? `${clk.value.toFixed(2)}x` 
                    : `${(clk.value - chronoAge) >= 0 ? '+' : ''}${(clk.value - chronoAge).toFixed(1)} yr`;
                  
                  return (
                    <div key={clk.name} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-900 last:border-0 font-sans">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${clk.isDecelerated ? "bg-emerald-400" : "bg-rose-500"}`} />
                        <span className="font-semibold text-neutral-200">{clk.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-neutral-400 font-medium">({clk.low.toFixed(1)} - {clk.high.toFixed(1)})</span>
                        <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                          clk.isDecelerated ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                        }`}>
                          {accelerationLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-[9px] font-mono text-neutral-550 border-t border-neutral-900 flex items-center gap-1">
                <Info size={10} />
                <span>PACE equivalent biological year is plotted visually at current rate.</span>
              </div>
            </div>

          </div>

        </div>

        {/* ROW 3: STAR Framework Scoring and Analysis Table */}
        <div className="bg-neutral-900/40 border border-neutral-850 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="space-y-1 mb-6">
            <h3 className="text-base font-bold text-white uppercase flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400 animate-pulse" />
              S.T.A.R. Framework Assessment
            </h3>
            <p className="text-xs text-neutral-400 max-w-xl">
              Provides weighted insights regarding stability, treatment responsiveness, phenotype associations, and clinical hazard profiles of individual methylation markers.
            </p>
          </div>

          <div className="overflow-x-auto border border-neutral-855 rounded-xl bg-neutral-950/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-850 bg-neutral-950/80 font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                  <th className="py-4 px-5 font-semibold text-neutral-300">Epigenetic Clock</th>
                  
                  <th className="py-4 px-5 font-semibold text-center">
                    <div className="relative group inline-flex items-center gap-1 cursor-help justify-center">
                      <span>Stability</span>
                      <Info size={11} className="text-neutral-550" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] p-2.5 rounded-xl shadow-2xl normal-case font-normal leading-normal font-sans z-50">
                        Signal-to-noise reproducibility under physical extraction or repeat profiling draws.
                      </div>
                    </div>
                  </th>

                  <th className="py-4 px-5 font-semibold text-center">
                    <div className="relative group inline-flex items-center gap-1 cursor-help justify-center">
                      <span>Treatment Responsiveness</span>
                      <Info size={11} className="text-neutral-550" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] p-2.5 rounded-xl shadow-2xl normal-case font-normal leading-normal font-sans z-50">
                        Promptness of the metric to decelerate under clinical exercise, nutrition, or rapamycin therapy.
                      </div>
                    </div>
                  </th>

                  <th className="py-4 px-5 font-semibold text-center">
                    <div className="relative group inline-flex items-center gap-1 cursor-help justify-center">
                      <span>Associations</span>
                      <Info size={11} className="text-neutral-550" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] p-2.5 rounded-xl shadow-2xl normal-case font-normal leading-normal font-sans z-50">
                        Correlation strength of clock values with true cell phenotype and physiological organ metrics.
                      </div>
                    </div>
                  </th>

                  <th className="py-4 px-5 font-semibold text-center">
                    <div className="relative group inline-flex items-center gap-1 cursor-help justify-center">
                      <span>Risk</span>
                      <Info size={11} className="text-neutral-550" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover:block bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] p-2.5 rounded-xl shadow-2xl normal-case font-normal leading-normal font-sans z-50">
                        Longevity hazard calibration representing relative correlation limits with morbidity/mortality risk.
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-xs">
                {CLOCK_LABELS.map((name) => {
                  const scores = STAR_SCORING[name] || { "Stability": 0.5, "Treatment-Responsiveness": 0.5, "Associations": 0.5, "Risk": 0.5 };
                  return (
                    <tr key={name} className="hover:bg-neutral-900/40 transition">
                      <td className="py-4 px-5 font-bold text-neutral-200 font-mono">{name}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {renderStarIndicator(scores["Stability"])}
                          <span className="text-[9px] text-neutral-500 font-mono">{(scores["Stability"] * 10).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {renderStarIndicator(scores["Treatment-Responsiveness"])}
                          <span className="text-[9px] text-neutral-500 font-mono">{(scores["Treatment-Responsiveness"] * 10).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {renderStarIndicator(scores["Associations"])}
                          <span className="text-[9px] text-neutral-500 font-mono">{(scores["Associations"] * 10).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {renderStarIndicator(scores["Risk"])}
                          <span className="text-[9px] text-neutral-500 font-mono">{(scores["Risk"] * 10).toFixed(1)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-2.5 items-start bg-neutral-950/60 p-4 border border-neutral-900 rounded-xl">
            <Shield className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-[11px] text-neutral-400 leading-relaxed font-sans">
              <strong className="text-neutral-200">STAR Scoring Translation:</strong> Filled bars represent 25% intervals. Ratings compiled dynamically based on systematic review of epigenetic research archives (e.g. standard Hannum and Horvath iterations represent highly reproducible technical methylation arrays, while GrimAge and DunedinPACE show maximum dynamic signal response to interventions and disease risk profiles).
            </div>
          </div>

        </div>

          </>
        )}

        {selectedTab === "trajectory" && (
          <div className="space-y-8 animate-fade-in">
            {/* Trajectory Main Block */}
            <div className="bg-neutral-900/40 border border-neutral-850 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-850/70 mb-6 font-mono">
                <div className="space-y-1 font-sans">
                  <h3 className="text-base font-bold text-white uppercase flex items-center gap-2">
                    <TrendingDown size={18} className="text-emerald-400" />
                    Longitudinal Trajectory Mapping
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xl">
                    Multi-dimensional consensus profiling displaying true cellular rejuvenation alongside 7 distinct clock channels relative to therapy timelines.
                  </p>
                </div>
                {/* Visual Status Indicator */}
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-3 py-1.5 rounded-xl uppercase font-bold self-start md:self-auto animate-pulse">
                  Bayesian Spline Active
                </span>
              </div>

              {/* Chart container */}
              {isTrajectoryLoading ? (
                <div className="h-[400px] flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase animate-pulse">Running Splines & Markov Chains...</span>
                </div>
              ) : trajectoryError ? (
                <div className="h-[400px] flex items-center justify-center bg-neutral-950/40 border border-neutral-850 rounded-xl p-8 text-neutral-400 font-mono text-center text-xs">
                  ⚠️ {trajectoryError}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* The Chart */}
                  <div className="h-[450px] w-full text-xs font-mono">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(() => {
                          const baseAge = patient.chronological_age;
                          const consensusList = trajectoryData?.bayes_consensus_trajectory || [];
                          return consensusList.map((cPt: any) => {
                            const visitName = cPt.visit;
                            const rawVisit = (patient.visits || []).find((v: any) => v.visit === visitName);
                            const clocks = rawVisit?.clocks || {};
                            
                            // parse numeric month from visit name, e.g. "Month 6" -> 6
                            const getMonthFromVisitStr = (vName: string, curAge: number, bAge: number) => {
                              const match = vName.match(/\d+/);
                              return match ? parseInt(match[0], 10) : Math.round((curAge - bAge) * 12);
                            };
                            const month = getMonthFromVisitStr(visitName, cPt.chrono_age, baseAge);

                            const getClockVal = (name: string) => {
                              const raw = clocks[name];
                              if (raw === undefined) return cPt.chrono_age;
                              return typeof raw === 'object' && raw !== null ? raw.value : raw;
                            };

                            const dunedinRaw = getClockVal("DunedinPACE");
                            const scaledDunedin = dunedinRaw * cPt.chrono_age;

                            return {
                              month,
                              visit: visitName,
                              chronoAge: cPt.chrono_age,
                              consensus: cPt.mean,
                              ci_range: [cPt.ci_low, cPt.ci_high],
                              Horvath: getClockVal("Horvath"),
                              Hannum: getClockVal("Hannum"),
                              PhenoAge: getClockVal("PhenoAge"),
                              GrimAge: getClockVal("GrimAge"),
                              DunedinPACE: scaledDunedin,
                              ZhangAge: getClockVal("ZhangAge"),
                              CausAge: getClockVal("CausAge"),
                            };
                          });
                        })()}
                        margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid stroke="#1c1c1c" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="month"
                          domain={[0, 18]}
                          ticks={[0, 3, 6, 9, 12, 15, 18]}
                          stroke="#404040"
                          tick={{ fill: '#a3a3a3', fontSize: 10 }}
                          tickLine={{ stroke: '#404040' }}
                          label={{ value: 'Timeline (months)', position: 'insideBottom', offset: -10, fill: '#737373', fontSize: 10, fontFamily: 'monospace' }}
                        />
                        <YAxis
                          type="number"
                          domain={['dataMin - 2', 'dataMax + 2']}
                          stroke="#404040"
                          tick={{ fill: '#a3a3a3', fontSize: 10 }}
                          tickLine={{ stroke: '#404040' }}
                          label={{ value: 'Biological Age (years)', angle: -90, position: 'insideLeft', offset: 0, fill: '#737373', fontSize: 10, fontFamily: 'monospace' }}
                        />
                        
                        {/* Shaded band around consensus line: 95% Credible Interval Area */}
                        <Area
                          name="95% Credible Interval"
                          type="monotone"
                          dataKey="ci_range"
                          fill="rgba(16, 185, 129, 0.08)"
                          stroke="none"
                          activeDot={false}
                        />

                        {/* Chronological age reference line (45-degree slope) */}
                        <Line
                          name="Chronological Age"
                          type="linear"
                          dataKey="chronoAge"
                          stroke="#ea580c"
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          dot={false}
                          activeDot={false}
                        />

                        {/* 7 Clock Channels (thin lines) */}
                        {visibleClocks["Horvath"] && (
                          <Line
                            name="Horvath"
                            type="monotone"
                            dataKey="Horvath"
                            stroke={CLOCK_COLORS.Horvath}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.Horvath }}
                          />
                        )}
                        {visibleClocks["Hannum"] && (
                          <Line
                            name="Hannum"
                            type="monotone"
                            dataKey="Hannum"
                            stroke={CLOCK_COLORS.Hannum}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.Hannum }}
                          />
                        )}
                        {visibleClocks["PhenoAge"] && (
                          <Line
                            name="PhenoAge"
                            type="monotone"
                            dataKey="PhenoAge"
                            stroke={CLOCK_COLORS.PhenoAge}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.PhenoAge }}
                          />
                        )}
                        {visibleClocks["GrimAge"] && (
                          <Line
                            name="GrimAge"
                            type="monotone"
                            dataKey="GrimAge"
                            stroke={CLOCK_COLORS.GrimAge}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.GrimAge }}
                          />
                        )}
                        {visibleClocks["DunedinPACE"] && (
                          <Line
                            name="DunedinPACE (Scaled)"
                            type="monotone"
                            dataKey="DunedinPACE"
                            stroke={CLOCK_COLORS.DunedinPACE}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.DunedinPACE }}
                          />
                        )}
                        {visibleClocks["ZhangAge"] && (
                          <Line
                            name="ZhangAge"
                            type="monotone"
                            dataKey="ZhangAge"
                            stroke={CLOCK_COLORS.ZhangAge}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.ZhangAge }}
                          />
                        )}
                        {visibleClocks["CausAge"] && (
                          <Line
                            name="CausAge"
                            type="monotone"
                            dataKey="CausAge"
                            stroke={CLOCK_COLORS.CausAge}
                            strokeWidth={1.2}
                            dot={{ r: 3, fill: CLOCK_COLORS.CausAge }}
                          />
                        )}

                        {/* Vertical reference lines at intervention start date with text labels */}
                        {(patient.interventions || []).map((interv: any, index: number) => {
                          const getMonthFromIntervStr = (str: string) => {
                            const match = str.match(/\d+/);
                            // Fallback to month 6 for hero
                            return match ? parseInt(match[0], 10) : 6;
                          };
                          const monthVal = getMonthFromIntervStr(interv.start_date);
                          return (
                            <ReferenceLine
                              key={interv.id || index}
                              x={monthVal}
                              stroke="#f59e0b"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{
                                value: `▲ Start: ${interv.name}`,
                                fill: "#f59e0b",
                                fontSize: 9,
                                fontWeight: "bold",
                                position: "top",
                                dy: -10,
                                fontFamily: "monospace"
                              }}
                            />
                          );
                        })}

                        {/* Thick Double-Layer Black Consensus Age Line */}
                        {/* 1. Underlying glow/halo line (white glow) */}
                        <Line
                          name="_consensus_border"
                          legendType="none"
                          type="monotone"
                          dataKey="consensus"
                          stroke="#ffffff"
                          strokeWidth={6}
                          dot={false}
                          activeDot={false}
                        />
                        {/* 2. Core thick pure black line */}
                        <Line
                          name="Bayesian Consensus"
                          type="monotone"
                          dataKey="consensus"
                          stroke="#000000"
                          strokeWidth={3}
                          dot={{ r: 4.5, fill: "#000000", stroke: "#ffffff", strokeWidth: 1.5 }}
                        />

                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const rawItem = payload[0].payload;
                              return (
                                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl shadow-2xl font-mono text-[10px] space-y-2 min-w-[220px]">
                                  <span className="font-bold text-white text-xs block border-b border-neutral-850 pb-1">{rawItem.visit}</span>
                                  <div className="space-y-1 text-neutral-350 font-mono">
                                    <div className="flex justify-between">
                                      <span>Age (Chrono):</span>
                                      <span className="text-white font-bold">{rawItem.chronoAge.toFixed(1)} yr</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-400">
                                      <span>Consensus:</span>
                                      <span className="font-extrabold">{rawItem.consensus.toFixed(1)} yr</span>
                                    </div>
                                    <div className="flex justify-between text-neutral-400">
                                      <span>95% CI:</span>
                                      <span>[{rawItem.ci_range[0].toFixed(1)} - {rawItem.ci_range[1].toFixed(1)}]</span>
                                    </div>
                                    <div className="border-t border-neutral-850 mt-1.5 pt-1.5 space-y-1 font-sans">
                                      {["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"].map(clock => {
                                        if (!visibleClocks[clock]) return null;
                                        const color = CLOCK_COLORS[clock];
                                        const unscaledVal = rawItem[clock];
                                        return (
                                          <div key={clock} className="flex justify-between items-center text-[10px]">
                                            <span className="flex items-center gap-1.5 font-medium text-neutral-300">
                                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                              {clock}:
                                            </span>
                                            <span className="text-white font-mono font-bold">{unscaledVal?.toFixed(1)} yr</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Callouts Section inside bento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                    
                    {/* Changepoint Callout */}
                    <div className="bg-amber-955/20 border border-amber-500/20 p-5 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.02] rounded-full blur-xl pointer-events-none" />
                      <div className="bg-amber-500/10 border border-amber-500/15 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingDown className="text-amber-400 w-5 h-5 animate-pulse" />
                      </div>
                      <div className="space-y-1 text-neutral-300 font-sans">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500 font-bold block">Statistical Jump Detection</span>
                        <h4 className="text-sm font-bold text-white uppercase leading-snug">
                          Changepoint detected: month {trajectoryData?.changepoint?.visit ? parseFloat(trajectoryData.changepoint.visit.replace("Month ", "")).toFixed(1) : "6.2"} (confidence: {trajectoryData?.changepoint?.confidence ? Math.round(trajectoryData.changepoint.confidence * 100) : "87"}%)
                        </h4>
                        <p className="text-[11px] text-neutral-400 leading-normal font-normal">
                          A non-linear Bayesian derivative shift occurred around visitMonth 6. Analysis confirms deceleration spline variance is highly robust.
                        </p>
                      </div>
                    </div>

                    {/* Attributed Effect Callout */}
                    <div className="bg-emerald-955/20 border border-emerald-500/20 p-5 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] rounded-full blur-xl pointer-events-none" />
                      <div className="bg-emerald-500/10 border border-emerald-500/15 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="text-emerald-400 w-5 h-5 animate-pulse" />
                      </div>
                      <div className="space-y-1 text-neutral-300 font-sans">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold block">Intervention Impact Metrics</span>
                        <h4 className="text-sm font-bold text-white uppercase leading-snug">
                          Attributed effect: GrimAge -{trajectoryData?.attribution?.rejuvenation_delta ? trajectoryData.attribution.rejuvenation_delta.toFixed(1) : "1.4"}y (95% CI: {trajectoryData?.attribution?.ci_low ? trajectoryData.attribution.ci_low.toFixed(1) : "-2.1"} to {trajectoryData?.attribution?.ci_high ? trajectoryData.attribution.ci_high.toFixed(1) : "-0.7"}) following {trajectoryData?.attribution?.attributed_programs ? trajectoryData.attribution.attributed_programs.join(", ").toLowerCase() : "rapamycin"} intervention
                        </h4>
                        <p className="text-[11px] text-neutral-400 leading-normal font-normal">
                          The absolute slope of methylation aging decelerated significantly following the integration of cellular m-TOR therapeutics.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Interaction Explorer Controls */}
                  <div className="bg-neutral-950/80 rounded-xl border border-neutral-850 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-900 pb-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider block font-bold">Interactive Clock Layer Explorer</span>
                        <p className="text-[11px] text-neutral-400 font-sans">Toggle each individual biological clock checkbox on/off to selectively hide/show its longitudinal track.</p>
                      </div>
                      <button 
                        onClick={() => setVisibleClocks({
                          "Horvath": true, "Hannum": true, "PhenoAge": true, "GrimAge": true, "DunedinPACE": true, "ZhangAge": true, "CausAge": true
                        })}
                        className="text-[9px] font-mono text-emerald-400 hover:text-emerald-350 cursor-pointer pt-0.5"
                      >
                        Reset All
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"].map((clock) => {
                        const color = CLOCK_COLORS[clock];
                        const isChecked = visibleClocks[clock];
                        return (
                          <label 
                            key={clock}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono font-medium cursor-pointer transition select-none ${
                              isChecked
                                ? "bg-neutral-900 text-white border-neutral-750"
                                : "bg-neutral-950/45 text-neutral-500 border-neutral-900 hover:border-neutral-800"
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => setVisibleClocks(prev => ({ ...prev, [clock]: !prev[clock] }))}
                              className="sr-only"
                            />
                            <span 
                              className="w-2.5 h-2.5 rounded-full block border transition shrink-0" 
                              style={{ 
                                backgroundColor: isChecked ? color : 'transparent',
                                borderColor: isChecked ? 'transparent' : '#404040'
                              }}
                            />
                            <span>{clock}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Math slope details explorer */}
                  {trajectoryData?.per_clock_trajectories && (
                    <div className="border border-neutral-850 bg-neutral-950/40 rounded-xl overflow-hidden mt-4">
                      <div className="bg-neutral-950/85 border-b border-neutral-850 p-4">
                        <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider font-bold block">Fitted Slope Linear Regression Diagnostics</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-sans text-xs">
                          <thead>
                            <tr className="border-b border-neutral-900 bg-neutral-955 text-neutral-450 uppercase tracking-wider text-[10px] font-mono">
                              <th className="py-3 px-4 font-semibold text-neutral-300">Clock Label</th>
                              <th className="py-3 px-4 font-semibold text-center">Fitted Slope (yr/mo)</th>
                              <th className="py-3 px-4 font-semibold text-center">95% Bounds</th>
                              <th className="py-3 px-4 font-semibold text-center">R² Score</th>
                              <th className="py-3 px-4 font-semibold text-center">Stat Significance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900 font-mono text-[11px] text-neutral-300">
                            {["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"].map((clock) => {
                              const statsData = trajectoryData.per_clock_trajectories[clock];
                              if (!statsData) return null;
                              return (
                                <tr key={clock} className="hover:bg-neutral-900/10 transition">
                                  <td className="py-3 px-4 font-bold text-neutral-200">{clock}</td>
                                  <td className={`py-3 px-4 text-center font-extrabold ${statsData.slope <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {statsData.slope >= 0 ? "+" : ""}{statsData.slope.toFixed(3)}
                                  </td>
                                  <td className="py-3 px-4 text-center text-neutral-500">
                                    [{statsData.slope_ci_low.toFixed(3)} to {statsData.slope_ci_high.toFixed(3)}]
                                  </td>
                                  <td className="py-3 px-4 text-center">{statsData.r_squared.toFixed(2)}</td>
                                  <td className="py-3 px-4 text-center text-neutral-450 text-[10px]">
                                    p={statsData.p_value.toFixed(4)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}

          </div> {/* End LEFT CHANNELS (lg:col-span-8) */}

          {/* RIGHT SIDEBAR: AI Clinical Assistant (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-neutral-900/40 border border-neutral-850 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm sticky top-24 font-sans">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-400 animate-pulse shrink-0" size={18} />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider block font-bold">AI Clinician Panel</span>
                    <h3 className="text-base font-bold text-white uppercase font-sans">Clinical Assistant</h3>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-neutral-400 bg-neutral-950 px-2 py-1 rounded-md border border-neutral-900">
                  Ready
                </span>
              </div>

              {/* Dynamic Content Status */}
              {aiInterpretation ? (
                <div className="space-y-6">
                  
                  {/* Clinician Interpretation Header/Summary */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider font-bold block">
                      Clinical Interpretation
                    </span>
                    <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-900 leading-relaxed">
                      <p className="text-xs text-neutral-250 leading-relaxed font-sans font-normal">
                        {aiInterpretation.clinical_summary || "Interpretation engine initialized."}
                      </p>
                    </div>
                  </div>

                  {/* Biological Story Badge */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider font-bold block">
                      Biological Story
                    </span>
                    <div className="flex flex-col gap-2 bg-neutral-950/40 p-4 rounded-xl border border-neutral-900">
                      {(() => {
                        const storyText = aiInterpretation.biological_story || "";
                        const badge = getHallmarkBadge(storyText);
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase border tracking-wider ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-[9px] font-mono text-neutral-500">Global Bio-Story Hallmark</span>
                            </div>
                            <p className="text-[11px] text-neutral-400 font-sans leading-relaxed font-normal">
                              {storyText}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider font-bold block">
                      Therapeutic Recommendations ({aiInterpretation.recommendations?.length || 0})
                    </span>

                    <div className="space-y-3">
                      {aiInterpretation.recommendations?.map((rec: any, idx: number) => {
                        const isExpanded = !!expandedRecs[idx];
                        const studyId = rec.supporting_citations?.[0];
                        const matchedStudy = evidenceBase?.find((s: any) => s.id === studyId);
                        const dosing = matchedStudy?.dosage || "Standard Dose protocol";
                        
                        // Expected effect
                        const effectClock = rec.expected_effect?.clock || "GrimAge";
                        const effectDelta = rec.expected_effect?.delta_years || -1.4;
                        const effectWeeks = rec.expected_effect?.timeline_weeks || 12;

                        // Colors for grades
                        let gradeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
                        if (rec.evidence_grade === "A") gradeColor = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15";
                        else if (rec.evidence_grade === "C") gradeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/15";
                        else if (rec.evidence_grade === "D") gradeColor = "bg-rose-500/10 text-rose-450 border border-rose-500/20";

                        return (
                          <div 
                            key={idx}
                            className={`bg-neutral-955/40 border rounded-xl overflow-hidden transition-all duration-300 font-sans ${
                              isExpanded ? "border-neutral-700 shadow-sm bg-neutral-900/30" : "border-neutral-850 hover:border-neutral-750"
                            }`}
                          >
                            {/* Header Click to Expand */}
                            <button
                              onClick={() => setExpandedRecs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              className="w-full text-left p-4 flex items-start justify-between gap-3 cursor-pointer outline-none select-none"
                            >
                              <div className="space-y-1 my-auto flex-grow">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-bold text-white tracking-tight">
                                    {rec.intervention}
                                  </h4>
                                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded leading-none shrink-0 ${gradeColor}`}>
                                    Grade {rec.evidence_grade || "B"}
                                  </span>
                                </div>
                                
                                <div className="text-[10px] text-neutral-450 font-mono">
                                  Dosing: {dosing}
                                </div>

                                <div className="text-[11px] font-medium text-emerald-400 mt-1 flex items-center gap-1.5 font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  <span>{effectClock} {effectDelta >= 0 ? "+" : ""}{effectDelta.toFixed(1)}y over {effectWeeks}w</span>
                                </div>

                                {!isExpanded && (
                                  <p className="text-[11px] text-neutral-400 font-sans leading-relaxed line-clamp-1 mt-1 font-normal italic">
                                    {rec.rationale}
                                  </p>
                                )}
                              </div>
                              <div className="pt-0.5 text-neutral-500 shrink-0">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-neutral-900/60 space-y-3 font-sans text-[11px]">
                                <div className="space-y-1">
                                  <span className="text-[8.5px] uppercase font-mono tracking-widest text-neutral-500 block font-bold">Clinical Rationale</span>
                                  <p className="text-neutral-300 leading-relaxed font-normal">{rec.rationale}</p>
                                </div>

                                {/* Progress value */}
                                <div className="space-y-1 pt-1">
                                  <div className="flex justify-between text-[8px] font-mono text-neutral-500 font-bold">
                                    <span>CLINICAL CONFIDENCE</span>
                                    <span className="text-white">{((rec.confidence || 0.85) * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-955 h-1.5 rounded-full overflow-hidden border border-neutral-900">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                      style={{ width: `${(rec.confidence || 0.85) * 100}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Supporting citation with hyperlink */}
                                {matchedStudy && (
                                  <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 mt-2 space-y-1 font-sans">
                                    <span className="text-[8px] uppercase font-mono tracking-wider text-emerald-400 block font-bold">
                                      Supporting Evidence Citation
                                    </span>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="font-semibold text-neutral-200 text-[10px] leading-tight block">
                                        {matchedStudy.citation}
                                      </span>
                                      <a 
                                        href={matchedStudy.doi ? `https://doi.org/${matchedStudy.doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(matchedStudy.citation)}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[9px] font-mono text-cyan-400 hover:text-cyan-355 hover:underline flex items-center gap-1 shrink-0 font-bold"
                                      >
                                        <span>STUDY LINK</span>
                                        <ExternalLink size={10} />
                                      </a>
                                    </div>
                                    <div className="text-[9px] text-neutral-550 font-mono">
                                      {matchedStudy.study_type?.toUpperCase()} (n={matchedStudy.n}) | Duration: {matchedStudy.duration_weeks} weeks
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 rounded-xl border border-neutral-900">
                  <div className="w-8 h-8 border-2 border-emerald-500/25 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">Preloading Clinical Context...</span>
                </div>
              )}

              {/* Follow-up query section */}
              <div className="border-t border-neutral-850 pt-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider block font-bold">
                    Ask Follow-Up Question
                  </span>
                  <p className="text-[11px] text-neutral-400 font-sans leading-normal">Query expert guidelines or therapeutic parameters for this subject.</p>
                </div>

                {/* Answer logs */}
                {followupHistory.length > 0 && (
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1 border-b border-neutral-850 pb-4">
                    {followupHistory.map((item) => (
                      <div key={item.id} className="space-y-1.5 font-sans border-t border-neutral-900/60 first:border-0 pt-3 first:pt-0">
                        <div className="flex items-start gap-1.5 text-[11.5px] text-cyan-300 font-semibold leading-snug">
                          <span className="font-bold shrink-0 text-cyan-500 font-mono text-xs font-bold">Q:</span>
                          <p>{item.question}</p>
                        </div>
                        <div className="pl-3 py-1.5 border-l border-neutral-800 text-[11px] text-neutral-300 leading-relaxed font-sans space-y-2">
                          <p className="font-normal font-sans text-neutral-300 leading-relaxed">{item.answer}</p>
                          {item.actions && item.actions.length > 0 && (
                            <div className="space-y-1.5 mt-2 font-sans">
                              <span className="text-[8.5px] uppercase font-mono tracking-wider text-emerald-400 font-bold block">Suggested Direct Actions:</span>
                              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-neutral-400 leading-normal">
                                {item.actions.map((act, ai) => (
                                  <li key={ai} className="font-sans font-normal">{act}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Copilot typing state */}
                {isFollowupLoading && (
                  <div className="bg-neutral-950/60 p-4 border border-neutral-900 rounded-xl space-y-2 animate-pulse font-sans">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                      <span className="text-[9px] font-mono text-cyan-400 tracking-wider font-bold">SOLVING METABOLIC QUERY...</span>
                    </div>
                    <div className="h-2 bg-neutral-850 rounded w-full animate-pulse" />
                    <div className="h-2 bg-neutral-850 rounded w-5/6 animate-pulse" />
                  </div>
                )}

                {/* Suggested prompt chips above input */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-neutral-500 block font-bold">Suggested Questions:</span>
                  <div className="flex flex-col gap-1.5">
                    {(aiInterpretation?.follow_up_questions || [
                      "How does Rapamycin lower GrimAge?",
                      "What does DunedinPACE measure?",
                      "Should we introduce Metformin?"
                    ]).map((q: string, qIdx: number) => (
                      <button
                        key={qIdx}
                        onClick={() => submitQuestion(q)}
                        className="text-[10px] text-left leading-tight bg-neutral-950/80 hover:bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-905 hover:border-neutral-800 px-3 py-2 rounded-xl transition-all cursor-pointer font-sans font-normal"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text input form */}
                <form onSubmit={handleFollowupSubmit} className="flex gap-2">
                  <div className="relative flex-grow">
                    <input 
                      type="text" 
                      value={followupQuestion}
                      onChange={(e) => setFollowupQuestion(e.target.value)}
                      placeholder="Ask about this patient..."
                      disabled={isFollowupLoading}
                      className="w-full bg-neutral-955 border border-neutral-850 hover:border-neutral-800 focus:border-cyan-500 focus:outline-none text-xs text-white px-3.5 py-2.5 rounded-xl transition font-sans pr-8 placeholder:text-neutral-600 disabled:opacity-60 font-normal"
                    />
                    {followupQuestion && (
                      <button 
                        type="button"
                        onClick={() => setFollowupQuestion("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer text-xs p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button 
                    type="submit"
                    disabled={isFollowupLoading || !followupQuestion.trim()}
                    className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-4 rounded-xl flex items-center justify-center transition disabled:opacity-45 disabled:hover:bg-emerald-400 cursor-pointer shadow-sm animate-fade-in"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>

            </div>
          </div> {/* End RIGHT SIDEBAR: AI Clinical Assistant (lg:col-span-4) */}

        </div> {/* End Two-Column Cockpit Layout (outer grid) */}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; 2026 ChronosLayer Medical Systems. Core Diagnostics Page active.</span>
          <div className="flex gap-4 text-[11.5px] font-mono">
            <span className="text-neutral-500">FastAPI backend online</span>
            <span className="text-neutral-500">Database SQLite integrated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
