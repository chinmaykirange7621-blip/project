import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { SourceBadge } from '../components/SourceBadge';
import { useScholarData } from '../hooks/useScholarData';
import { checkEligibility } from '../services/api';
import { exportToCSV, formatINR, printReportAsPDF } from '../services/export';
import type { EligibilityCheckResponse, EligibilityEvaluation, StudentProfile } from '../types/scholarship';

const INDIAN_STATES = [
  'Maharashtra', 'Uttar Pradesh', 'West Bengal', 'Karnataka', 'Tamil Nadu',
  'Delhi', 'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Kerala', 'Madhya Pradesh',
  'Odisha', 'Punjab', 'Rajasthan', 'Telangana', 'Uttarakhand',
];

export function EligibilityPage() {
  const { privacyAccepted, acceptPrivacy, savedProfile, setSavedProfile, clearAllUserData } = useScholarData();

  const [educationLevel, setEducationLevel] = useState(savedProfile.education_level || 'UG');
  const [course, setCourse] = useState(savedProfile.course || '');
  const [cgpa, setCgpa] = useState(savedProfile.cgpa !== undefined && savedProfile.cgpa !== null ? String(savedProfile.cgpa) : '');
  const [percentage, setPercentage] = useState(savedProfile.percentage !== undefined && savedProfile.percentage !== null ? String(savedProfile.percentage) : '');
  const [familyIncome, setFamilyIncome] = useState(savedProfile.family_income !== undefined && savedProfile.family_income !== null ? String(savedProfile.family_income) : '');
  const [state, setState] = useState(savedProfile.state || '');
  const [category, setCategory] = useState(savedProfile.category || '');
  const [gender, setGender] = useState(savedProfile.gender || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityCheckResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'eligible' | 'potentially_eligible' | 'not_eligible'>('eligible');

  const fillBtechSample = () => {
    setEducationLevel('UG');
    setCourse('B.Tech');
    setCgpa('8.5');
    setPercentage('');
    setFamilyIncome('250000');
    setState('Maharashtra');
    setCategory('General');
    setGender('Female');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const profile: StudentProfile = {
      education_level: educationLevel || null,
      course: course.trim() || null,
      cgpa: cgpa ? Number(cgpa) : null,
      percentage: percentage ? Number(percentage) : null,
      family_income: familyIncome ? Number(familyIncome) : null,
      state: state || null,
      category: category || null,
      gender: gender || null,
    };

    setSavedProfile(profile);

    try {
      const res = await checkEligibility(profile);
      setResult(res);
      if (res.eligible.length > 0) setActiveTab('eligible');
      else if (res.potentially_eligible.length > 0) setActiveTab('potentially_eligible');
      else setActiveTab('not_eligible');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eligibility check failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!result) return;
    const all = [...result.eligible, ...result.potentially_eligible, ...result.not_eligible];
    exportToCSV(
      'scholarai-eligibility-report.csv',
      ['Status', 'Scholarship', 'Provider', 'Source Status', 'Amount', 'Met Conditions', 'Missing / Unmet', 'Official URL'],
      all.map((ev) => [
        ev.status.toUpperCase(),
        ev.scholarship.name,
        ev.scholarship.provider,
        ev.scholarship.source_status,
        ev.scholarship.amount || 'Not available',
        ev.met_conditions.join(' | '),
        [...ev.missing_requirements, ...ev.unmet_conditions].join(' | '),
        ev.scholarship.official_url,
      ])
    );
  };

  const handleExportPDF = () => {
    if (!result) return;
    const renderList = (title: string, items: EligibilityEvaluation[]) => {
      if (items.length === 0) return '';
      return (
        `<h2>${title} (${items.length})</h2>` +
        items
          .map(
            (ev) => `
          <div class="card">
            <div><strong>${ev.scholarship.name}</strong> <span class="badge ${ev.scholarship.source_status}">${ev.scholarship.source_status === 'verified' ? 'Verified' : 'Sample data – verify on official site'}</span></div>
            <div class="meta">${ev.scholarship.provider} · Benefit: ${ev.scholarship.amount || 'Not available'}</div>
            ${ev.met_conditions.length ? `<div><strong>Met:</strong> ${ev.met_conditions.join('; ')}</div>` : ''}
            ${ev.missing_requirements.length ? `<div><strong>Needs Confirmation:</strong> ${ev.missing_requirements.join('; ')}</div>` : ''}
            ${ev.unmet_conditions.length ? `<div><strong>Unmet:</strong> ${ev.unmet_conditions.join('; ')}</div>` : ''}
          </div>`
          )
          .join('')
      );
    };

    const html =
      renderList('Eligible', result.eligible) +
      renderList('Potentially Eligible', result.potentially_eligible) +
      renderList('Not Eligible', result.not_eligible);

    printReportAsPDF(
      'ScholarAI Deterministic Eligibility Report',
      `Profile: ${result.profile.course || 'Any'} · ${result.profile.education_level || 'Any'} · Income: ${formatINR(result.profile.family_income)}`,
      html
    );
  };

  const renderEvaluationCard = (ev: EligibilityEvaluation) => {
    const s = ev.scholarship;
    return (
      <article
        key={s.id}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              to={`/scholarships/${s.id}`}
              className="text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
            >
              {s.name}
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {s.provider} · <span className="capitalize">{s.type}</span> / <span className="capitalize">{s.basis}</span>
            </p>
          </div>
          <SourceBadge status={s.source_status} lastVerified={s.last_verified} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Benefit: </span>
            <strong className="text-slate-900 dark:text-white">{s.amount || 'Not available'}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Income Cap: </span>
            <strong className="text-slate-900 dark:text-white">{formatINR(s.max_family_income)}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Deadline: </span>
            <strong className="text-slate-900 dark:text-white">{s.deadline || 'Not available'}</strong>
          </div>
        </div>

        {ev.met_conditions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Matched Conditions</p>
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {ev.met_conditions.map((c) => (
                <li key={c} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ev.missing_requirements.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Missing / Verification Required</p>
            <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
              {ev.missing_requirements.map((m) => (
                <li key={m} className="flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ev.unmet_conditions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Failed / Unmet Conditions</p>
            <ul className="space-y-1 text-xs text-rose-800 dark:text-rose-200">
              {ev.unmet_conditions.map((u) => (
                <li key={u} className="flex items-start gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ev.notes.length > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            Note: {ev.notes.join(' ')}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <a
            href={s.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600"
          >
            Official Website <ExternalLink className="w-3 h-3" />
          </a>
          <Link to={`/scholarships/${s.id}`} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Step-by-step guide &amp; Checklist →
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5" />
          100% Deterministic Rule Engine (No LLM)
        </span>
        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Eligibility Checker
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Verify exact matching conditions, missing requirements, and disqualification rules across all Indian schemes.
        </p>
      </div>

      {/* Privacy Notice First */}
      {!privacyAccepted ? (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm max-w-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Privacy &amp; Consent Notice
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Before entering your academic or family income criteria, please review how ScholarAI protects your privacy:
              </p>
              <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-5">
                <li>We collect <strong>only minimum, non-identifying eligibility attributes</strong> (education level, course, CGPA/percentage, annual family income, domicile state, category, gender).</li>
                <li><strong>Never enter</strong> your name, Aadhaar number, bank account details, passwords, or OTPs.</li>
                <li>Your eligibility evaluation runs deterministically on the backend without storing personal student records in the database.</li>
                <li>You can wipe all locally saved form inputs and history anytime using <strong>Clear my data</strong>.</li>
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={acceptPrivacy}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>I Understand &amp; Continue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Student Profile Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Non-Identifying Eligibility Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leave any field blank to see which schemes need confirmation.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fillBtechSample}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sample: B.Tech 8.5 CGPA, ₹2.5L</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAllUserData();
                    setCourse('');
                    setCgpa('');
                    setPercentage('');
                    setFamilyIncome('');
                    setState('');
                    setCategory('');
                    setGender('');
                    setResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear my data</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Education Level
                </label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">Any / Not specified</option>
                  <option value="UG">UG (Undergraduate)</option>
                  <option value="PG">PG (Postgraduate)</option>
                  <option value="Diploma">Diploma / Polytechnic</option>
                  <option value="Class 11-12">Class 11-12</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Course / Branch
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. B.Tech, CSE, AI&ML, B.Sc"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  CGPA (0 – 10 scale)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  placeholder="e.g. 8.5"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Class 12 / Prev. Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="e.g. 82.5"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Annual Family Income (₹ INR)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={familyIncome}
                  onChange={(e) => setFamilyIncome(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Domicile State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">Not specified</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">Not specified</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                  <option value="Minority">Minority</option>
                  <option value="PwD">PwD (Specially Abled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">Not specified</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Disclaimer: Final eligibility is decided by the provider.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {loading ? 'Evaluating Rules...' : 'Evaluate My Eligibility'}
              </button>
            </div>
          </form>

          {/* Grouped Results */}
          {result && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('eligible')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold border transition-colors ${
                      activeTab === 'eligible'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    Eligible ({result.summary.eligible_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('potentially_eligible')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold border transition-colors ${
                      activeTab === 'potentially_eligible'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    Potentially Eligible ({result.summary.potentially_eligible_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('not_eligible')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold border transition-colors ${
                      activeTab === 'not_eligible'
                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Not Eligible ({result.summary.not_eligible_count})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              </div>

              {result.missing_profile_fields.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Missing profile attributes (<strong>{result.missing_profile_fields.join(', ')}</strong>) caused some schemes to be classified as <strong>Potentially Eligible</strong> until confirmed.
                  </span>
                </div>
              )}

              <div className="space-y-4">
                {result[activeTab].length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                    No scholarships in the <strong>{activeTab.replace('_', ' ')}</strong> group for this profile.
                  </div>
                ) : (
                  result[activeTab].map(renderEvaluationCard)
                )}
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
                {result.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
