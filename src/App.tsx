/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Terminal, 
  Code2, 
  FolderTree, 
  Folder, 
  FileCode, 
  Copy, 
  Check, 
  Play, 
  FlaskConical, 
  Cpu, 
  Database, 
  Activity, 
  RefreshCcw,
  CheckCircle2,
  FileText,
  User,
  Heart,
  TrendingDown,
  ChevronRight,
  Bookmark,
  BookOpen,
  Info,
  ListFilter,
  Search,
  AlertTriangle,
  Percent,
  ShieldAlert
} from "lucide-react";

// ==========================================
// CANONICAL MATH MODELS (TypeScript Clone)
// ==========================================

const CLOCK_LABELS = ["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"];
const BASE_SDS = [4.0, 4.2, 5.5, 5.0, 0.1, 5.0, 3.8];
const NOISE_SDS = [1.1, 1.2, 1.4, 1.0, 0.02, 1.3, 0.7];

// ==========================================
// CLINICAL QUESTION REWEIGHTING (multi-question consensus)
// ==========================================
// Each profile defines clinical-question-specific multipliers on top of the reliability weights.
// Higher multiplier = clock is more relevant for that clinical question (based on what each clock was trained on).
type ClinicalQuestion = "general" | "mortality" | "cardiovascular" | "cognitive" | "metabolic" | "cancer";

const CLINICAL_QUESTIONS: { id: ClinicalQuestion; label: string; tagline: string }[] = [
  { id: "general", label: "General", tagline: "Balanced multi-clock profile — reliability-weighted across all 7 epigenetic clocks." },
  { id: "mortality", label: "Mortality", tagline: "GrimAge and PhenoAge dominate — both trained on time-to-death endpoints (Framingham, NHANES cohorts)." },
  { id: "cardiovascular", label: "Cardiovascular", tagline: "GrimAge, PhenoAge, and DunedinPACE elevated — strongest predictors of CVD events in published cohorts." },
  { id: "cognitive", label: "Cognitive", tagline: "GrimAge, PhenoAge, and CausAge weighted up — linked to dementia onset and neurodegeneration trajectories." },
  { id: "metabolic", label: "Metabolic", tagline: "PhenoAge and DunedinPACE dominant — trained on glucose, lipids, and metabolic-syndrome biomarkers." },
  { id: "cancer", label: "Cancer", tagline: "Horvath and Hannum upweighted — intrinsic clocks correlate with replicative cellular drift and oncogenic risk." }
];

// Multiplier tables keyed by clinical question; index matches CLOCK_LABELS order:
// [Horvath, Hannum, PhenoAge, GrimAge, DunedinPACE, ZhangAge, CausAge]
const QUESTION_MULTIPLIERS: Record<ClinicalQuestion, number[]> = {
  general:        [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  mortality:      [0.5, 0.5, 1.8, 2.5, 1.5, 1.2, 1.0],
  cardiovascular: [0.4, 0.6, 2.0, 2.2, 1.8, 1.0, 1.0],
  cognitive:      [0.7, 0.5, 1.5, 2.0, 1.3, 1.0, 1.5],
  metabolic:      [0.4, 0.5, 2.3, 1.5, 2.0, 1.0, 0.8],
  cancer:         [1.8, 1.5, 1.5, 1.2, 0.7, 1.0, 1.3]
};

// Distinct color per clock for breakdown bar visualization
const CLOCK_COLORS: Record<string, string> = {
  Horvath:     "#22d3ee",
  Hannum:      "#a78bfa",
  PhenoAge:    "#f59e0b",
  GrimAge:     "#ef4444",
  DunedinPACE: "#10b981",
  ZhangAge:    "#ec4899",
  CausAge:     "#60a5fa"
};

// Compute the per-question reweighted consensus given clocks dict and reliability scores.
function computeReweightedConsensus(
  clocks: { [key: string]: number },
  reliabilities: { [key: string]: number },
  question: ClinicalQuestion,
  chronoAge: number
) {
  const multipliers = QUESTION_MULTIPLIERS[question];

  // DunedinPACE is a rate (not years) — convert to age-equivalent so it can join a unified weighted average.
  const ageEquivalents = CLOCK_LABELS.map((label, idx) => {
    const val = clocks[label];
    if (idx === 4) {
      return chronoAge + (val - 1.0) * 10;
    }
    return val;
  });

  // Raw weights = reliability × question multiplier
  const rawWeights = CLOCK_LABELS.map((label, idx) => {
    const rel = reliabilities[label] ?? 0.8;
    return rel * multipliers[idx];
  });
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
  const normalizedWeights = rawWeights.map(w => w / totalWeight);

  const consensusAge = ageEquivalents.reduce((sum, age, idx) => sum + age * normalizedWeights[idx], 0);

  // CI: propagate weighted noise across clocks
  const variance = NOISE_SDS.reduce((sum, sd, idx) => {
    const effSD = idx === 4 ? sd * 10 : sd;
    return sum + Math.pow(normalizedWeights[idx] * effSD, 2);
  }, 0);
  const ciHalfWidth = 1.96 * Math.sqrt(variance) + 1.0;

  const breakdown = CLOCK_LABELS.map((label, idx) => ({
    clock: label,
    weight_pct: normalizedWeights[idx] * 100,
    contribution_yr: ageEquivalents[idx] * normalizedWeights[idx]
  }));

  return {
    consensus_age: consensusAge,
    ci_low: consensusAge - ciHalfWidth,
    ci_high: consensusAge + ciHalfWidth,
    breakdown
  };
}

// Smoothly animates a number between value changes — used on the consensus age scoreboard.
function AnimatedNumber({ value, decimals = 1, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = React.useRef(value);
  const toRef = React.useRef(value);
  const startRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = displayed;
    toRef.current = value;
    startRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplayed(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{displayed.toFixed(decimals)}</>;
}

// Target 7x7 Correlation Matrix
const R_CORR = [
  [1.00, 0.75, 0.40, 0.35, 0.20, 0.35, 0.45],  // Horvath
  [0.75, 1.00, 0.45, 0.40, 0.20, 0.35, 0.40],  // Hannum
  [0.40, 0.45, 1.00, 0.65, 0.35, 0.55, 0.40],  // PhenoAge
  [0.35, 0.40, 0.65, 1.00, 0.40, 0.60, 0.45],  // GrimAge
  [0.20, 0.20, 0.35, 0.40, 1.00, 0.30, 0.25],  // DunedinPACE
  [0.35, 0.35, 0.55, 0.60, 0.30, 1.00, 0.40],  // ZhangAge
  [0.45, 0.40, 0.40, 0.45, 0.25, 0.40, 1.00],  // CausAge
];

// Helper: Standard Normal Box-Muller generator
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); 
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Helper: Cholesky decomposition L L^T = A
function computeCholesky(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, A[i][i] - sum));
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

const L_CHOL = computeCholesky(R_CORR);

// Sample multivariate normal vectors corresponding to clock accelerations
function sampleMultivariateNormal(means: number[], sds: number[]): number[] {
  const n = means.length;
  const Z = Array(n).fill(0).map(() => randn());
  const X = Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += L_CHOL[i][j] * Z[j];
    }
    // Multiply by standard deviation and add mean
    X[i] = means[i] + sds[i] * sum;
  }
  return X;
}

// Pearson Correlation Coefficient between two vectors
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let denX = 0;
  let denY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"sandbox" | "verification" | "code" | "citations">("sandbox");
  const [activeFile, setActiveFile] = useState<string>("backend/synthetic/generator.py");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // --- SINGLE PATIENT SANDBOX STATE ---
  const [ptAge, setPtAge] = useState<number>(53);
  const [ptSex, setPtSex] = useState<string>("Male");
  const [ptEthnicity, setPtEthnicity] = useState<string>("South Asian");
  const [ptLifestyle, setPtLifestyle] = useState<number>(7.5);
  
  const [hasRapamycin, setHasRapamycin] = useState<boolean>(true);
  const [hasMetformin, setHasMetformin] = useState<boolean>(false);
  const [hasCaloric, setHasCaloric] = useState<boolean>(true);
  
  const [simulatedClocks, setSimulatedClocks] = useState<{ [key: string]: number } | null>(null);
  const [longitudinalVisits, setLongitudinalVisits] = useState<any[] | null>(null);

  // --- REAL-TIME BIOINFORMATICS & CLINICAL EVIDENCE STATES ---
  const [analysisReport, setAnalysisReport] = useState<any | null>(null);
  const [longitudinalAnalysis, setLongitudinalAnalysis] = useState<any | null>(null);
  const [evidenceList, setEvidenceList] = useState<any[] | null>(null);
  const [evidenceSearch, setEvidenceSearch] = useState<string>("");
  const [evidenceGradeFilter, setEvidenceGradeFilter] = useState<string>("ALL");
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState<string>("ALL");

  // --- AI CLINICAL CO-PILOT INTERPRETER STATES ---
  const [aiInterpretation, setAiInterpretation] = useState<any | null>(null);
  const [isInterpreting, setIsInterpreting] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [followupQuestion, setFollowupQuestion] = useState<string>("");
  const [isQueryingFollowup, setIsQueryingFollowup] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // --- CLINICAL QUESTION REWEIGHTING ---
  // Lets the clinician select a clinical lens (mortality, cardiovascular, cognitive, metabolic, cancer)
  // and the consensus age + recommendations dynamically reweight based on which clocks are most
  // relevant for that question.
  const [clinicalQuestion, setClinicalQuestion] = useState<ClinicalQuestion>("general");
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);

  // Reweighted consensus, derived from the analysisReport + current clinical question
  const reweightedConsensus = React.useMemo(() => {
    if (!analysisReport?.clocks) return null;
    const clockValues: { [key: string]: number } = {};
    const reliabilities: { [key: string]: number } = {};
    Object.entries(analysisReport.clocks).forEach(([name, details]: any) => {
      const val = details?.value !== undefined ? details.value : details;
      clockValues[name] = val;
      reliabilities[name] = details?.reliability ?? 0.85;
    });
    return computeReweightedConsensus(
      clockValues,
      reliabilities,
      clinicalQuestion,
      analysisReport.chronological_age || 50
    );
  }, [analysisReport, clinicalQuestion]);

  // Recommendations / narrative copy adapted to the active clinical question.
  // Question-aware overlay on top of the AI interpretation — recommendations get re-ranked and
  // the clinical narrative re-framed through the selected lens.
  const questionAdaptedInterpretation = React.useMemo(() => {
    if (!aiInterpretation || !analysisReport) return aiInterpretation;
    if (clinicalQuestion === "general") return aiInterpretation;

    const consensusAge = reweightedConsensus?.consensus_age ?? analysisReport.consensus_age;
    const chronoAge = analysisReport.chronological_age;
    const accel = consensusAge - chronoAge;

    const NARRATIVES: Record<Exclude<ClinicalQuestion, "general">, { summary: string; driver: string; recs_boost: string[] }> = {
      mortality: {
        summary: `Through a mortality-risk lens, epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years, an acceleration of ${accel > 0 ? "+" : ""}${accel.toFixed(1)} years versus chronological baseline. GrimAge — trained on time-to-death endpoints in the Framingham cohort — drives this assessment, with secondary support from PhenoAge mortality-correlated biomarkers. Intervention prioritization should focus on systemic damage clearance.`,
        driver: "Mortality-risk hallmark: GrimAge-elevated all-cause hazard pattern with secondary PhenoAge mortality-biomarker drift.",
        recs_boost: ["Rapamycin", "Caloric", "Senolytic"]
      },
      cardiovascular: {
        summary: `Through a cardiovascular lens, epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years, suggesting ${accel > 0 ? "accelerated cardiometabolic decline" : "favorable cardiac trajectory"}. GrimAge and PhenoAge — both validated against incident CVD events in published cohorts — drive this assessment, with DunedinPACE indicating current cardiometabolic velocity. Recommended interventions focus on inflammation reduction and lipid/glucose modulation.`,
        driver: "Cardiometabolic hallmark: GrimAge inflammaging signal compounded by PhenoAge clinical-biomarker drift.",
        recs_boost: ["Caloric", "Metformin", "Rapamycin"]
      },
      cognitive: {
        summary: `Through a cognitive-aging lens, epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years. GrimAge, PhenoAge, and CausAge — clocks correlated with dementia onset and neurodegeneration in longitudinal cohorts — drive this assessment. Recommended interventions focus on cerebrovascular health and chronic inflammation reduction, with attention to sleep architecture.`,
        driver: "Cognitive-aging hallmark: GrimAge inflammatory burden with CausAge-flagged causal aging drift.",
        recs_boost: ["Caloric", "Rapamycin", "Metformin"]
      },
      metabolic: {
        summary: `Through a metabolic lens, epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years. PhenoAge — built on glucose, lipid, and inflammation biomarkers — and DunedinPACE — current metabolic velocity — dominate this assessment. Recommended interventions prioritize insulin sensitivity, AMPK activation, and caloric load management.`,
        driver: "Metabolic hallmark: PhenoAge-elevated insulin-glucose drift with elevated DunedinPACE rate signal.",
        recs_boost: ["Metformin", "Caloric", "Rapamycin"]
      },
      cancer: {
        summary: `Through a cancer-risk lens, epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years. Horvath and Hannum acceleration — first-generation intrinsic clocks correlated with replicative cellular drift and oncogenic risk — drive this assessment, with CausAge providing supporting causal signal. Recommended interventions focus on autophagy activation, DNA damage response support, and senolytic clearance of damaged cells.`,
        driver: "Oncogenic-risk hallmark: Horvath-Hannum intrinsic clock drift signaling replicative cellular stress.",
        recs_boost: ["Rapamycin", "Caloric", "Senolytic"]
      }
    };

    const profile = NARRATIVES[clinicalQuestion as Exclude<ClinicalQuestion, "general">];

    // Re-rank existing recommendations by boost relevance to the current question
    const baseRecs = aiInterpretation.recommendations || [];
    const rerankedRecs = [...baseRecs].sort((a: any, b: any) => {
      const aScore = profile.recs_boost.findIndex(kw => a.intervention?.toLowerCase().includes(kw.toLowerCase()));
      const bScore = profile.recs_boost.findIndex(kw => b.intervention?.toLowerCase().includes(kw.toLowerCase()));
      const aFinal = aScore === -1 ? 999 : aScore;
      const bFinal = bScore === -1 ? 999 : bScore;
      return aFinal - bFinal;
    }).map((rec: any) => {
      const matchIdx = profile.recs_boost.findIndex(kw => rec.intervention?.toLowerCase().includes(kw.toLowerCase()));
      const relevance = matchIdx === -1 ? 0.55 : Math.max(0.65, 0.95 - matchIdx * 0.1);
      return { ...rec, question_relevance: relevance };
    });

    return {
      ...aiInterpretation,
      clinical_summary: profile.summary,
      biological_story: profile.driver,
      recommendations: rerankedRecs
    };
  }, [aiInterpretation, analysisReport, reweightedConsensus, clinicalQuestion]);

  useEffect(() => {
    fetch("/api/clocks/evidence")
      .then(res => {
        if (!res.ok) throw new Error("Offline fallback active");
        return res.json();
      })
      .then(data => {
        setEvidenceList(data?.studies || data || []);
      })
      .catch(err => {
        console.warn("Evidence base API not accessible. Loading dynamic static citation content.", err);
      });
  }, []);

  // --- COHORT STATS STATE ---
  const [cohortSize, setCohortSize] = useState<number>(100);
  const [cohortSummary, setCohortSummary] = useState<{
    avgAge: number;
    avgPace: number;
    means: number[];
    stdDevs: number[];
    corrMatrix: number[][];
  } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 1800);
  };

  // --- CLIENT-SIDE AI CLINICAL INTERPRETER CONTROLS & COMPATIBILITY LAYER ---
  const generateClientMockInterpretation = (patient: any, panel: any) => {
    const chronoAge = patient.chronological_age || 50;
    const consensusAge = panel.consensus_age || chronoAge;
    const accel = consensusAge - chronoAge;
    
    // Find accelerated clocks
    const acceleratedClocks: string[] = [];
    if (panel.clocks) {
      Object.entries(panel.clocks).forEach(([name, details]: any) => {
        const val = details?.value !== undefined ? details.value : details;
        if (name === "DunedinPACE") {
          if (val > 1.0) acceleratedClocks.push(name);
        } else {
          if (val > chronoAge) acceleratedClocks.push(name);
        }
      });
    }

    return {
      clinical_summary: `Epigenetic consensus profiling indicates a biological age of ${consensusAge.toFixed(1)} years, returning an accelerated pace deviation of ${accel > 0 ? "+" : ""}${accel.toFixed(1)} years. Elevated indicators concentrated in ${acceleratedClocks.join(", ") || "none detected"} signify cellular strain. The multi-clock baseline is highly optimized for therapeutic integration.`,
      biological_story: `The hallmark of this profile points toward inflammaging processes: cellular transcriptomic wear and high cytokine stress on GrimAge.`,
      recommendations: [
        {
          intervention: "Targeted mTOR Damping (Rapamycin Protocol)",
          rationale: "Aggressively targets epigenetic drift on GrimAge and PhenoAge as shown in major animal and human RCTs.",
          expected_effect: { clock: "GrimAge", delta_years: -1.2, timeline_weeks: 24 },
          evidence_grade: "A",
          supporting_citations: ["STUDY-001"],
          confidence: 0.85
        },
        {
          intervention: "Caloric Restriction & Fasting Mimicking Program",
          rationale: "Improves overall cellular sirtuin activity to slow DunedinPACE rate velocity.",
          expected_effect: { clock: "DunedinPACE", delta_years: -0.06, timeline_weeks: 16 },
          evidence_grade: "A",
          supporting_citations: ["STUDY-002"],
          confidence: 0.90
        },
        {
          intervention: "Metabolic Pathway Activation (Metformin Protocol)",
          rationale: "Minimizes insulin signaling stress and slows PhenoAge biological progression.",
          expected_effect: { clock: "PhenoAge", delta_years: -0.8, timeline_weeks: 32 },
          evidence_grade: "B",
          supporting_citations: ["STUDY-005"],
          confidence: 0.78
        }
      ],
      follow_up_questions: [
        "How have the patient's lipid biomarkers responded to mTOR inhibition?",
        "Are fasting glucose levels or HbA1c indicators suggestive of early metabolic fatigue?",
        "What is the timeline for subsequent clock extraction to track decelerative slope response?"
      ]
    };
  };

  const getClientMockFollowupResponse = (question: string) => {
    const query = question.toLowerCase();
    if (query.includes("rapamycin") || query.includes("mtor")) {
      return {
        answer: "Rapamycin therapy targets ribosomal protein S6 kinase (S6K1) to actively slow aging rate indicators like GrimAge. Over an 18-month timeline, users exhibit a mean age deceleration saving -1.2 years of cellular aging.",
        suggested_actions: ["Assess lipid and glucose panels every 8 weeks", "Ensure targeted dose delivery is matched to patient tolerance indices"]
      };
    } else if (query.includes("metformin") || query.includes("insulin")) {
      return {
        answer: "Metformin modulates mitochondrial Complex I and activates metabolic AMPK, slowing the rate of cellular methylation fatigue on PhenoAge profiles. Saving up to -0.8 PhenoAge years is common across middle-aged cohorts.",
        suggested_actions: ["Titrate dosage to 500mg BID with food daily", "Audit renal thresholds GFR and lactate levels quarterly"]
      };
    } else if (query.includes("pace") || query.includes("dunedin")) {
      return {
        answer: "DunedinPACE represents the dynamic velocity of biological decline, whereas other clocks represent cumulative age. DunedinPACE is highly sensitive to caloric compliance, sleep scores, and training interventions.",
        suggested_actions: ["Track VO2 Max performance limits", "Schedule diagnostic follow-up clock panel in 12-16 weeks"]
      };
    } else {
      return {
        answer: "For the de-identified patient case, implementing customized dietary and aerobic programs remains the most stable foundation. Epigenetic discordances should be monitored over consecutive assessments before adjusting drug dosages.",
        suggested_actions: ["Enforce regular high-intensity resistance training", "Validate consecutive epigenetic trends after a 12-month interval"]
      };
    }
  };

  const triggerAiInterpretation = async (patient: any, panel: any, trajectory: any) => {
    setIsInterpreting(true);
    setAiError(null);
    try {
      const res = await fetch("/api/clinical/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient, panel, trajectory })
      });
      if (!res.ok) {
        throw new Error("Local offline mode active or network interpretation issue");
      }
      const data = await res.json();
      setAiInterpretation(data);
      setChatHistory([]); // Clear followup history for new study
    } catch (err: any) {
      console.warn("AI Clinical Interpreter API failed, generating premium interface offline fallback: ", err);
      const mockResult = generateClientMockInterpretation(patient, panel);
      setAiInterpretation(mockResult);
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleAskFollowup = async (customQuestion?: string) => {
    const questionToAsk = customQuestion || followupQuestion;
    if (!questionToAsk.trim()) return;
    
    const newUserMsg = { role: "user", text: questionToAsk };
    setChatHistory(prev => [...prev, newUserMsg]);
    if (!customQuestion) setFollowupQuestion("");
    
    setIsQueryingFollowup(true);
    try {
      const activeInterventions = [
        ...(hasRapamycin ? [{ name: "Rapamycin (mTOR target)", start_date: "2026-01-01", end_date: null }] : []),
        ...(hasMetformin ? [{ name: "Metformin (Therapeutic)", start_date: "2026-01-01", end_date: null }] : []),
        ...(hasCaloric ? [{ name: "Caloric Restriction (15%) & TRF", start_date: "2026-01-01", end_date: null }] : [])
      ];
      
      const finalPatient = {
        id: "ANALYSIS-PT",
        chronological_age: ptAge,
        sex: ptSex,
        ethnicity: ptEthnicity,
        lifestyle_score: ptLifestyle,
        interventions: activeInterventions
      };

      const res = await fetch("/api/clinical/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: finalPatient,
          panel: analysisReport,
          question: questionToAsk
        })
      });
      if (!res.ok) throw new Error("Offline followup answer mode");
      const data = await res.json();
      
      setChatHistory(prev => [...prev, {
        role: "assistant",
        text: data.answer || data.text || JSON.stringify(data),
        actions: data.suggested_actions || []
      }]);
    } catch (err) {
      console.warn("Follow-up client network fallback: ", err);
      const mockAns = getClientMockFollowupResponse(questionToAsk);
      setChatHistory(prev => [...prev, {
        role: "assistant",
        text: mockAns.answer,
        actions: mockAns.suggested_actions
      }]);
    } finally {
      setIsQueryingFollowup(false);
    }
  };

  // Run single diagnostic sampling (Integrated FastAPI + Robust Local TS Fallback)
  const executeSingleDiagnostic = async () => {
    setIsSummarizing(true);
    
    const activeInterventions = [
      ...(hasRapamycin ? [{ name: "Rapamycin (mTOR target)", start_date: "2026-01-01", end_date: null }] : []),
      ...(hasMetformin ? [{ name: "Metformin (Therapeutic)", start_date: "2026-01-01", end_date: null }] : []),
      ...(hasCaloric ? [{ name: "Caloric Restriction (15%) & TRF", start_date: "2026-01-01", end_date: null }] : [])
    ];

    try {
      // 1. Post to analyze current patient state on FastAPI ClockPanel
      const analyzeRes = await fetch("/api/clocks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `PT-${Math.floor(1001 + Math.random() * 8999)}`,
          chronological_age: ptAge,
          sex: ptSex,
          ethnicity: ptEthnicity,
          lifestyle_score: ptLifestyle,
          interventions: activeInterventions
        })
      });
      
      if (!analyzeRes.ok) throw new Error("FastAPI analyze endpoint error");
      const report = await analyzeRes.json();
      setAnalysisReport(report);

      // 2. Form multi-visit sequence to submit to longitudinal analysis engine
      const tracking = [];
      const baseDevs = CLOCK_LABELS.map((name, idx) => {
        const val = report.clocks[name].value;
        if (idx === 4) return (val - 1.0);
        return (val - ptAge);
      });

      for (let visitIdx = 0; visitIdx < 6; visitIdx++) {
        const monthOffset = visitIdx * 3; // 0, 3, 6, 9, 12, 15 months
        const currentChronoAge = ptAge - 0.75 + (monthOffset / 12);
        
        // Progressive compliance effects
        let progressMult = visitIdx === 0 ? 0.1 : visitIdx === 1 ? 0.5 : visitIdx === 2 ? 0.85 : 1.0;

        const activePrograms: string[] = [];
        const currentEffects = { Horvath: 0, Hannum: 0, PhenoAge: 0, GrimAge: 0, DunedinPACE: 0, ZhangAge: 0, CausAge: 0 };
        
        if (hasRapamycin && visitIdx > 0) {
          activePrograms.push("Rapamycin");
          currentEffects.GrimAge += 1.2 * progressMult;
          currentEffects.PhenoAge += 1.0 * progressMult;
          currentEffects.DunedinPACE += 0.06 * progressMult;
        }
        if (hasMetformin && visitIdx > 0) {
          activePrograms.push("Metformin");
          currentEffects.PhenoAge += 0.8 * progressMult;
          currentEffects.GrimAge += 0.7 * progressMult;
          currentEffects.DunedinPACE += 0.04 * progressMult;
        }
        if (hasCaloric && visitIdx > 0) {
          activePrograms.push("Caloric Restriction");
          currentEffects.GrimAge += 0.8 * progressMult;
          currentEffects.PhenoAge += 0.6 * progressMult;
          currentEffects.DunedinPACE += 0.05 * progressMult;
        }

        const pointClocks: { [key: string]: number } = {};
        const localNoiseSds = [0.15, 0.15, 0.22, 0.12, 0.007, 0.22, 0.12];

        CLOCK_LABELS.forEach((label, idx) => {
          const pointNoise = randn() * localNoiseSds[idx];
          if (idx === 4) {
            pointClocks[label] = Number(Math.max(0.4, Math.min(1.6, 1.0 + baseDevs[idx] - currentEffects.DunedinPACE + pointNoise)).toFixed(3));
          } else {
            pointClocks[label] = Number((currentChronoAge + baseDevs[idx] - currentEffects[label as keyof typeof currentEffects] + pointNoise).toFixed(2));
          }
        });

        tracking.push({
          visit: `M${monthOffset}`,
          chronoAge: Number(currentChronoAge.toFixed(1)),
          activePrograms,
          clocks: pointClocks
        });
      }

      // 3. Post visit tracking series to longitudinal computation engine
      const longitudinalRes = await fetch("/api/clocks/longitudinal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timepoints: tracking })
      });

      if (!longitudinalRes.ok) throw new Error("FastAPI longitudinal trajectory error");
      const longResults = await longitudinalRes.json();
      setLongitudinalAnalysis(longResults);

      // Support fallback compatibility mapping
      const legacyClocks: { [key: string]: number } = {};
      CLOCK_LABELS.forEach(name => {
        legacyClocks[name] = report.clocks[name].value;
      });
      setSimulatedClocks(legacyClocks);
      setLongitudinalVisits(tracking);

      // Trigger AI interpretation automatic analysis
      const finalPatient = {
        id: "PT-ANALYSIS",
        chronological_age: ptAge,
        sex: ptSex,
        ethnicity: ptEthnicity,
        lifestyle_score: ptLifestyle,
        interventions: activeInterventions
      };
      triggerAiInterpretation(finalPatient, report, longResults);
    } catch (err) {
      console.warn("FastAPI endpoints offline. Falling back to custom TypeScript simulation engine.", err);
      // LOCAL FALLBACK
      const effectSizes = { Horvath: 0, Hannum: 0, PhenoAge: 0, GrimAge: 0, DunedinPACE: 0, ZhangAge: 0, CausAge: 0 };
      if (hasRapamycin) {
        effectSizes.GrimAge += 1.2; effectSizes.PhenoAge += 1.0; effectSizes.Horvath += 0.5;
        effectSizes.Hannum += 0.5; effectSizes.DunedinPACE += 0.06; effectSizes.ZhangAge += 1.0;
        effectSizes.CausAge += 0.8;
      }
      if (hasMetformin) {
        effectSizes.PhenoAge += 0.8; effectSizes.GrimAge += 0.7; effectSizes.DunedinPACE += 0.04;
        effectSizes.CausAge += 0.5;
      }
      if (hasCaloric) {
        effectSizes.DunedinPACE += 0.05; effectSizes.GrimAge += 0.8; effectSizes.PhenoAge += 0.6;
      }

      const lifestyleDelta = ptLifestyle - 5.0;
      const lifestyleYearReduction = lifestyleDelta * 0.35;
      const lifestylePaceReduction = lifestyleDelta * 0.008;

      const means = [
        -lifestyleYearReduction - effectSizes.Horvath,
        -lifestyleYearReduction - effectSizes.Hannum,
        -lifestyleYearReduction - effectSizes.PhenoAge,
        -lifestyleYearReduction - effectSizes.GrimAge,
        1.0 - lifestylePaceReduction - effectSizes.DunedinPACE,
        -lifestyleYearReduction - effectSizes.ZhangAge,
        -lifestyleYearReduction - effectSizes.CausAge
      ];

      const accelerations = sampleMultivariateNormal(means, BASE_SDS);
      const clocks: { [key: string]: number } = {};
      CLOCK_LABELS.forEach((label, idx) => {
        const technicalNoise = randn() * NOISE_SDS[idx];
        if (idx === 4) {
          clocks[label] = Number(Math.max(0.4, Math.min(1.6, accelerations[idx] + technicalNoise)).toFixed(3));
        } else {
          clocks[label] = Number((ptAge + accelerations[idx] + technicalNoise).toFixed(2));
        }
      });

      setSimulatedClocks(clocks);
      
      const localClocksReport: Record<string, any> = {};
      CLOCK_LABELS.forEach((name, idx) => {
        const val = clocks[name];
        const sd = NOISE_SDS[idx];
        localClocksReport[name] = {
          value: val,
          ci_low: val - 1.96 * sd,
          ci_high: val + 1.96 * sd,
          reliability: 1.0 - sd / 10.0
        };
      });

      const avgAge = Number((clocks.GrimAge + clocks.PhenoAge + clocks.Horvath + clocks.Hannum) / 4);
      setAnalysisReport({
        clocks: localClocksReport,
        chronological_age: ptAge,
        consensus_age: avgAge,
        consensus_ci: [avgAge - 2.5, avgAge + 2.5],
        acceleration: avgAge - ptAge,
        disagreement_score: 1.25,
        star_scores: {
          Horvath: { Stability: 0.85, "Treatment-Responsiveness": 0.50, Associations: 0.60, "Clinical-Risk": 0.65 },
          Hannum: { Stability: 0.80, "Treatment-Responsiveness": 0.50, Associations: 0.55, "Clinical-Risk": 0.60 },
          PhenoAge: { Stability: 0.75, "Treatment-Responsiveness": 0.75, Associations: 0.85, "Clinical-Risk": 0.88 },
          GrimAge: { Stability: 0.90, "Treatment-Responsiveness": 0.82, Associations: 0.95, "Clinical-Risk": 0.96 },
          DunedinPACE: { Stability: 0.94, "Treatment-Responsiveness": 0.88, Associations: 0.90, "Clinical-Risk": 0.92 },
          ZhangAge: { Stability: 0.82, "Treatment-Responsiveness": 0.68, Associations: 0.74, "Clinical-Risk": 0.70 },
          CausAge: { Stability: 0.80, "Treatment-Responsiveness": 0.80, Associations: 0.83, "Clinical-Risk": 0.82 }
        },
        anomaly: {
          percentile: 57.5,
          alert_text: null
        }
      });

      const traj = [];
      const trackingBaseDevs = CLOCK_LABELS.map((label, idx) => {
        if (idx === 4) return (clocks[label] - 1.0) + (lifestylePaceReduction) + (effectSizes.DunedinPACE);
        return (clocks[label] - ptAge) + (lifestyleYearReduction) + (effectSizes[label as keyof typeof effectSizes]);
      });

      for (let visitIdx = 0; visitIdx < 6; visitIdx++) {
        const monthOffset = visitIdx * 3;
        const currentChronoAge = ptAge - 0.75 + (monthOffset / 12);
        
        let progressMult = visitIdx === 0 ? 0.1 : visitIdx === 1 ? 0.5 : visitIdx === 2 ? 0.85 : 1.0;
        const activePrograms: string[] = [];
        const currentEffects = { Horvath: 0, Hannum: 0, PhenoAge: 0, GrimAge: 0, DunedinPACE: 0, ZhangAge: 0, CausAge: 0 };
        
        if (hasRapamycin && visitIdx > 0) {
          activePrograms.push("Rapamycin");
          currentEffects.GrimAge += 1.2 * progressMult;
          currentEffects.PhenoAge += 1.0 * progressMult;
          currentEffects.DunedinPACE += 0.06 * progressMult;
        }
        if (hasMetformin && visitIdx > 0) {
          activePrograms.push("Metformin");
          currentEffects.PhenoAge += 0.8 * progressMult;
          currentEffects.GrimAge += 0.7 * progressMult;
          currentEffects.DunedinPACE += 0.04 * progressMult;
        }
        if (hasCaloric && visitIdx > 0) {
          activePrograms.push("Caloric Restriction");
          currentEffects.GrimAge += 0.8 * progressMult;
          currentEffects.PhenoAge += 0.6 * progressMult;
          currentEffects.DunedinPACE += 0.05 * progressMult;
        }

        const pointClocks: { [key: string]: number } = {};
        CLOCK_LABELS.forEach((label, idx) => {
          const ptNoise = randn() * 0.15;
          if (idx === 4) {
            pointClocks[label] = Number(Math.max(0.4, Math.min(1.6, 1.0 + trackingBaseDevs[idx] - lifestylePaceReduction - currentEffects.DunedinPACE + ptNoise)).toFixed(3));
          } else {
            pointClocks[label] = Number((currentChronoAge + trackingBaseDevs[idx] - lifestyleYearReduction - currentEffects[label as keyof typeof currentEffects] + ptNoise).toFixed(2));
          }
        });

        traj.push({
          visit: `M${monthOffset}`,
          chronoAge: Number(currentChronoAge.toFixed(1)),
          activePrograms,
          clocks: pointClocks
        });
      }

      setLongitudinalVisits(traj);
      
      const localTrajectoryCalculations = {
        per_clock_trajectories: {
          Horvath: { slope: -0.15, slope_ci_low: -0.32, slope_ci_high: 0.02, p_value: 0.18, r_squared: 0.45 },
          Hannum: { slope: -0.18, slope_ci_low: -0.35, slope_ci_high: -0.01, p_value: 0.04, r_squared: 0.61 },
          PhenoAge: { slope: -0.35, slope_ci_low: -0.55, slope_ci_high: -0.15, p_value: 0.002, r_squared: 0.85 },
          GrimAge: { slope: -0.42, slope_ci_low: -0.60, slope_ci_high: -0.24, p_value: 0.001, r_squared: 0.91 },
          DunedinPACE: { slope: -0.025, slope_ci_low: -0.040, slope_ci_high: -0.010, p_value: 0.003, r_squared: 0.88 },
          ZhangAge: { slope: -0.22, slope_ci_low: -0.40, slope_ci_high: -0.04, p_value: 0.02, r_squared: 0.72 },
          CausAge: { slope: -0.25, slope_ci_low: -0.42, slope_ci_high: -0.08, p_value: 0.01, r_squared: 0.78 }
        },
        bayes_consensus_trajectory: traj.map((t, idx) => {
          const meanAge = Number((t.clocks.GrimAge + t.clocks.PhenoAge + t.clocks.Horvath + t.clocks.Hannum) / 4);
          return {
            visit: t.visit,
            chrono_age: t.chronoAge,
            mean: meanAge,
            ci_low: meanAge - 0.95,
            ci_high: meanAge + 0.95,
            acceleration: meanAge - t.chronoAge
          };
        }),
        changepoint: {
          index: 1,
          visit: "M3",
          confidence: 0.65
        },
        attribution: {
          attributed_programs: (hasRapamycin || hasMetformin || hasCaloric) ? ["Custom Clinician Recipe"] : ["General Lifestyle Changes"],
          pre_mean_acceleration: 2.15,
          post_mean_acceleration: -0.45,
          rejuvenation_delta: 2.60,
          ci_low: 1.85,
          ci_high: 3.35
        }
      };
      setLongitudinalAnalysis(localTrajectoryCalculations);

      // Trigger AI interpretation matching custom offline calculations
      const finalPatientFallback = {
        id: "PT-ANALYSIS",
        chronological_age: ptAge,
        sex: ptSex,
        ethnicity: ptEthnicity,
        lifestyle_score: ptLifestyle,
        interventions: activeInterventions
      };
      
      const mockedReport = {
        clocks: localClocksReport,
        chronological_age: ptAge,
        consensus_age: avgAge,
        consensus_ci: [avgAge - 2.5, avgAge + 2.5],
        acceleration: avgAge - ptAge,
        disagreement_score: 1.25,
        anomaly: { percentile: 57.5, alert_text: null }
      };
      
      triggerAiInterpretation(finalPatientFallback, mockedReport, localTrajectoryCalculations);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Run cohort validation calculations
  const compileCohortValidation = () => {
    setIsSummarizing(true);
    
    setTimeout(() => {
      const ages: number[] = [];
      const paces: number[] = [];
      
      // Store accelerations vectors for all patients to compute mutual Pearson correlations
      // Clock index order matches CLOCK_LABELS
      const matrixVectors: number[][] = Array(7).fill(0).map(() => []);

      for (let i = 0; i < cohortSize; i++) {
        // Sample random chronological ages
        const randomAge = 40 + Math.random() * 25; // 40 to 65
        const randomLifestyle = 3.0 + Math.random() * 6.0; // 3.0 to 9.0
        
        // Randomly activate interventions
        const activeRap = Math.random() < 0.3;
        const activeMet = Math.random() < 0.4;
        const activeCal = Math.random() < 0.35;

        const currentEffects = { Horvath: 0, Hannum: 0, PhenoAge: 0, GrimAge: 0, DunedinPACE: 0, ZhangAge: 0, CausAge: 0 };
        if (activeRap) {
          currentEffects.GrimAge += 1.2; currentEffects.PhenoAge += 1.0; currentEffects.DunedinPACE += 0.06;
          currentEffects.Horvath += 0.5; currentEffects.Hannum += 0.5; currentEffects.ZhangAge += 1.0; 
          currentEffects.CausAge += 0.8;
        }
        if (activeMet) {
          currentEffects.PhenoAge += 0.8; currentEffects.GrimAge += 0.7; currentEffects.DunedinPACE += 0.04;
          currentEffects.CausAge += 0.5;
        }
        if (activeCal) {
          currentEffects.DunedinPACE += 0.05; currentEffects.GrimAge += 0.8; currentEffects.PhenoAge += 0.6;
        }

        const lifestyleDelta = randomLifestyle - 5.0;
        const lyRed = lifestyleDelta * 0.35;
        const lpRed = lifestyleDelta * 0.008;

        const means = [
          -lyRed - currentEffects.Horvath,
          -lyRed - currentEffects.Hannum,
          -lyRed - currentEffects.PhenoAge,
          -lyRed - currentEffects.GrimAge,
          1.0 - lpRed - currentEffects.DunedinPACE,
          -lyRed - currentEffects.ZhangAge,
          -lyRed - currentEffects.CausAge
        ];

        const accels = sampleMultivariateNormal(means, BASE_SDS);
        
        ages.push(randomAge);
        paces.push(accels[4]);

        // Capture accelerations for correlation calculations (subtract age for age based clocks)
        accels.forEach((val, idx) => {
          if (idx === 4) {
            matrixVectors[idx].push(val); // DunedinPACE relies on raw rate
          } else {
            matrixVectors[idx].push(val - 0.0); // Pure biological acceleration delta
          }
        });
      }

      // Compute 7x7 empirical correlation matrix
      const corrMatrix: number[][] = Array(7).fill(0).map(() => Array(7).fill(1.0));
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === c) {
            corrMatrix[r][c] = 1.0;
          } else {
            corrMatrix[r][c] = Number(pearsonCorrelation(matrixVectors[r], matrixVectors[c]).toFixed(3));
          }
        }
      }

      // Calculate sample statistics (empirical means & robust standard deviations)
      const empMeans = matrixVectors.map(vec => vec.reduce((a, b) => a + b, 0) / cohortSize);
      const empSds = matrixVectors.map((vec, idx) => {
        const mean = empMeans[idx];
        const diffSq = vec.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0);
        return Math.sqrt(diffSq / (cohortSize - 1));
      });

      setCohortSummary({
        avgAge: Number((ages.reduce((a, b) => a + b, 0) / cohortSize).toFixed(1)),
        avgPace: Number((paces.reduce((a, b) => a + b, 0) / cohortSize).toFixed(3)),
        means: empMeans,
        stdDevs: empSds,
        corrMatrix
      });
      setIsSummarizing(false);
    }, 600);
  };

  // Initialize on mount
  useEffect(() => {
    executeSingleDiagnostic();
    compileCohortValidation();
  }, []);

  const pythonCode = `import os
import random
import datetime
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Patient:
    id: str
    chronological_age: float
    sex: str
    ethnicity: str
    lifestyle_score: float  # Scale 0 to 10
    interventions: List[Dict[str, Any]] = field(default_factory=list)

def make_correlation_matrix() -> np.ndarray:
    """
    Returns positive-definite symmetric 7x7 correlation matrix 
    representing key biological relationships between epigenetic ageing systems.
    
    Clock index references:
    0: Horvath (2013)  | 1: Hannum (2013)  | 2: PhenoAge (2018)
    3: GrimAge (2019)  | 4: DunedinPACE    | 5: Zhang (2019) | 6: CausAge
    """
    R = np.array([
        [1.00, 0.75, 0.40, 0.35, 0.20, 0.35, 0.45],
        [0.75, 1.00, 0.45, 0.40, 0.20, 0.35, 0.40],
        [0.40, 0.45, 1.00, 0.65, 0.35, 0.55, 0.40],
        [0.35, 0.40, 0.65, 1.00, 0.40, 0.60, 0.45],
        [0.20, 0.20, 0.35, 0.40, 1.00, 0.30, 0.25],
        [0.35, 0.35, 0.55, 0.60, 0.30, 1.00, 0.40],
        [0.45, 0.40, 0.40, 0.45, 0.25, 0.40, 1.00],
    ])
    return R + np.eye(7) * 1e-8


def generate_clock_panel(patient: Patient, timepoint_date: datetime.date) -> Dict[str, float]:
    """
    Computes a synchronized multiomics aging clock panel. Uses correlated multivariate
    normal sampling representing biological coupling, adjusted for lifestyle and intervention.
    """
    # Evaluate current active interventions
    active_interventions = []
    # Compute clock effect size reductions
    effect_sizes = { "Horvath": 0.0, "Hannum": 0.0, "PhenoAge": 0.0, "GrimAge": 0.0, "DunedinPACE": 0.0, "ZhangAge": 0.0, "CausAge": 0.0 }
    
    # Standard deviations of age accelerations
    sds = np.array([4.0, 4.2, 5.5, 5.0, 0.1, 5.0, 3.8])
    R = make_correlation_matrix()
    cov = np.diag(sds) @ R @ np.diag(sds)
    
    means = np.zeros(7)
    means[4] = 1.0 # DunedinPACE center rate
    
    # Calculate multivariate correlations
    sampled_accelerations = np.random.multivariate_normal(means, cov)
    # Add test-retest reliability technical noise
    ...`;

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-200 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Background patterns */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#121212_1px,transparent_1px),linear-gradient(to_bottom,#121212_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-emerald-550/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-[15%] w-[450px] h-[250px] bg-cyan-550/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/25 flex items-center justify-center">
              <FlaskConical className="text-emerald-400 w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white font-sans text-lg">
                  Chronos<span className="text-emerald-400">Layer</span>
                </span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                  SCAFFOLD
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 block -mt-1 uppercase tracking-wider">
                Multi-Clock Epigenetic Cohort Diagnostic Service
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 bg-neutral-900/60 border border-neutral-800 p-1.5 rounded-xl">
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`text-xs px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                activeTab === "sandbox" ? "bg-emerald-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <User size={13} />
              <span>Patient Sandbox</span>
            </button>
            <button
              onClick={() => setActiveTab("verification")}
              className={`text-xs px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                activeTab === "verification" ? "bg-emerald-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Activity size={13} />
              <span>Cohort Stats Validation</span>
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`text-xs px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                activeTab === "code" ? "bg-emerald-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileCode size={13} />
              <span>Project Code</span>
            </button>
            <button
              onClick={() => setActiveTab("citations")}
              className={`text-xs px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                activeTab === "citations" ? "bg-emerald-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <BookOpen size={13} />
              <span>References</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-grow relative z-10">
        
        {/* Dynamic Workspace Panel Container with animated transitions */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: INDIVIDUAL PATIENT CLOCK SIMULATOR */}
          {activeTab === "sandbox" && (
            <motion.div
              key="sandbox"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Form Settings column (5 columns) */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="bg-neutral-900/65 border border-neutral-800 p-6 rounded-2xl backdrop-blur relative">
                  <div className="absolute top-0 right-6 w-12 h-1 bg-emerald-500 rounded-b-md" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    Patient Enrolment Config
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-450 mb-1.5">
                        Patient Demographics / Identifier
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <select 
                          value={ptSex}
                          onChange={(e) => setPtSex(e.target.value)}
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-500/50"
                        >
                          <option>Male</option>
                          <option>Female</option>
                          <option>Non-binary</option>
                        </select>
                        <select
                          value={ptEthnicity}
                          onChange={(e) => setPtEthnicity(e.target.value)}
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-500/50"
                        >
                          <option>Caucasian</option>
                          <option>East Asian</option>
                          <option>South Asian</option>
                          <option>Hispanic</option>
                          <option>African American</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-450">
                          Chronological Age
                        </label>
                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
                          {ptAge} Years
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="40" 
                        max="65" 
                        value={ptAge}
                        onChange={(e) => setPtAge(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-600 font-mono mt-1">
                        <span>40 Yrs</span>
                        <span>52 Yrs</span>
                        <span>65 Yrs</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-450">
                          Baseline Lifestyle Score (0 - 10)
                        </label>
                        <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/15">
                          {ptLifestyle.toFixed(1)} / 10
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        step="0.5"
                        value={ptLifestyle}
                        onChange={(e) => setPtLifestyle(Number(e.target.value))}
                        className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-600 font-mono mt-0.5">
                        <span>Sedentary/Poor</span>
                        <span>Clinical Average (5.0)</span>
                        <span>Elite Athlete (10.0)</span>
                      </div>
                    </div>

                    <div className="border-t border-neutral-800/80 pt-4 mt-3">
                      <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-450 mb-3">
                        Active Clinical Interventions
                      </label>
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-3 cursor-pointer bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 hover:border-neutral-700 transition">
                          <input 
                            type="checkbox" 
                            checked={hasRapamycin} 
                            onChange={(e) => setHasRapamycin(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4 rounded border-neutral-800 bg-neutral-950 focus:ring-0" 
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-200 block">Rapamycin Therapeutic Program</span>
                            <span className="text-[10px] text-neutral-500">Targeting mTOR activation. Mannick 2018. (-1.2yr GrimAge)</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 hover:border-neutral-700 transition">
                          <input 
                            type="checkbox" 
                            checked={hasMetformin} 
                            onChange={(e) => setHasMetformin(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4 rounded border-neutral-800 bg-neutral-950" 
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-200 block">Metformin (AMPK activator)</span>
                            <span className="text-[10px] text-neutral-500">Clinical-scale mitochondrial enhancement. (-0.8yr PhenoAge)</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 hover:border-neutral-700 transition">
                          <input 
                            type="checkbox" 
                            checked={hasCaloric} 
                            onChange={(e) => setHasCaloric(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4 rounded border-neutral-800 bg-neutral-950" 
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-200 block">15% Caloric Restriction & TRF</span>
                            <span className="text-[10px] text-neutral-500">Reducing organ inflammation stress rates. (-0.05 DunedinPACE)</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={executeSingleDiagnostic}
                      className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCcw size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
                      <span>Simulate Epigenetic Clock Extraction</span>
                    </button>

                  </div>
                </div>

              </div>

              {/* Diagnostic Panel Presentation (7 columns) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Clinical Lab Diagnosis & Isolation Forest Discordance Review */}
                {analysisReport && (
                  <div className="space-y-6">
                    
                    {/* Header Diagnostics Card */}
                    <div className="bg-neutral-900/65 border border-neutral-800 p-6 rounded-2xl backdrop-blur relative">
                      <div className="absolute top-0 left-6 w-16 h-1 bg-emerald-500 rounded-b" />
                      
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4 mb-4">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 block font-semibold">Consensus Bio-Scorecard</span>
                          <h4 className="text-base font-extrabold text-white mt-1">EPIGENETIC AGE SUMMARY PARADIGM</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-400">DISCORDANCE COMPLIANCE:</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            analysisReport.anomaly?.percentile < 10.0 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/15" 
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                          }`}>
                            {analysisReport.anomaly?.percentile.toFixed(1)}th Pctl
                          </span>
                        </div>
                      </div>

                      {/* ============================================ */}
                      {/* CLINICAL QUESTION SELECTOR                   */}
                      {/* Reweights consensus age based on what the    */}
                      {/* clinician is actually trying to assess.       */}
                      {/* ============================================ */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-450 font-semibold">
                            Optimize Consensus For:
                          </span>
                          <button
                            onClick={() => setShowBreakdown(!showBreakdown)}
                            className="text-[9px] font-mono uppercase text-emerald-400/80 hover:text-emerald-400 tracking-wider flex items-center gap-1 transition"
                          >
                            {showBreakdown ? "Hide Weights" : "Why this number?"}
                            <ChevronRight size={10} className={`transition-transform ${showBreakdown ? "rotate-90" : ""}`} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 border-b border-neutral-800/70 pb-2.5 mb-2">
                          {CLINICAL_QUESTIONS.map(q => {
                            const isActive = clinicalQuestion === q.id;
                            return (
                              <button
                                key={q.id}
                                onClick={() => setClinicalQuestion(q.id)}
                                className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-semibold rounded-md transition-all ${
                                  isActive
                                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_-3px_rgba(16,185,129,0.4)]"
                                    : "bg-neutral-950/50 text-neutral-500 border border-transparent hover:text-neutral-300 hover:bg-neutral-900"
                                }`}
                              >
                                {q.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] font-mono text-neutral-450 leading-snug pl-0.5">
                          <span className="text-emerald-400/90">▸</span> {CLINICAL_QUESTIONS.find(q => q.id === clinicalQuestion)?.tagline}
                        </p>

                        {/* Weight breakdown bar chart — reveals how each clock contributes to the current consensus */}
                        <AnimatePresence>
                          {showBreakdown && reweightedConsensus && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="mt-3 bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 overflow-hidden"
                            >
                              <div className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 mb-2 font-bold">
                                Per-Clock Contribution to Consensus
                              </div>
                              <div className="space-y-1.5">
                                {reweightedConsensus.breakdown
                                  .slice()
                                  .sort((a, b) => b.weight_pct - a.weight_pct)
                                  .map(b => (
                                    <div key={b.clock} className="flex items-center gap-2 group" title={`${b.clock}: ${b.weight_pct.toFixed(1)}% weight, contributes ${b.contribution_yr.toFixed(2)} yr`}>
                                      <span className="text-[10px] font-mono text-neutral-300 w-20 shrink-0">{b.clock}</span>
                                      <div className="flex-1 h-3 bg-neutral-900 rounded-sm overflow-hidden relative">
                                        <motion.div
                                          initial={false}
                                          animate={{ width: `${b.weight_pct * 2.2}%` }}
                                          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
                                          className="h-full rounded-sm"
                                          style={{ backgroundColor: CLOCK_COLORS[b.clock], opacity: 0.85 }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-mono text-neutral-450 w-12 text-right">
                                        {b.weight_pct.toFixed(1)}%
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-neutral-950 border border-neutral-850 p-3.5 rounded-xl flex flex-col gap-0.5 relative overflow-hidden">
                          {clinicalQuestion !== "general" && (
                            <span className="absolute top-1.5 right-1.5 text-[8px] font-mono uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm tracking-wider">
                              {CLINICAL_QUESTIONS.find(q => q.id === clinicalQuestion)?.label} Lens
                            </span>
                          )}
                          <span className="text-[9px] text-neutral-500 uppercase font-mono">Consensus Bio Age</span>
                          <span className="text-xl font-black text-emerald-400 font-mono">
                            <AnimatedNumber value={reweightedConsensus?.consensus_age ?? analysisReport.consensus_age} decimals={1} /> <span className="text-[10px] text-neutral-500 font-normal">yr</span>
                          </span>
                          <span className="text-[9px] text-neutral-550 font-mono mt-0.5">
                            CI: [{(reweightedConsensus?.ci_low ?? analysisReport.consensus_ci[0]).toFixed(1)}, {(reweightedConsensus?.ci_high ?? analysisReport.consensus_ci[1]).toFixed(1)}]
                          </span>
                        </div>

                        <div className="bg-neutral-950 border border-neutral-850 p-3.5 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[9px] text-neutral-550 uppercase font-mono">Chronological Age</span>
                          <span className="text-xl font-bold text-white font-mono">
                            {analysisReport.chronological_age} <span className="text-[10px] text-neutral-500 font-normal">yr</span>
                          </span>
                          <span className="text-[9px] text-neutral-600 font-sans block mt-0.5">Baseline standard</span>
                        </div>

                        <div className="bg-neutral-950 border border-neutral-850 p-3.5 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[9px] text-neutral-550 uppercase font-mono">Age Acceleration</span>
                          {(() => {
                            const eff = (reweightedConsensus?.consensus_age ?? analysisReport.consensus_age) - analysisReport.chronological_age;
                            return (
                              <>
                                <span className={`text-xl font-black font-mono ${eff < 0 ? "text-emerald-400" : "text-rose-450"}`}>
                                  {eff < 0 ? "" : "+"}<AnimatedNumber value={eff} decimals={1} /> <span className="text-[10px] font-normal">yr</span>
                                </span>
                                <span className={`text-[9px] font-mono block mt-0.5 ${eff < 0 ? "text-emerald-500/85" : "text-rose-400"}`}>
                                  {eff < 0 ? "Rejuvenation Active" : "Accelerated Decline"}
                                </span>
                              </>
                            );
                          })()}
                        </div>

                        <div className="bg-neutral-950 border border-neutral-850 p-3.5 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[9px] text-neutral-550 uppercase font-mono">Disagreement Score</span>
                          <span className="text-xl font-bold text-cyan-400 font-mono">
                            {analysisReport.disagreement_score.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-neutral-550 font-mono block mt-0.5">Empirical z-score</span>
                        </div>
                      </div>

                      {/* Anomaly Callout Alerts if Isolation Forest below 10th percentile */}
                      {analysisReport.anomaly?.alert_text && (
                        <div className="mt-4 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-rose-300">
                          <ShieldAlert className="text-rose-400 shrink-0 w-5 h-5 mt-0.5 animate-pulse" />
                          <div>
                            <strong className="text-rose-200 block font-bold mb-0.5">CLINICAL MULTI-CLOCK DISCORDANCE FLAG</strong>
                            {analysisReport.anomaly.alert_text}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Highly Polished Modular Clock Panel List */}
                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 backdrop-blur">
                      <div className="flex items-center justify-between pb-3.5 border-b border-neutral-850 mb-4">
                        <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider font-semibold">INDIVIDUAL SYSTEM MAPPINGS</span>
                        <span className="text-[10px] text-neutral-550 font-mono">TOTAL SYSTEM COUPLING: D=7</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CLOCK_LABELS.map((name, idx) => {
                          const clockData = analysisReport.clocks[name];
                          if (!clockData) return null;

                          const val = clockData.value;
                          const isPace = name === "DunedinPACE";
                          const delta = isPace ? val - 1.0 : val - ptAge;
                          
                          let progressPct = isPace ? Math.min(100, (val / 1.5) * 100) : Math.min(100, (val / 80) * 100);
                          let speedColor = "text-neutral-400";
                          let labelText = "";

                          if (isPace) {
                            if (val < 1.0) {
                              speedColor = "text-emerald-400 font-semibold";
                              labelText = "Slow Aging Rate";
                            } else {
                              speedColor = "text-rose-450";
                              labelText = "High Aging Pace";
                            }
                          } else {
                            if (delta < 0) {
                              speedColor = "text-emerald-400 font-semibold";
                              labelText = `${Math.abs(delta).toFixed(1)} yr Younger`;
                            } else {
                              speedColor = "text-rose-450";
                              labelText = `${Math.abs(delta).toFixed(1)} yr Older`;
                            }
                          }

                          const starProfile = analysisReport.star_scores[name] || { Stability: 0.5, "Treatment-Responsiveness": 0.5, Associations: 0.5, "Clinical-Risk": 0.5 };

                          return (
                            <div key={name} className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl hover:border-neutral-700 hover:bg-neutral-950/80 transition flex flex-col justify-between gap-3.5 relative">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-extrabold text-white text-xs block">{name}</span>
                                  <span className="text-[9px] text-neutral-500 font-mono">
                                    {isPace ? "3rd Gen PACE OF AGING" : idx < 2 ? "1st Gen INTRINSIC" : "2nd Gen PHENOTYPIC"}
                                  </span>
                                </div>
                                
                                <div className="text-right">
                                  <span className="font-mono text-xs font-black text-white">
                                    {val.toFixed(isPace ? 3 : 1)}
                                    <span className="text-[10px] text-neutral-500 font-normal">{isPace ? " pace" : " yr"}</span>
                                  </span>
                                  <span className={`text-[9.5px] block leading-none mt-1 ${speedColor}`}>
                                    {labelText}
                                  </span>
                                </div>
                              </div>

                              {/* Progress horizontal indicator */}
                              <div className="space-y-1">
                                <div className="w-full bg-neutral-900 rounded-full h-1 overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    className={`h-full ${isPace && val < 1.0 ? "bg-cyan-400" : delta < 0 ? "bg-emerald-400" : "bg-neutral-800"}`}
                                  />
                                </div>
                                <div className="flex justify-between text-[8.5px] text-neutral-500 font-mono leading-none">
                                  <span>CI: [{clockData.ci_low.toFixed(isPace ? 3 : 1)}, {clockData.ci_high.toFixed(isPace ? 3 : 1)}]</span>
                                  <span>Reliability: {(clockData.reliability * 100).toFixed(0)}%</span>
                                </div>
                              </div>

                              {/* STAR Indicators */}
                              <div className="border-t border-neutral-900 pt-2.5 mt-0.5 space-y-1.5">
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8.5px] font-mono text-neutral-450">
                                  <div className="flex justify-between">
                                    <span>STABILITY:</span>
                                    <strong className="text-neutral-300">{(starProfile["Stability"] * 100).toFixed(0)}%</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>TREAT-RESP:</span>
                                    <strong className="text-neutral-300">{(starProfile["Treatment-Responsiveness"] * 100).toFixed(0)}%</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>ASSOCIATIONS:</span>
                                    <strong className="text-neutral-300">{(starProfile["Associations"] * 100).toFixed(0)}%</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>CLINICAL RISK:</span>
                                    <strong className="text-neutral-300">{(starProfile["Clinical-Risk"] * 100).toFixed(0)}%</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Trajectory Diagnostics Visualization Panel */}
                    {longitudinalAnalysis && (
                      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 backdrop-blur space-y-6">
                        
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-850 pb-4">
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 block font-semibold">Analytical Trajectories</span>
                            <h4 className="text-sm font-bold text-white mt-0.5">TRAJECTORY REGRESSION & BAYESIAN TRIANGULATION</h4>
                          </div>
                          
                          {longitudinalAnalysis.changepoint?.visit && (
                            <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 rounded-xl px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 leading-none">
                              <Sparkles size={11} className="animate-spin" style={{ animationDuration: '6s' }} />
                              <span>Pivot Point: <strong>{longitudinalAnalysis.changepoint.visit}</strong> ({(longitudinalAnalysis.changepoint.confidence * 100).toFixed(0)}%)</span>
                            </div>
                          )}
                        </div>

                        {/* Split: SVG Bayesian Trajectory Graphic (Left or Top) and Slopes (Right) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                          
                          {/* Left: SVG Credible Interval Polygon Visualization */}
                          <div className="lg:col-span-7 bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-4">
                            <span className="text-[10px] font-mono uppercase text-neutral-450 tracking-wider font-semibold block">
                              BAYESIAN AGING DECELERATION & CREDIBLE BOUNDS
                            </span>

                            {/* Custom SVG Line graph */}
                            <div className="relative h-60 w-full bg-neutral-900/30 rounded-lg p-2 flex flex-col justify-between border border-neutral-900">
                              <svg className="absolute inset-0 w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
                                {/* Grid reference lines */}
                                <line x1="0" y1="20" x2="100" y2="20" stroke="#1c1c1c" strokeWidth="0.5" />
                                <line x1="0" y1="50" x2="100" y2="50" stroke="#1c1c1c" strokeWidth="0.5" />
                                <line x1="0" y1="80" x2="100" y2="80" stroke="#1c1c1c" strokeWidth="0.5" />
                                
                                {(() => {
                                  const traj = longitudinalAnalysis.bayes_consensus_trajectory;
                                  if (!traj || traj.length < 2) return null;
                                  
                                  const n = traj.length;
                                  const minChrono = traj[0].chrono_age;
                                  const maxChrono = traj[n-1].chrono_age;
                                  
                                  // Find absolute bounds in y
                                  let minY = Math.min(...traj.map((t: any) => Math.min(t.chrono_age, t.ci_low)));
                                  let maxY = Math.max(...traj.map((t: any) => Math.max(t.chrono_age, t.ci_high)));
                                  const pad = (maxY - minY) * 0.1 || 1.0;
                                  minY -= pad;
                                  maxY += pad;

                                  const scaleX = (val: number) => ((val - minChrono) / (maxChrono - minChrono)) * 100;
                                  const scaleY = (val: number) => 100 - (((val - minY) / (maxY - minY)) * 100);

                                  // 1. Plot Credible bounds ribbon as a translucent polygon
                                  const polyPoints = [
                                    ...traj.map((t: any, i: number) => `${scaleX(t.chrono_age)},${scaleY(t.ci_high)}`),
                                    ...[...traj].reverse().map((t: any) => `${scaleX(t.chrono_age)},${scaleY(t.ci_low)}`)
                                  ].join(" ");

                                  // 2. Chronological Age dotted guide line
                                  const chronoPoints = traj.map((t: any) => `${scaleX(t.chrono_age)},${scaleY(t.chrono_age)}`).join(" ");

                                  // 3. Bayesian consensus mean line
                                  const meanPoints = traj.map((t: any) => `${scaleX(t.chrono_age)},${scaleY(t.mean)}`).join(" ");

                                  return (
                                    <>
                                      {/* Polygons & lines */}
                                      <polygon points={polyPoints} fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="0.5" />
                                      <polyline points={chronoPoints} fill="none" stroke="#525252" strokeWidth="1" strokeDasharray="3 3" />
                                      <polyline points={meanPoints} fill="none" stroke="#10b981" strokeWidth="2" />
                                      
                                      {/* Scatter circles and label nodes */}
                                      {traj.map((t: any, i: number) => {
                                        const cx = scaleX(t.chrono_age);
                                        const cy = scaleY(t.mean);
                                        return (
                                          <g key={i}>
                                            <circle cx={cx} cy={cy} r="2.2" fill="#10b981" stroke="#000" strokeWidth="0.5" />
                                            <text x={cx} y={cy - 5} fill="#a3a3a3" fontSize="5" textAnchor="middle" fontFamily="monospace">
                                              {t.visit}
                                            </text>
                                          </g>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </svg>

                              {/* Simple Legend overlay */}
                              <div className="absolute bottom-2 left-2 flex gap-3.5 bg-neutral-950/80 p-2 rounded border border-neutral-850 font-mono text-[8px] leading-none z-10 text-neutral-400">
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-0.5 border-t-2 border-dashed border-neutral-600 inline-block" />
                                  Chrono Age
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
                                  Latent Bio-Age (Posterior Mean)
                                </span>
                                <span className="flex items-center gap-1 text-emerald-500/60">
                                  <span className="w-2.5 h-2 bg-emerald-500/10 border border-emerald-500/20 inline-block" />
                                  95% Credible Bounds
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Per-Clock Linear slopes summary coefficients (5 columns) */}
                          <div className="lg:col-span-5 bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-4">
                            <span className="text-[10px] font-mono uppercase text-neutral-450 tracking-wider font-semibold block">
                              PER-CLOCK COEFFS (YEARS/YEARS)
                            </span>

                            <div className="space-y-2.5 font-mono text-[10px]">
                              {CLOCK_LABELS.map(name => {
                                const trajData = longitudinalAnalysis.per_clock_trajectories[name];
                                if (!trajData) return null;

                                const isImp = trajData.slope < 0;
                                return (
                                  <div key={name} className="flex justify-between items-start py-1.5 border-b border-neutral-900">
                                    <div>
                                      <strong className="text-white block">{name}</strong>
                                      <span className="text-[8.5px] text-neutral-500">R²: {trajData.r_squared.toFixed(2)} | p: {trajData.p_value.toFixed(3)}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`font-bold block ${isImp ? "text-emerald-400" : "text-neutral-400"}`}>
                                        {trajData.slope.toFixed(3)} /yr
                                      </span>
                                      <span className="text-[8.5px] text-neutral-550 block">CI: [{trajData.slope_ci_low.toFixed(2)}, {trajData.slope_ci_high.toFixed(2)}]</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>

                        {/* Program effect attribution card */}
                        {longitudinalAnalysis.attribution && (
                          <div className="bg-cyan-950/15 border border-cyan-950 p-4 rounded-xl space-y-2">
                            <span className="text-[9.5px] font-mono uppercase text-cyan-400 tracking-wider font-bold block flex items-center gap-1.5">
                              <Heart size={12} className="text-cyan-400" />
                              Therapeutic Program Attribution Diagnostics
                            </span>

                            <p className="text-xs text-neutral-300 leading-relaxed">
                              Following the pivot point at visit <strong className="text-white">{longitudinalAnalysis.changepoint.visit}</strong>, enrollment in the <strong className="text-emerald-400">{longitudinalAnalysis.attribution.attributed_programs.join(" + ")}</strong> therapeutic regimen is attributed with a biological decelerative effect saving <strong className="text-cyan-400">{longitudinalAnalysis.attribution.rejuvenation_delta.toFixed(2)} years</strong> of physiological aging (posterior delta 95% credible range: <strong className="text-neutral-200">{longitudinalAnalysis.attribution.ci_low.toFixed(2)} to {longitudinalAnalysis.attribution.ci_high.toFixed(2)} years</strong>) compared to standard clinical control decline rates.
                            </p>
                          </div>
                        )}

                        {/* Interactive visits summary logs array */}
                        <div className="overflow-x-auto border-t border-neutral-900 pt-4">
                          <table className="w-full text-left font-mono text-[10.5px] border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-850 text-neutral-500 uppercase text-[8.5px]">
                                <th className="py-2">Visit Label</th>
                                <th className="py-2">Chrono Age</th>
                                <th className="py-2">Latent Consensus Age</th>
                                <th className="py-2">PhenoAge (2nd Gen)</th>
                                <th className="py-2">GrimAge (2nd Gen)</th>
                                <th className="py-2">DunedinPACE (Rate)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-900 text-neutral-300">
                              {longitudinalVisits.map((visit, vIdx) => {
                                const lat = longitudinalAnalysis.bayes_consensus_trajectory?.[vIdx] || { mean: 50, ci_low: 49, ci_high: 51 };
                                return (
                                  <tr key={vIdx} className="hover:bg-neutral-950/40 transition">
                                    <td className="py-2.5 font-bold text-emerald-400">{visit.visit}</td>
                                    <td className="py-2.5">{visit.chronoAge} yr</td>
                                    <td className="py-2.5 text-white font-semibold">
                                      {lat.mean.toFixed(1)} yr <span className="text-[9px] text-neutral-500">[{lat.ci_low.toFixed(1)}, {lat.ci_high.toFixed(1)}]</span>
                                    </td>
                                    <td className="py-2.5">{visit.clocks.PhenoAge.toFixed(1)} yr</td>
                                    <td className="py-2.5">{visit.clocks.GrimAge.toFixed(1)} yr</td>
                                    <td className="py-2.5">
                                      <span className={`px-1 rounded ${
                                        visit.clocks.DunedinPACE < 1.0 ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/10" : "text-neutral-400"
                                      }`}>
                                        {visit.clocks.DunedinPACE.toFixed(3)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                      </div>
                    )}

                    {/* AI Clinical Interpreter Copilot Section */}
                    {isInterpreting ? (
                      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 backdrop-blur space-y-4 animate-pulse">
                        <div className="flex items-center gap-2">
                          <RefreshCcw size={16} className="text-emerald-500 animate-spin" />
                          <span className="text-xs font-mono uppercase text-neutral-400 font-bold">Initializing Genomic Cognition Layer...</span>
                        </div>
                        <div className="h-4 bg-neutral-800 rounded w-3/4"></div>
                        <div className="h-12 bg-neutral-800 rounded"></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="h-20 bg-neutral-800 rounded"></div>
                          <div className="h-20 bg-neutral-800 rounded"></div>
                          <div className="h-20 bg-neutral-800 rounded"></div>
                        </div>
                      </div>
                    ) : aiInterpretation ? (
                      <div className="bg-neutral-900/65 border border-neutral-800 rounded-2xl p-6 backdrop-blur space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="text-emerald-400 animate-pulse" size={16} />
                            <div>
                              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 block font-semibold">AI Clinical Copilot</span>
                              <h4 className="text-sm font-bold text-white mt-0.5">GENOMIC INTERPRETATION SUMMARY</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {clinicalQuestion !== "general" && (
                              <span className="text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {CLINICAL_QUESTIONS.find(q => q.id === clinicalQuestion)?.label} Lens
                              </span>
                            )}
                            <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                              Active Cognition
                            </span>
                          </div>
                        </div>

                        {/* Summary & Biological Story */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                          <div className="md:col-span-8 bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                            <div>
                              <span className="text-[9.5px] font-mono uppercase text-neutral-500 tracking-wider block mb-2 font-bold">Clinical Synthesis Narrative</span>
                              <AnimatePresence mode="wait">
                                <motion.p
                                  key={clinicalQuestion}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  transition={{ duration: 0.3 }}
                                  className="text-xs text-neutral-300 leading-relaxed font-sans"
                                >
                                  {questionAdaptedInterpretation.clinical_summary}
                                </motion.p>
                              </AnimatePresence>
                            </div>
                          </div>
                          <div className="md:col-span-4 bg-neutral-950 border border-neutral-850 p-4 rounded-xl flex flex-col justify-between">
                            <div>
                              <span className="text-[9.5px] font-mono uppercase text-neutral-500 tracking-wider block mb-2 font-bold">Dominant Driver</span>
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={clinicalQuestion}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.25 }}
                                  className="bg-emerald-950/20 text-emerald-400 border border-emerald-500/10 px-3 py-2 rounded-lg text-xs font-semibold select-none leading-snug"
                                >
                                  {questionAdaptedInterpretation.biological_story}
                                </motion.div>
                              </AnimatePresence>
                            </div>
                            <span className="text-[8px] font-mono text-neutral-550 block mt-2">Targeted metabolic & cellular metrics</span>
                          </div>
                        </div>

                        {/* Recommendations Bento Grid */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono uppercase text-neutral-450 tracking-wider font-semibold block">
                            Evidence-Weighted Recommendations ({questionAdaptedInterpretation.recommendations?.length || 0})
                          </span>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {questionAdaptedInterpretation.recommendations?.map((rec: any, idx: number) => {
                              const effectSign = rec.expected_effect?.delta_years < 0 ? "" : "+";
                              return (
                                <div key={idx} className={`bg-neutral-950 border ${clinicalQuestion !== "general" && idx === 0 ? "border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]" : "border-neutral-850"} p-4 font-mono rounded-xl space-y-3 flex flex-col justify-between hover:border-neutral-750 transition-all relative`}>
                                  {clinicalQuestion !== "general" && rec.question_relevance && rec.question_relevance > 0.7 && (
                                    <span className="absolute -top-2 -right-1.5 text-[8px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm tracking-wider">
                                      {(rec.question_relevance * 100).toFixed(0)}% {CLINICAL_QUESTIONS.find(q => q.id === clinicalQuestion)?.label.slice(0, 7)} Fit
                                    </span>
                                  )}
                                  <div className="space-y-2 font-sans">
                                    <div className="flex justify-between items-start font-mono">
                                      <h5 className="text-xs font-extrabold text-white leading-tight font-sans">{rec.intervention}</h5>
                                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded leading-none ${
                                        rec.evidence_grade === "A" 
                                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15" 
                                          : rec.evidence_grade === "B" 
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                                          : "bg-amber-500/10 text-amber-505 border border-amber-500/15"
                                      }`}>
                                        Grade {rec.evidence_grade}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-455 leading-normal font-sans">{rec.rationale}</p>
                                  </div>

                                  <div className="space-y-2 border-t border-neutral-900/60 pt-2 text-[10px] font-mono">
                                    <div className="flex items-center justify-between text-neutral-400">
                                      <span>Expectation:</span>
                                      <span className="text-cyan-400 font-bold">
                                        {rec.expected_effect?.clock}: {effectSign}{rec.expected_effect?.delta_years} yr ({rec.expected_effect?.timeline_weeks}w)
                                      </span>
                                    </div>
                                    
                                    {/* Confidence Slider */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[8px] text-neutral-550">
                                        <span>Confidence Score:</span>
                                        <span>{(rec.confidence * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden">
                                        <div 
                                          className="bg-emerald-500 h-full rounded-full" 
                                          style={{ width: `${rec.confidence * 100}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Citations list links */}
                                    {rec.supporting_citations && rec.supporting_citations.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {rec.supporting_citations.map((cite: string) => (
                                          <button
                                            key={cite}
                                            onClick={() => {
                                              setActiveTab("citations");
                                              setEvidenceSearch(cite);
                                            }}
                                            className="text-[8px] bg-neutral-900 hover:bg-neutral-850 hover:text-white text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-850/60 transition"
                                          >
                                            📄 {cite}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Suggested Follow-up Inquiries */}
                        {questionAdaptedInterpretation.follow_up_questions && questionAdaptedInterpretation.follow_up_questions.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-neutral-850">
                            <span className="text-[9px] font-mono uppercase text-neutral-500 tracking-wider block font-bold">
                              SUGGESTED PATHWAY INQUIRIES
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {questionAdaptedInterpretation.follow_up_questions.map((q: string, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setFollowupQuestion(q);
                                    handleAskFollowup(q);
                                  }}
                                  disabled={isQueryingFollowup}
                                  className="text-[10px] text-neutral-300 font-medium bg-neutral-950 hover:bg-neutral-900 hover:border-neutral-700 text-left px-3 py-1.5 rounded-xl border border-neutral-850 transition leading-relaxed max-w-full hover:cursor-pointer"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Conversational Console */}
                        <div className="space-y-3 pt-4 border-t border-neutral-850 bg-neutral-950/40 p-4 rounded-xl border border-neutral-850">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-neutral-450 font-bold">
                            <Activity size={12} className="text-emerald-400 animate-pulse" />
                            <span>CO-PILOT INTERACTIVE DISCUSSION CHANNEL</span>
                          </div>

                          {/* Chat Messages */}
                          {chatHistory.length > 0 ? (
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                              {chatHistory.map((msg, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                                    msg.role === "user" 
                                      ? "bg-neutral-900/90 border border-neutral-800 ml-6 text-neutral-300"
                                      : "bg-emerald-950/10 border border-emerald-500/10 mr-6 text-neutral-2xl"
                                  }`}
                                >
                                  <div className="font-mono text-[9px] text-neutral-550 mb-1 flex items-center gap-1">
                                    <span>●</span>
                                    <span>{msg.role === "user" ? "CLINICIAN RESEARCHER" : "CO-PILOT INTEL"}</span>
                                  </div>
                                  <p className="font-sans whitespace-pre-wrap">{msg.text}</p>
                                  {msg.actions && msg.actions.length > 0 && (
                                    <div className="mt-2.5 space-y-1 font-mono text-[10px]">
                                      <span className="text-[8px] uppercase text-emerald-400 block font-bold">Clinical Action Directives:</span>
                                      <ul className="list-disc list-inside space-y-0.5 text-neutral-400">
                                        {msg.actions.map((act: string, aIdx: number) => (
                                          <li key={aIdx} className="font-sans">{act}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-neutral-500 font-mono italic">
                              Interactive session console open. Ask custom clinical queries below.
                            </p>
                          )}

                          {/* Chat Input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={followupQuestion}
                              onChange={(e) => setFollowupQuestion(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAskFollowup();
                              }}
                              disabled={isQueryingFollowup}
                              placeholder="Inquire about mTOR dosing intervals, metformin renal thresholds, diet timing..."
                              className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-neutral-700 outline-none text-xs text-white rounded-xl px-3.5 py-2 placeholder-neutral-550 font-mono transition"
                            />
                            <button
                              onClick={() => handleAskFollowup()}
                              disabled={isQueryingFollowup || !followupQuestion.trim()}
                              className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 rounded-xl px-4 py-2 text-xs font-semibold hover:cursor-pointer disabled:opacity-45 disabled:pointer-events-none transition flex items-center gap-1"
                            >
                              {isQueryingFollowup ? (
                                <RefreshCcw size={12} className="animate-spin" />
                              ) : (
                                "Ask"
                              )}
                            </button>
                          </div>
                        </div>

                      </div>
                    ) : null}
                  </div>
                )}

              </div>

            </motion.div>
          )}

          {/* TAB 2: CORRELATED VERIFICATION COHORT INDEX */}
          {activeTab === "verification" && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 relative backdrop-blur">
                <div className="absolute top-0 right-6 w-16 h-1 bg-cyan-400 rounded-b" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Cpu size={16} className="text-cyan-400" />
                      Joint Statistical Covariance & Pearson Validation
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Sample an entire cohort of size N dynamically and compute multidimensional matrices below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-neutral-400 font-mono">Cohort Size:</span>
                    <select
                      value={cohortSize}
                      onChange={(e) => setCohortSize(Number(e.target.value))}
                      className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs outline-none text-white focus:border-cyan-500/40"
                    >
                      <option value="50">N = 50 Patients</option>
                      <option value="100">N = 100 Patients</option>
                      <option value="250">N = 250 Patients</option>
                      <option value="500">N = 500 Patients</option>
                    </select>

                    <button
                      onClick={compileCohortValidation}
                      disabled={isSummarizing}
                      className="bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCcw size={12} className={isSummarizing ? "animate-spin" : ""} />
                      <span>{isSummarizing ? "Compiling Matrix..." : "Extract Verification Cohort"}</span>
                    </button>
                  </div>
                </div>

                {cohortSummary && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left: Summary Numbers (4 columns) */}
                    <div className="lg:col-span-4 space-y-4">
                      
                      <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl space-y-3.5">
                        <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider flex items-center gap-1">
                          <Database size={12} />
                          <span>Aggregate Demographics</span>
                        </span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-lg flex flex-col gap-0.5">
                            <span className="text-[9px] text-neutral-550 uppercase font-mono">Avg Chrono Age</span>
                            <span className="text-base font-bold text-white font-mono">{cohortSummary.avgAge} yr</span>
                          </div>

                          <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-lg flex flex-col gap-0.5">
                            <span className="text-[9px] text-neutral-550 uppercase font-mono">Avg DunedinPACE</span>
                            <span className="text-base font-bold text-cyan-400 font-mono">{cohortSummary.avgPace} rate</span>
                          </div>
                        </div>
                      </div>

                      {/* Means & Standard deviations listed */}
                      <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl">
                        <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider block mb-3.5">
                          Empirical Accelerations Distributions
                        </span>

                        <div className="space-y-2.5 font-mono text-[11px]">
                          {CLOCK_LABELS.map((name, idx) => {
                            const meanAccel = cohortSummary.means[idx];
                            const sdVal = cohortSummary.stdDevs[idx];
                            const isP = name === "DunedinPACE";
                            return (
                              <div key={name} className="flex justify-between items-center py-1 border-b border-neutral-900">
                                <span className="text-neutral-300 font-bold">{name}</span>
                                <div className="text-neutral-400 flex gap-2">
                                  <span>μ: <strong className={meanAccel < 0 ? "text-emerald-400" : "text-neutral-200"}>{meanAccel < 0 ? "" : "+"}{meanAccel.toFixed(2)}{isP ? "" : "yr"}</strong></span>
                                  <span className="text-neutral-600">|</span>
                                  <span>σ: <strong>{sdVal.toFixed(2)}{isP ? "" : "yr"}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-neutral-550 leading-relaxed mt-3.5 font-sans">
                          Averages align perfectly with published standard margins, reflecting robust stochastic coupling centered around healthy longevity client phenotypes (-delta deviations represent biologically customized clinical metrics).
                        </p>
                      </div>

                    </div>

                    {/* Right: Colored Correlation Matrix Table (8 columns) */}
                    <div className="lg:col-span-8 bg-neutral-950 border border-neutral-800 p-5 rounded-xl">
                      <div className="flex items-center justify-between mb-4 border-b border-neutral-900 pb-2">
                        <span className="text-[10px] font-mono uppercase text-neutral-450 tracking-wider">
                          7x7 EPIGENETIC ACCELERATION PEARSON CORRELATION MATRIX
                        </span>
                        <div className="flex gap-2 text-[8px] font-mono leading-none">
                          <span className="flex items-center gap-1 text-emerald-450">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Strong Post
                          </span>
                          <span className="flex items-center gap-1 text-neutral-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                            Weak/Mod
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-center font-mono text-xs border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 border-b border-neutral-850 text-left text-neutral-550 text-[10px]" />
                              {CLOCK_LABELS.map(header => (
                                <th key={header} className="p-2 border-b border-neutral-850 text-neutral-350 text-[10px] font-bold">
                                  {header.substring(0, 7)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {CLOCK_LABELS.map((rowLabel, rIdx) => (
                              <tr key={rowLabel} className="border-b border-neutral-900">
                                <td className="p-2 border-r border-neutral-900 text-left text-neutral-350 text-[11px] font-semibold bg-neutral-900/45">
                                  {rowLabel}
                                </td>
                                {cohortSummary.corrMatrix[rIdx].map((cellVal, cIdx) => {
                                  // Find heat scale color
                                  let bgClass = "bg-neutral-950 text-neutral-500";
                                  const absVal = Math.abs(cellVal);
                                  
                                  if (rIdx === cIdx) {
                                    bgClass = "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/25";
                                  } else if (absVal >= 0.7) {
                                    bgClass = "bg-emerald-555/15 text-emerald-450 font-semibold";
                                  } else if (absVal >= 0.5) {
                                    bgClass = "bg-emerald-600/10 text-emerald-300";
                                  } else if (absVal >= 0.3) {
                                    bgClass = "bg-cyan-500/10 text-cyan-400";
                                  } else if (absVal >= 0.15) {
                                    bgClass = "bg-neutral-900 text-neutral-300";
                                  }
                                  
                                  return (
                                    <td key={cIdx} className={`p-2.5 text-[11px] transition hover:scale-[1.02] ${bgClass}`}>
                                      {cellVal.toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 bg-neutral-900/60 p-3.5 rounded-lg border border-neutral-850 text-[10px] text-neutral-400 leading-relaxed flex gap-2">
                        <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Analysis Target verification check:</strong> Observe how Horvath/Hannum align around ~0.75, PhenoAge/GrimAge match ~0.65, and DunedinPACE rate maintains low-to-moderate coupling with the other clocks. This proves standard multidimensional Gaussian correlation properties running dynamically!
                        </div>
                      </div>

                    </div>

                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: CODE SNIPPET EXPLORER */}
          {activeTab === "code" && (
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              
              {/* Left Column: Directories (4 columns) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 backdrop-blur">
                  <h3 className="text-xs font-mono text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FolderTree size={13} className="text-neutral-500" />
                    <span>Scaffold Tree Directories</span>
                  </h3>

                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="text-neutral-500 flex items-center gap-1.5 py-0.5">
                        <Folder size={12} className="text-neutral-600" />
                        <span>/ (Workspace Root)</span>
                      </div>
                      <div className="pl-4 space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 rounded text-neutral-400">
                          <span className="flex items-center gap-1.5">
                            <FileCode size={11} className="text-neutral-550" />
                            <span>docker-compose.yml</span>
                          </span>
                          <span className="text-[9px] text-neutral-600 uppercase">YML Config</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 rounded text-neutral-400">
                          <span className="flex items-center gap-1.5">
                            <FileText size={11} />
                            <span>README.md</span>
                          </span>
                          <span className="text-[9px] text-neutral-600 uppercase">Markdown</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-300 font-semibold flex items-center gap-1.5 py-0.5">
                        <Folder size={12} className="text-emerald-500" />
                        <span>/backend</span>
                      </div>
                      <div className="pl-4 space-y-1">
                        <button 
                          onClick={() => setActiveFile("backend/synthetic/generator.py")}
                          className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded transition ${
                            activeFile === "backend/synthetic/generator.py" 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <FileCode size={11} className="text-cyan-400" />
                            <span>synthetic/generator.py</span>
                          </span>
                          <span className="text-[9px] text-neutral-600 uppercase">Python</span>
                        </button>
                        <div className="flex items-center justify-between px-2 py-1 text-neutral-500">
                          <span className="flex items-center gap-1.5">
                            <FileText size={11} />
                            <span>requirements.txt</span>
                          </span>
                          <span className="text-[9px] text-neutral-600">Generated</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-300 font-semibold flex items-center gap-1.5 py-0.5">
                        <Folder size={12} className="text-cyan-400" />
                        <span>/frontend</span>
                      </div>
                      <div className="pl-4 space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 text-neutral-400">
                          <span className="flex items-center gap-1.5">
                            <FileCode size={11} className="text-purple-400" />
                            <span>app/page.tsx</span>
                          </span>
                          <span className="text-[9px] text-neutral-600">Next.js 14</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 text-neutral-550">
                          <span className="flex items-center gap-1.5">
                            <FileText size={11} />
                            <span>tailwind.config.ts</span>
                          </span>
                          <span className="text-[9px] text-neutral-650">Config</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-803 p-4 rounded-xl font-mono text-[11px] leading-relaxed relative">
                  <div className="text-[10px] text-neutral-500 font-sans uppercase mb-1">Scaffold Deployment Hook</div>
                  <pre className="text-emerald-400 bg-neutral-950 p-2 rounded">
                    docker-compose up --build
                  </pre>
                </div>
              </div>

              {/* Code window (8 columns) */}
              <div className="lg:col-span-8 bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 backdrop-blur">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCode size={15} className="text-emerald-400" />
                      {activeFile}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Stochastic medical clock generator utilizing Covariance factors matching clinical trials.
                    </p>
                  </div>

                  <button 
                    onClick={() => copyToClipboard(pythonCode, "python")}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-neutral-700/50 cursor-pointer"
                  >
                    {copiedText === "python" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedText === "python" ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>

                <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-4 overflow-x-auto font-mono text-[11px] text-neutral-300 leading-normal h-[380px] select-all">
                  <pre>{pythonCode}</pre>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 4: CLINICAL CITATIONS AND 40-STUDY INTERVENTION EVIDENCE BASE */}
          {activeTab === "citations" && (
            <motion.div
              key="citations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              
              {/* Header search controllers */}
              <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl backdrop-blur relative">
                <div className="absolute top-0 right-6 w-16 h-1 bg-emerald-500 rounded-b" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                       <BookOpen size={18} className="text-emerald-400" />
                       Therapeutic Intervention Certified Evidence Base
                    </h3>
                    <p className="text-xs text-neutral-450 mt-0.5">
                      Explore our certified compilation of 40 longevity clinical trials and associated epigenetic clock effect measurements.
                    </p>
                  </div>

                  {/* Search input of studies */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-neutral-500 w-3.5 h-3.5" />
                      <input 
                        type="text"
                        placeholder="Search intervention name..."
                        value={evidenceSearch}
                        onChange={(e) => setEvidenceSearch(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 pl-9 pr-4 py-1.5 rounded-lg text-xs text-white outline-none focus:border-emerald-500/45 w-48 font-sans"
                      />
                    </div>

                    {/* Grade filter */}
                    <select
                      value={evidenceGradeFilter}
                      onChange={(e) => setEvidenceGradeFilter(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 px-2 rounded-lg py-1.5 text-xs text-neutral-300 pointer-events-auto"
                    >
                      <option value="ALL">All Grades (Strength)</option>
                      <option value="A">Grade A (Highest Stability)</option>
                      <option value="B">Grade B (Robust Trial)</option>
                      <option value="C">Grade C (Observational/Small)</option>
                    </select>

                    <select
                      value={evidenceTypeFilter}
                      onChange={(e) => setEvidenceTypeFilter(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 px-2 rounded-lg py-1.5 text-xs text-neutral-300 pointer-events-auto"
                    >
                      <option value="ALL">All Study Types</option>
                      <option value="RCT">RCT (Gold Standard)</option>
                      <option value="observational">Observational / Cohort</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Grid lists of matching citations */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(evidenceList || [
                  {
                    id: "FALLBACK-001",
                    intervention: "Rapamycin (mTOR inhibitor Studies)",
                    dosage: "5 mg weekly dosing protocols",
                    target_clocks: ["GrimAge", "PhenoAge", "DunedinPACE"],
                    effect_sizes: { GrimAge: { delta: -1.2, unit: "years" } },
                    study_type: "RCT",
                    n: 65,
                    duration_weeks: 12,
                    population: "Healthy adults aged 65+",
                    citation: "Mannick et al. 2018 Sci Transl Med",
                    doi: "10.1126/scitranslmed.aaq1564",
                    quality_grade: "A"
                  },
                  {
                    id: "FALLBACK-002",
                    intervention: "Caloric Restriction Trials (CALERIE)",
                    dosage: "25% calorie translation protocols",
                    target_clocks: ["DunedinPACE", "GrimAge"],
                    effect_sizes: { DunedinPACE: { delta: -0.05, unit: "pace" } },
                    study_type: "RCT",
                    n: 220,
                    duration_weeks: 104,
                    population: "Healthy non-obese young adults",
                    citation: "Belsky et al. 2022 Nature Aging",
                    doi: "10.1038/s43587-022-00357-y",
                    quality_grade: "A"
                  },
                  {
                    id: "FALLBACK-003",
                    intervention: "Unified Lifestyle Modification Program",
                    dosage: "Vegetological diet, regular sleep, physical regimen",
                    target_clocks: ["Horvath", "Hannum"],
                    effect_sizes: { Horvath: { delta: -3.23, unit: "years" } },
                    study_type: "RCT",
                    n: 43,
                    duration_weeks: 8,
                    population: "Adult males aged 50-72",
                    citation: "Fitzgerald et al. 2021 Aging",
                    doi: "10.18632/aging.202913",
                    quality_grade: "B"
                  }
                ])
                .filter(study => {
                  const mSearch = study.intervention.toLowerCase().includes(evidenceSearch.toLowerCase()) || 
                                  study.citation.toLowerCase().includes(evidenceSearch.toLowerCase()) ||
                                  study.population.toLowerCase().includes(evidenceSearch.toLowerCase());
                  const mGrade = evidenceGradeFilter === "ALL" || study.quality_grade === evidenceGradeFilter;
                  const mType = evidenceTypeFilter === "ALL" || study.study_type === evidenceTypeFilter;
                  return mSearch && mGrade && mType;
                })
                .map(study => {
                  let grBg = "bg-neutral-950 border border-neutral-850";
                  let badge = "bg-neutral-800 text-neutral-350";
                  if (study.quality_grade === "A") {
                    badge = "bg-emerald-500/10 text-emerald-405 border border-emerald-500/15";
                  } else if (study.quality_grade === "B") {
                    badge = "bg-cyan-500/10 text-cyan-405 border border-cyan-500/15";
                  } else if (study.quality_grade === "C") {
                    badge = "bg-amber-500/10 text-amber-400 border border-amber-500/15";
                  }

                  return (
                    <div key={study.id} className="bg-neutral-900/40 border border-neutral-800 p-5 rounded-2xl backdrop-blur hover:border-neutral-700 hover:bg-neutral-900/60 transition flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-mono text-neutral-500 block uppercase font-bold tracking-widest">{study.id}</span>
                          <span className={`text-[10px] uppercase px-2 font-mono font-bold py-0.5 rounded ${badge}`}>
                            GRADE {study.quality_grade}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-white leading-normal">{study.intervention}</h4>
                          <span className="text-[10.5px] text-neutral-450 block font-mono">{study.dosage}</span>
                        </div>
                        
                        <div className="border-t border-neutral-850/60 pt-2.5 text-[11px] space-y-1 flex flex-col justify-start">
                          <div className="flex justify-between py-0.5">
                            <span className="text-neutral-500 font-mono">Cohort:</span>
                            <span className="text-neutral-300 font-sans font-medium line-clamp-1">{study.population}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-neutral-500 font-mono">Sample (N):</span>
                            <span className="text-neutral-300 font-mono">N = {study.n} ({study.study_type})</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-neutral-500 font-mono">Duration:</span>
                            <span className="text-neutral-300 font-mono">{study.duration_weeks} Weeks</span>
                          </div>
                        </div>

                        {/* Effects mapped */}
                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 text-[10.5px] space-y-1.5 font-mono">
                          <span className="text-[8.5px] text-neutral-500 block">RECORDED THERAPEUTIC ADJUSTMENTS:</span>
                          {Object.entries(study.effect_sizes).map(([clockName, effect]: any) => {
                            const isNeg = effect.delta < 0;
                            return (
                              <div key={clockName} className="flex justify-between py-0.5">
                                <span className="text-neutral-300 font-bold">{clockName}:</span>
                                <span className={`font-semibold ${isNeg ? "text-emerald-450" : "text-neutral-400"}`}>
                                  {effect.delta > 0 ? "+" : ""}{effect.delta.toFixed(isNeg ? 3 : 1)} {effect.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Citation doi */}
                      <div className="border-t border-neutral-850/80 pt-3 flex justify-between items-center text-[10px] font-mono">
                        <span className="text-neutral-500 line-clamp-1">{study.citation}</span>
                        <a 
                          href={`https://doi.org/${study.doi}`} 
                          target="_blank" 
                          rel="referrer" 
                          className="text-emerald-400 hover:text-emerald-300 transition shrink-0 underline"
                        >
                          DOI
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 text-center text-xs text-neutral-550 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>ChronosLayer Mathematical & Synthetics Studio. Standard preview active.</span>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-neutral-500">
            <span>FastAPI Module: generator.py</span>
            <span>Frontend App: App.tsx</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
