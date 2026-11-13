import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ExternalLink,
  FileText,
  GitBranch,
  IndianRupee,
  MapPin,
  Square,
} from 'lucide-react';
import { SourceBadge } from '../components/SourceBadge';
import { useScholarData } from '../hooks/useScholarData';
import { fetchScholarshipDetail } from '../services/api';
import { downloadCalendarICS, formatINR } from '../services/export';
import type { ScholarshipDetail } from '../types/scholarship';

export function ScholarshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    isBookmarked,
    toggleBookmark,
    checklists,
    toggleChecklistDoc,
    reminders,
    upsertReminder,
    removeReminder,
  } = useScholarData();

  const [detail, setDetail] = useState<ScholarshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderDate, setReminderDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [reminderNote, setReminderNote] = useState('Verify documents and check portal opening.');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchScholarshipDetail(id)
      .then((res) => {
        setDetail(res);
        if (res.deadline && /^\d{4}-\d{2}-\d{2}$/.test(res.deadline)) {
          setReminderDate(res.deadline);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load scholarship'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scholarship not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error || 'This scholarship record could not be loaded.'}</p>
        <Link to="/explore" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Explorer
        </Link>
      </div>
    );
  }

  const bookmarked = isBookmarked(detail.id);
  const checkedDocs = checklists[detail.id] || [];
  const totalDocs = detail.required_documents.length;
  const completedCount = detail.required_documents.filter((d) => checkedDocs.includes(d)).length;
  const progressPct = totalDocs > 0 ? Math.round((completedCount / totalDocs) * 100) : 0;
  const existingReminder = reminders.find((r) => r.scholarshipId === detail.id);

  const handleSaveReminder = (e: FormEvent) => {
    e.preventDefault();
    upsertReminder({
      scholarshipId: detail.id,
      scholarshipName: detail.name,
      reminderDate,
      note: reminderNote,
      officialUrl: detail.official_url,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        <button
          type="button"
          onClick={() => toggleBookmark(detail.id)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
            bookmarked
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
          <span>{bookmarked ? 'Bookmarked' : 'Bookmark Scheme'}</span>
        </button>
      </div>

      {/* Header Summary Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold capitalize text-blue-700 dark:text-blue-300">
            {detail.type}
          </span>
          <span className="rounded-md bg-violet-50 dark:bg-violet-950/60 px-2.5 py-1 text-xs font-semibold capitalize text-violet-700 dark:text-violet-300">
            {detail.basis}
          </span>
          <SourceBadge status={detail.source_status} lastVerified={detail.last_verified} />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
            {detail.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Provided by {detail.provider}
          </p>
        </div>

        {detail.description && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {detail.description}
          </p>
        )}

        {detail.source_status === 'sample' && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
            <strong>Sample data – verify on official site:</strong> Criteria, monetary amount, or closing dates may vary by academic cycle. Always confirm on the official portal below before applying.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> Amount / Benefit
            </p>
            <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
              {detail.amount || 'Not available'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Max Family Income
            </p>
            <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
              {formatINR(detail.max_family_income)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-violet-600" /> Deadline
            </p>
            <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
              {detail.deadline || 'Not available – check portal'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" /> States &amp; Categories
            </p>
            <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
              {detail.states.join(', ')} · {detail.categories.join(', ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Education Levels: </span>
            <strong className="text-slate-900 dark:text-white">{detail.education_level.join(', ')}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Courses: </span>
            <strong className="text-slate-900 dark:text-white">{detail.course.join(', ')}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Minimum Score: </span>
            <strong className="text-slate-900 dark:text-white">
              {detail.min_cgpa !== null
                ? `${detail.min_cgpa} CGPA`
                : detail.min_percentage !== null
                ? `${detail.min_percentage}%`
                : 'Not specified'}
            </strong>
          </div>
        </div>

        {detail.eligibility_notes && (
          <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 p-3.5 text-xs text-slate-700 dark:text-slate-200">
            <strong>Eligibility Notes: </strong>
            {detail.eligibility_notes}
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Last verified: {detail.last_verified || 'Not verified (sample record)'} · Final eligibility is decided by the provider.
          </span>
          <a
            href={detail.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <span>Open Official Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step-by-step Application Guide */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Step-by-Step Application Guide
          </h2>
          {detail.application_steps.length === 0 ? (
            <p className="text-sm text-slate-500">
              Information not available — refer to the official portal guidelines.
            </p>
          ) : (
            <ol className="space-y-3">
              {detail.application_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Interactive Application Document Checklist */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Application Document Checklist
            </h2>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {completedCount}/{totalDocs} Ready ({progressPct}%)
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {totalDocs === 0 ? (
            <p className="text-sm text-slate-500">No documents listed on file.</p>
          ) : (
            <div className="space-y-2">
              {detail.required_documents.map((doc) => {
                const isChecked = checkedDocs.includes(doc);
                return (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => toggleChecklistDoc(detail.id, doc)}
                    className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
                      isChecked
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 line-through'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{doc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Deadline Reminder UI + Knowledge Graph Relations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-indigo-600" />
            Deadline Reminder
          </h2>
          <form onSubmit={handleSaveReminder} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Reminder Date
                </label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="e.g. Upload income cert"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {existingReminder ? 'Update Reminder' : 'Save Reminder'}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadCalendarICS(detail.name, reminderDate, detail.official_url, reminderNote)
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                Export Calendar (.ics)
              </button>
              {existingReminder && (
                <button
                  type="button"
                  onClick={() => removeReminder(detail.id)}
                  className="text-xs font-semibold text-rose-600 hover:underline ml-auto"
                >
                  Remove
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <GitBranch className="w-5 h-5 text-violet-600" />
            Knowledge Graph Relations
          </h2>
          <div className="flex flex-wrap gap-2">
            {detail.knowledge_graph.edges.map((edge, idx) => (
              <div
                key={idx}
                className="inline-flex flex-wrap max-w-full items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 text-[11px] break-words"
              >
                <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                  {edge.relation}
                </span>
                <span className="text-slate-400">→</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {edge.target_id}
                </span>
              </div>
            ))}
          </div>

          {detail.related_documents.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Ingested Official PDFs ({detail.related_documents.length})
              </p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {detail.related_documents.map((doc) => (
                  <li key={doc.id}>
                    {doc.original_filename} ({doc.chunk_count} indexed chunks)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
