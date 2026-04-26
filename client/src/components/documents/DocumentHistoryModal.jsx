import { useEffect, useId } from 'react';
import { formatHistoryActor, getDocumentHistoryPresentation } from '../../lib/documentHistoryLabels';
import { formatActivityDateTime } from '../../lib/format';

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {{ loading: boolean, error: string | null, events: Array<{ action: string, details: string | null, created_at: string, actor_name: string | null, actor_email: string | null, actor_role: string | null }> }} props
 */
function HistoryTimeline({ loading, error, events }) {
  if (loading) {
    return <p className="py-8 text-center text-xs text-slate-500">Loading activity…</p>;
  }
  if (error) {
    return <p className="py-8 text-center text-xs text-rose-600">{error}</p>;
  }
  if (!events.length) {
    return <p className="py-8 text-center text-xs text-slate-500">No recorded activity for this document yet.</p>;
  }
  return (
    <ul className="space-y-1 py-2 pr-1">
      {events.map((ev, i) => {
        const { label, badgeClass } = getDocumentHistoryPresentation(ev.action, ev.details);
        const who = formatHistoryActor(ev.actor_name, ev.actor_email, ev.actor_role);
        const isLast = i === events.length - 1;
        return (
          <li key={`${ev.created_at}-${i}`} className="flex gap-3">
            <div className="flex w-4 shrink-0 flex-col items-center pt-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-[#00684a] ring-2 ring-white" />
              {!isLast ? <span className="mt-1 w-px flex-1 min-h-[0.75rem] bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${badgeClass}`}>
                  {label}
                </span>
                <span className="text-[0.65rem] tabular-nums text-slate-500">{formatActivityDateTime(ev.created_at)}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-700">{who}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * @param {{ open: boolean, documentTitle?: string, loading: boolean, error: string | null, events: Array<object>, onClose: () => void }} props
 */
export default function DocumentHistoryModal({ open, documentTitle, loading, error, events, onClose }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.document.addEventListener('keydown', onKey);
    return () => window.document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(88vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              Document history
            </h2>
            {documentTitle ? (
              <p className="mt-1 truncate text-sm text-slate-600" title={documentTitle}>
                {documentTitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          <HistoryTimeline loading={loading} error={error} events={events} />
        </div>
        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00523c]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
