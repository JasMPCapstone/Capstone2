import { useEffect, useId } from 'react';

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Read-only modal for system-admin rejection notes (long text friendly).
 * @param {{ open: boolean, documentTitle?: string, reason: string, onClose: () => void }} props
 */
export default function RejectionReasonDialog({ open, documentTitle, reason, onClose }) {
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

  const text = (reason || '').toString().trim();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
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
      <div className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              Rejection reason
            </h2>
            {documentTitle ? (
              <p className="mt-1 truncate text-sm text-slate-600" title={documentTitle}>
                {documentTitle}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              Provided by a system administrator when this document was returned for correction.
            </p>
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {text ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
              {text}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No reason was recorded for this rejection.</p>
          )}
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

/** Compact trigger for tables — professional “document with lines” icon */
export function RejectionReasonIconButton({ onClick, label = 'View rejection reason' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
      title={label}
      aria-label={label}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M9 12h6M9 16h6M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
        <path d="M14 2v6h6M9 8h1M9 12h1" strokeLinecap="round" />
      </svg>
    </button>
  );
}
