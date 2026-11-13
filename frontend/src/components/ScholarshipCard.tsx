import { Link } from 'react-router-dom';
import { Bell, Bookmark, Calendar, ExternalLink, IndianRupee, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useScholarData } from '../hooks/useScholarData';
import { formatINR } from '../services/export';
import type { Scholarship } from '../types/scholarship';
import { SourceBadge } from './SourceBadge';

export function ScholarshipCard({
  scholarship,
  matchedReasons,
}: {
  scholarship: Scholarship;
  matchedReasons?: string[];
}) {
  const { isBookmarked, toggleBookmark, reminders, upsertReminder, removeReminder } = useScholarData();
  const bookmarked = isBookmarked(scholarship.id);
  const hasReminder = reminders.some((r) => r.scholarshipId === scholarship.id);

  const handleQuickReminder = () => {
    if (hasReminder) {
      removeReminder(scholarship.id);
      return;
    }
    const defaultDate = scholarship.deadline && /^\d{4}-\d{2}-\d{2}$/.test(scholarship.deadline)
      ? scholarship.deadline
      : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    upsertReminder({
      scholarshipId: scholarship.id,
      scholarshipName: scholarship.name,
      reminderDate: defaultDate,
      note: 'Check required documents and portal opening status.',
      officialUrl: scholarship.official_url,
    });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm hover:shadow-md hover:border-blue-300/80 dark:hover:border-blue-700/70 transition-all"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-xs font-semibold capitalize text-blue-700 dark:text-blue-300">
              {scholarship.type}
            </span>
            <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 text-xs font-semibold capitalize text-violet-700 dark:text-violet-300">
              {scholarship.basis}
            </span>
            <SourceBadge status={scholarship.source_status} lastVerified={scholarship.last_verified} compact />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleQuickReminder}
              aria-label={hasReminder ? 'Remove deadline reminder' : 'Set deadline reminder'}
              title={hasReminder ? 'Remove reminder' : 'Set reminder'}
              className={`p-1.5 rounded-lg border transition-colors ${
                hasReminder
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleBookmark(scholarship.id)}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark scholarship'}
              title={bookmarked ? 'Bookmarked' : 'Save bookmark'}
              className={`p-1.5 rounded-lg border transition-colors ${
                bookmarked
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        <Link
          to={`/scholarships/${scholarship.id}`}
          className="block text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug"
        >
          {scholarship.name}
        </Link>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {scholarship.provider}
        </p>

        {scholarship.description && (
          <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
            {scholarship.description}
          </p>
        )}

        <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <IndianRupee className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong className="text-slate-800 dark:text-slate-200">Benefit:</strong>{' '}
              {scholarship.amount || 'Not available'}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong className="text-slate-800 dark:text-slate-200">Income Cap:</strong>{' '}
              {formatINR(scholarship.max_family_income)} · {scholarship.states.join(', ')}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 mt-0.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span>
              <strong className="text-slate-800 dark:text-slate-200">Deadline:</strong>{' '}
              {scholarship.deadline || 'Not available – check official portal'}
            </span>
          </div>
        </div>

        {matchedReasons && matchedReasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {matchedReasons.slice(0, 2).map((reason) => (
              <span
                key={reason}
                className="text-[11px] rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-600 dark:text-slate-300"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <a
          href={scholarship.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <span>Official Portal</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <Link
          to={`/scholarships/${scholarship.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.article>
  );
}
