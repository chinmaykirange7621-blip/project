import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bookmark, CalendarPlus, ExternalLink, Trash2, X } from 'lucide-react';
import { useScholarData } from '../hooks/useScholarData';
import { fetchScholarships } from '../services/api';
import { downloadCalendarICS } from '../services/export';
import type { Scholarship } from '../types/scholarship';

export function BookmarksDrawer() {
  const {
    bookmarksDrawerOpen,
    setBookmarksDrawerOpen,
    bookmarks,
    toggleBookmark,
    reminders,
    removeReminder,
  } = useScholarData();
  const [allItems, setAllItems] = useState<Scholarship[]>([]);

  useEffect(() => {
    if (bookmarksDrawerOpen && bookmarks.length > 0) {
      fetchScholarships({ page_size: 100 })
        .then((res) => setAllItems(res.items))
        .catch(() => {});
    }
  }, [bookmarksDrawerOpen, bookmarks.length]);

  if (!bookmarksDrawerOpen) return null;

  const bookmarkedScholarships = allItems.filter((s) => bookmarks.includes(s.id));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Saved bookmarks and deadline reminders"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-5 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-600" />
              Saved &amp; Reminders
            </h2>
            <button
              type="button"
              onClick={() => setBookmarksDrawerOpen(false)}
              aria-label="Close saved drawer"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-indigo-500" />
              Deadline Reminders ({reminders.length})
            </h3>
            {reminders.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3">
                No reminders set yet. Click the bell icon on any scholarship card or detail page to track deadlines.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {reminders.map((rem) => (
                  <div
                    key={rem.scholarshipId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/scholarships/${rem.scholarshipId}`}
                        onClick={() => setBookmarksDrawerOpen(false)}
                        className="text-xs font-semibold text-slate-900 dark:text-white hover:text-blue-600"
                      >
                        {rem.scholarshipName}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeReminder(rem.scholarshipId)}
                        aria-label="Delete reminder"
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                      Reminder date: {rem.reminderDate}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCalendarICS(
                            rem.scholarshipName,
                            rem.reminderDate,
                            rem.officialUrl,
                            rem.note
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        Download .ics
                      </button>
                      <a
                        href={rem.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              Bookmarked Scholarships ({bookmarks.length})
            </h3>
            {bookmarks.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3">
                No scholarships bookmarked yet. Save scholarships in the Explorer to compare and review them later.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {(bookmarkedScholarships.length > 0
                  ? bookmarkedScholarships
                  : bookmarks.map((id) => ({ id, name: id, provider: 'Saved item' } as Scholarship))
                ).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/scholarships/${item.id}`}
                        onClick={() => setBookmarksDrawerOpen(false)}
                        className="block truncate text-xs font-semibold text-slate-900 dark:text-white hover:text-blue-600"
                      >
                        {item.name}
                      </Link>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {item.provider}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(item.id)}
                      aria-label="Remove bookmark"
                      className="text-slate-400 hover:text-rose-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <p className="mt-6 text-[11px] text-slate-400 dark:text-slate-500">
          Stored privately in your browser only. Use &quot;Clear my data&quot; anytime to reset.
        </p>
      </div>
    </div>
  );
}
