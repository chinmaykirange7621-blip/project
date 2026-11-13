import { ShieldCheck, Trash2, X, Lock } from 'lucide-react';
import { useScholarData } from '../hooks/useScholarData';

export function PrivacyModal() {
  const { privacyModalOpen, setPrivacyModalOpen, clearAllUserData } = useScholarData();

  if (!privacyModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/70 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="privacy-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Privacy &amp; Data Protection Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Built for Indian students with privacy-by-design
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(false)}
            aria-label="Close privacy dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700/60">
            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Minimum Non-Identifying Attributes Only
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              ScholarAI only asks for non-identifying eligibility attributes: education level, course, CGPA/percentage, annual family income range, domicile state, category, and gender.
            </p>
          </div>

          <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed">
            <li>
              <strong>Zero Sensitive Identifiers:</strong> Never enter Aadhaar numbers, PAN, bank account/IFSC details, passwords, or OTPs. Our backend automatically scrubs accidental PII before AI processing.
            </li>
            <li>
              <strong>No Student Database Profiling:</strong> We do not store personal student profiles on the server. Your chat history, bookmarks, checklists, and deadline reminders stay strictly in your browser&apos;s <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">localStorage</code>.
            </li>
            <li>
              <strong>API Key Isolation:</strong> Gemini API keys live strictly in backend <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">.env</code> and are never exposed in frontend code.
            </li>
            <li>
              <strong>Official Decisions:</strong> Final eligibility is always decided by the official scholarship provider.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              clearAllUserData();
              setPrivacyModalOpen(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear my data</span>
          </button>
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(false)}
            className="rounded-xl bg-slate-900 dark:bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
