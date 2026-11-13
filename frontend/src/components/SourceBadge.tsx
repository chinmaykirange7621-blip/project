import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { SourceStatus } from '../types/scholarship';

export function SourceBadge({
  status,
  lastVerified,
  compact = false,
}: {
  status: SourceStatus;
  lastVerified?: string | null;
  compact?: boolean;
}) {
  if (status === 'verified') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
        title={lastVerified ? `Verified on ${lastVerified}` : 'Verified scheme'}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Verified' : `Verified${lastVerified ? ` · ${lastVerified}` : ''}`}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
      title="Sample data – verify on official site"
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>Sample data – verify on official site</span>
    </span>
  );
}
