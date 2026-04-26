import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isAfter, isValid, max as dfMax, min as dfMin, parse, startOfDay, startOfMonth } from 'date-fns';
import 'react-day-picker/style.css';

const ACCENT = '#00684a';
const ACCENT_BG = 'rgba(0, 104, 74, 0.14)';

function todayStart() {
  return startOfDay(new Date());
}

/** @param {Date} d */
function clampDateToToday(d) {
  const day = startOfDay(d);
  const cap = todayStart();
  return isAfter(day, cap) ? cap : d;
}

/** @param {Date} from @param {Date} to */
function clampRangeDates(from, to) {
  const a0 = dfMin([from, to]);
  const b0 = dfMax([from, to]);
  let a = clampDateToToday(a0);
  let b = clampDateToToday(b0);
  if (isAfter(a, b)) {
    b = a;
  }
  return { from: a, to: b };
}

/**
 * @param {object} props
 * @param {string} props.dateFrom - YYYY-MM-DD or ''
 * @param {string} props.dateTo - YYYY-MM-DD or ''
 * @param {(p: { dateFrom: string, dateTo: string }) => void} props.onApply
 * @param {string} [props.triggerId]
 */
export default function AuditPeriodRangePicker({ dateFrom, dateTo, onApply, triggerId }) {
  const dialogPanelId = useId();
  const dialogTitleId = useId();
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const [open, setOpen] = useState(false);
  /** @type {import('react-day-picker').DateRange | undefined} */
  const [draft, setDraft] = useState(undefined);
  const [manualEdit, setManualEdit] = useState(false);
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');

  const parseYmd = useCallback((s) => {
    if (!s || typeof s !== 'string') return undefined;
    const d = parse(s.trim(), 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : undefined;
  }, []);

  const maxYmd = format(todayStart(), 'yyyy-MM-dd');
  const endMonthCap = startOfMonth(new Date());

  const committedSummary = useMemo(() => {
    const from = parseYmd(dateFrom);
    const to = parseYmd(dateTo);
    if (!from && !to) return 'Select period';
    const start = from ?? to;
    const end = to ?? from;
    if (!start || !end) return 'Select period';
    const { from: a, to: b } = clampRangeDates(start, end);
    if (a.getTime() === b.getTime()) {
      return format(a, 'MMM d, yyyy');
    }
    return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}`;
  }, [dateFrom, dateTo, parseYmd]);

  const draftSummary = useMemo(() => {
    if (!draft?.from) return 'Select dates';
    const start = draft.from;
    const end = draft.to ?? draft.from;
    if (start.getTime() === end.getTime()) {
      return format(start, 'MMM d, yyyy');
    }
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }, [draft]);

  const defaultMonth = useMemo(() => {
    const d = draft?.from ?? draft?.to ?? parseYmd(dateFrom) ?? parseYmd(dateTo) ?? new Date();
    const cap = startOfMonth(new Date());
    if (isAfter(startOfMonth(d), cap)) return cap;
    return d;
  }, [draft, dateFrom, dateTo, parseYmd]);

  const disableAfterToday = useCallback((date) => isAfter(startOfDay(date), todayStart()), []);

  const onRangeSelect = useCallback(
    /** @param {import('react-day-picker').DateRange | undefined} r */
    (r) => {
      if (!r?.from) {
        setDraft(r);
        return;
      }
      const end = r.to;
      if (!end) {
        if (isAfter(startOfDay(r.from), todayStart())) {
          setDraft(undefined);
          return;
        }
        setDraft(r);
        return;
      }
      setDraft(clampRangeDates(r.from, end));
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (el && typeof el.focus === 'function') el.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleSave() {
    if (manualEdit) {
      const mf = parseYmd(manualFrom);
      const mt = parseYmd(manualTo);
      if (mf && mt) {
        const { from: a, to: b } = clampRangeDates(mf, mt);
        onApply({ dateFrom: format(a, 'yyyy-MM-dd'), dateTo: format(b, 'yyyy-MM-dd') });
      } else if (mf && !mt) {
        const c = clampDateToToday(mf);
        onApply({ dateFrom: format(c, 'yyyy-MM-dd'), dateTo: format(c, 'yyyy-MM-dd') });
      } else if (!mf && mt) {
        const c = clampDateToToday(mt);
        onApply({ dateFrom: format(c, 'yyyy-MM-dd'), dateTo: format(c, 'yyyy-MM-dd') });
      } else {
        onApply({ dateFrom: '', dateTo: '' });
      }
      close();
      return;
    }
    if (!draft?.from) {
      onApply({ dateFrom: '', dateTo: '' });
    } else {
      const { from: a, to: b } = clampRangeDates(draft.from, draft.to ?? draft.from);
      onApply({ dateFrom: format(a, 'yyyy-MM-dd'), dateTo: format(b, 'yyyy-MM-dd') });
    }
    close();
  }

  function toggleManual() {
    if (manualEdit) {
      const mf = parseYmd(manualFrom);
      const mt = parseYmd(manualTo);
      if (mf || mt) {
        if (mf && mt) {
          const { from: a, to: b } = clampRangeDates(mf, mt);
          setDraft({ from: a, to: b });
        } else {
          const c = clampDateToToday(mf ?? mt);
          setDraft({ from: c, to: c });
        }
      }
      setManualEdit(false);
      return;
    }
    if (draft?.from) {
      const end = draft.to ?? draft.from;
      const a = draft.from <= end ? draft.from : end;
      const b = draft.from <= end ? end : draft.from;
      setManualFrom(format(a, 'yyyy-MM-dd'));
      setManualTo(format(b, 'yyyy-MM-dd'));
    } else {
      setManualFrom(dateFrom || '');
      setManualTo(dateTo || '');
    }
    setManualEdit(true);
  }

  function openDialog() {
    const from = parseYmd(dateFrom);
    const to = parseYmd(dateTo);
    if (from || to) {
      const a = from ?? to;
      const b = to ?? from;
      if (a && b) {
        const clamped = clampRangeDates(a, b);
        setDraft({ from: clamped.from, to: clamped.to });
      } else {
        setDraft(undefined);
      }
    } else {
      setDraft(undefined);
    }
    setManualEdit(false);
    setManualFrom(dateFrom || '');
    setManualTo(dateTo || '');
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogPanelId : undefined}
        className="flex min-h-[2.75rem] w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-300 focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="min-w-0 flex-1 truncate">{committedSummary}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden />
          <div
            ref={dialogRef}
            id={dialogPanelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative flex max-h-[min(92vh,720px)] w-full max-w-[400px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="shrink-0 bg-[#00684a] px-4 pb-4 pt-3 text-white sm:px-5 sm:pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-2 -ml-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  Save
                </button>
              </div>
              <p id={dialogTitleId} className="sr-only">
                Choose activity log date range
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                Selected range
              </p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-xl font-medium leading-snug sm:text-2xl" aria-live="polite">
                  {manualEdit
                    ? manualFrom || manualTo
                      ? `${manualFrom || '…'} – ${manualTo || '…'}`
                      : 'Enter dates'
                    : draftSummary}
                </p>
                <button
                  type="button"
                  onClick={toggleManual}
                  className="shrink-0 rounded-lg p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label={manualEdit ? 'Use calendar' : 'Edit dates as text'}
                  title={manualEdit ? 'Calendar' : 'Type dates'}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 pt-2 sm:px-4">
              {manualEdit ? (
                <div className="space-y-3 px-2 py-3">
                  <div>
                    <label htmlFor="audit-manual-from" className="mb-1 block text-xs font-medium text-slate-600">
                      Start date
                    </label>
                    <input
                      id="audit-manual-from"
                      type="date"
                      max={maxYmd}
                      value={manualFrom}
                      onChange={(e) => setManualFrom(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                    />
                  </div>
                  <div>
                    <label htmlFor="audit-manual-to" className="mb-1 block text-xs font-medium text-slate-600">
                      End date
                    </label>
                    <input
                      id="audit-manual-to"
                      type="date"
                      max={maxYmd}
                      value={manualTo}
                      onChange={(e) => setManualTo(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="audit-rdp-root rdp-root mx-auto max-w-[360px]"
                  style={{
                    '--rdp-accent-color': ACCENT,
                    '--rdp-accent-background-color': ACCENT_BG,
                    '--rdp-today-color': '#0f172a',
                  }}
                >
                  <DayPicker
                    mode="range"
                    selected={draft}
                    onSelect={onRangeSelect}
                    defaultMonth={defaultMonth}
                    endMonth={endMonthCap}
                    numberOfMonths={6}
                    showOutsideDays={false}
                    fixedWeeks={false}
                    disabled={disableAfterToday}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
