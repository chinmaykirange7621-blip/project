import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ScholarshipCard } from '../components/ScholarshipCard';
import { useScholarData } from '../hooks/useScholarData';
import { fetchScholarships, fetchStats } from '../services/api';
import type { Scholarship, StatsResponse } from '../types/scholarship';

export function LandingPage() {
  const navigate = useNavigate();
  const { setPrivacyModalOpen, clearAllUserData } = useScholarData();
  const [heroQuery, setHeroQuery] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [featured, setFeatured] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchStats().catch(() => null),
      fetchScholarships({ page: 1, page_size: 6, sort_by: 'verified' }).catch(() => null),
    ]).then(([statsRes, listRes]) => {
      if (statsRes) setStats(statsRes);
      if (listRes) setFeatured(listRes.items);
      setLoading(false);
    });
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = heroQuery.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  const handleAskAI = () => {
    const q = heroQuery.trim();
    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
  };

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.13),_transparent_60%),radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.12),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.22),_transparent_60%),radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.18),_transparent_55%)]"
        />

        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Your Future. Your Scholarship. One Intelligent Assistant.</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]"
          >
            Find the Right Scholarship.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Build Your Future.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            Grounded RAG AI discovery paired with 100% deterministic rule-based eligibility matching for Indian students across NSP, AICTE, State, University, and Foundation schemes.
          </motion.p>

          {/* Hero Search Bar */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-8 max-w-3xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-lg shadow-blue-950/5">
              <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Try: B.Tech student, 8.5 CGPA, family income below 3 lakh..."
                  aria-label="Search scholarships or ask ScholarAI"
                  className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleAskAI}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
                >
                  <Bot className="w-4 h-4" />
                  <span>Ask AI</span>
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Quick try:</span>
              {[
                'B.Tech 8.5 CGPA below 3 lakh',
                'AICTE Pragati girl student',
                'NSP required documents',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => navigate(`/chat?q=${encodeURIComponent(sample)}`)}
                  className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 px-3 py-1 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>
          </motion.form>

          {/* Stats Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-left">
            {[
              {
                label: 'Active Schemes',
                value: stats ? `${stats.total_scholarships}+` : '23+',
                sub: 'NSP, AICTE, State, Private & Univ.',
              },
              {
                label: 'Verified vs Sample',
                value: stats ? `${stats.verified_count} / ${stats.sample_count}` : '8 / 15',
                sub: 'Honest verification badges',
              },
              {
                label: 'Deterministic Rules',
                value: '100%',
                sub: 'Zero LLM guesswork on eligibility',
              },
              {
                label: 'PII Collected',
                value: '0%',
                sub: 'No Aadhaar, bank, or OTP needed',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-xs"
              >
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{item.value}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Scholarships */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Featured Indian Scholarships
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Verified statutory programs and clearly labeled sample schemes ready for exploration.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Explore all schemes</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-5"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="py-14 px-4 sm:px-6 bg-white dark:bg-slate-900/40 border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              How ScholarAI Works
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A transparent, rational agent pipeline designed specifically for Indian college and engineering admissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: Bot,
                title: 'Ask Naturally or Check Profile',
                desc: 'Chat in plain English ("B.Tech, 8.5 CGPA, income below 3 lakh") or use our structured Eligibility Checker with zero personal identifiers.',
              },
              {
                step: '02',
                icon: Cpu,
                title: 'Hybrid RAG + Deterministic Rules',
                desc: 'ChromaDB semantic retrieval + SQLite keyword matching locate relevant schemes while our deterministic rule engine verifies exact cutoffs.',
              },
              {
                step: '03',
                icon: FileCheck2,
                title: 'Cited Guidance & Checklists',
                desc: 'Receive cited answers with official portal URLs, verification badges, expandable AI reasoning traces, document checklists, and .ics reminders.',
              },
            ].map((card) => (
              <div
                key={card.step}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <card.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-400">{card.step}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Technology & Knowledge Architecture */}
      <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Explainable AI Architecture
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Built on Grounded Retrieval &amp; Transparent Rule Logic
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Unlike generic chatbots that hallucinate deadlines or eligibility rules, ScholarAI separates <strong>language synthesis</strong> from <strong>deterministic eligibility evaluation</strong> and grounds every citation in persisted ChromaDB + SQLite records.
            </p>
            <div className="mt-6 space-y-3">
              {[
                'Rational Agent Loop: Perceive → Intent → Extract → Retrieve → Evaluate → Reason → Explain',
                'Google Gemini SDK (Interactions API) with clean DemoProvider fallback when offline',
                'Knowledge-graph-ready schema linking Scholarships, Organizations, Courses, States & Documents',
                'Admin PDF circular ingestion automatically chunks & indexes official guidelines into ChromaDB',
              ].map((point) => (
                <div key={point} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
              >
                <span>Open AI Assistant</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/eligibility"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span>Check Eligibility</span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Knowledge-Graph-Ready Entities
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  SQLite + PostgreSQL compatible relational triples
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                'Student → STUDIES → Course',
                'Student → BELONGS_TO → State',
                'Scholarship → PROVIDED_BY → Org',
                'Scholarship → REQUIRES → Document',
                'Scholarship → MIN_SCORE → Cutoff',
                'Scholarship → SUPPORTS → Level',
              ].map((rel) => (
                <div
                  key={rel}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                >
                  {rel}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy-First Guarantee */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-blue-950/30 p-6 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy-First Architecture</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                Your Academic Journey — Zero Sensitive PII Collected
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ScholarAI never asks for Aadhaar numbers, PAN, bank account numbers, passwords, or OTPs. Only non-identifying eligibility attributes are evaluated, accidental identifiers are automatically redacted, and you can wipe all local browser history with one click.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Read Privacy Policy</span>
              </button>
              <button
                type="button"
                onClick={clearAllUserData}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear my data</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
