import { AlertTriangle, Sparkles } from 'lucide-react';
import { useScholarData } from '../hooks/useScholarData';

export function DemoBanner() {
  const { health, demoMode } = useScholarData();

  if (!health) {
    return null;
  }

  if (!demoMode) {
    return (
      <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-violet-600/10 border-b border-indigo-200/70 dark:border-indigo-900/60 px-4 py-1.5 text-xs text-indigo-900 dark:text-indigo-200">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            <strong>Live AI Active:</strong> Connected to Google Gemini ({health.chat_model}) &amp; {health.embedding_model} · {health.scholarships_indexed} schemes indexed
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/70 px-4 py-2 text-xs text-amber-950 dark:text-amber-200"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 text-center">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong>Demo Mode – no live LLM</strong> (<code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60">GEMINI_API_KEY</code> not configured). Running deterministic sample responses grounded in local ChromaDB &amp; eligibility rules.
        </span>
      </div>
    </div>
  );
}
