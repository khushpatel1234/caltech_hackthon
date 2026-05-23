"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  LineChart,
  Brain,
  ArrowRight,
  FlaskConical,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 font-sans selection:bg-teal-100 selection:text-teal-900 flex flex-col justify-between transition-colors duration-200">

      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Navigation */}
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white/75 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#0F766E]/10 p-2 rounded-xl border border-[#0F766E]/15">
              <FlaskConical className="text-[#0F766E] w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-950 dark:text-white">
              Chronos<span className="text-[#0F766E]">Layer</span>
            </span>
            <span className="text-[9px] font-mono font-extrabold uppercase bg-teal-50 dark:bg-teal-900/20 text-[#0F766E] border border-teal-100 dark:border-teal-800 px-2 py-0.5 rounded ml-2.5 tracking-wider">
              CLINIC OS v1.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/cohort"
              className="text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-[#0F766E] transition-colors"
            >
              Cohort Explorer
            </Link>
            <ThemeToggle />
            <Link
              href="/patient/hero"
              className="text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D5F58] px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Demo Patient
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-20 md:py-28 flex-grow w-full space-y-16 relative">

        {/* HERO */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 px-3.5 py-1 rounded-full text-xs font-semibold text-[#0F766E]">
            <Sparkles size={13} className="text-[#0F766E] shrink-0" />
            <span>Caltech AI Longevity Hackathon 2026 Entry</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-950 dark:text-white tracking-tight leading-[1.1] font-sans">
              ChronosLayer
            </h1>
            <p className="text-lg sm:text-xl font-bold text-[#0F766E] tracking-tight max-w-2xl mx-auto leading-normal">
              The validation layer for the epigenetic clock industry
            </p>
          </div>

          <p className="text-slate-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Every longevity clinic in America is making clinical decisions on a single biological age clock — despite published evidence that clocks disagree on the same patient by 5+ years. ChronosLayer runs every sample through 7 clocks, triangulates with Bayesian inference, and explains the result in clinical language.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/patient/hero"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#0D5F58] text-white font-bold px-7 py-3.5 rounded-xl text-sm transition shadow-md shadow-[#0F766E]/10 hover:shadow-[#0F766E]/20 group cursor-pointer"
            >
              <span>Try Hero Patient Demo</span>
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition shrink-0" />
            </Link>
            <Link
              href="/cohort"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 font-semibold px-7 py-3.5 rounded-xl text-sm transition"
            >
              <span>Browse Cohort</span>
            </Link>
          </div>
        </div>

        {/* FEATURES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">

          <div className="bg-white dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-[#0F766E]">
                <span className="font-mono text-xs font-black">|--•--|</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-950 dark:text-white text-sm uppercase tracking-tight">
                  Multi-Clock Validation
                </h3>
                <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
                  Eliminate single-agent diagnostic bias. Simultaneously project patient DNA methylation samples against GrimAge, PhenoAge, Horvath, Hannum, Zhang, CausAge, and DunedinPACE.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-neutral-800 mt-4 pt-3 flex items-center text-[10px] font-mono text-[#0F766E] font-bold">
              <span>7 Clocks Indexed</span>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-[#0F766E]">
                <LineChart size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-950 dark:text-white text-sm uppercase tracking-tight">
                  Longitudinal Triangulation
                </h3>
                <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
                  Analyze biological age acceleration trajectories over 18-month spans. Observe rates of epigenetic drift, signal reversals, and evaluate clinical intervention efficacy.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-neutral-800 mt-4 pt-3 flex items-center text-[10px] font-mono text-[#0F766E] font-bold">
              <span>Bayesian Models</span>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 flex items-center justify-center text-[#0F766E]">
                <Brain size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-950 dark:text-white text-sm uppercase tracking-tight">
                  AI Clinical Interpretation
                </h3>
                <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
                  Generatively synthesized reports deconstruct biometric differences, highlight therapeutic mismatches (e.g. mTOR vs DunedinPACE pace), and formulate follow-ups.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-neutral-800 mt-4 pt-3 flex items-center text-[10px] font-mono text-[#0F766E] font-bold">
              <span>LLM Synthesis</span>
            </div>
          </div>
        </div>

        {/* DEMO BANNER */}
        <div className="bg-teal-50 dark:bg-teal-900/15 border border-teal-100 dark:border-teal-800/50 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center gap-1.5 justify-center md:justify-start">
              <CheckCircle2 size={16} className="text-[#0F766E]" />
              <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-[#0F766E]">Featured Clinical Case Study</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white font-sans">
              Patient 7341 Demographics & Trial Reversal
            </h3>
            <p className="text-xs text-slate-600 dark:text-neutral-400 max-w-xl leading-relaxed">
              Analyze a 52-year-old female showing slow bio-acceleration that undergoes extreme GrimAge reversal after beginning a Rapamycin 6mg/week therapeutic course, leaving DunedinPACE pace indicators unaffected.
            </p>
          </div>
          <Link
            href="/patient/hero"
            className="whitespace-nowrap inline-flex items-center gap-1 bg-[#0F766E] hover:bg-[#0D5F58] hover:scale-[1.02] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition shadow-sm cursor-pointer shrink-0"
          >
            <span>Open Case File</span>
            <ChevronRight size={13} />
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 py-10 text-xs text-slate-500 dark:text-neutral-500 font-mono text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="space-y-1 sm:text-left">
            <p className="font-extrabold text-slate-800 dark:text-neutral-200">Built for Caltech AI Longevity Hackathon 2026</p>
            <p className="text-[11px]">Team Members: Khush Patel (AI Clinical Architect) &amp; Team</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] uppercase font-extrabold tracking-wider">
            <span>FDA CFR Compliant Framework</span>
            <span>•</span>
            <span>HIPAA-Grade Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
