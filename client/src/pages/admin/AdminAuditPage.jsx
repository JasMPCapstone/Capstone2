import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import AuditEventCell from '../../components/admin/AuditEventCell';
import AuditPeriodRangePicker from '../../components/admin/AuditPeriodRangePicker';
import { formatActivityDateTime } from '../../lib/format';
import { describeAuditAction } from '../../lib/auditLabels';

function orgDotClass(companyId) {
  if (companyId == null || companyId === '') return 'bg-slate-300';
  const n = Number(companyId);
  const pallet = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-600', 'bg-violet-500'];
  return pallet[Math.abs(n) % pallet.length];
}

function escCsv(val) {
  const s = val == null ? '' : String(val);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadAuditCsv(logs) {
  const header = ['Date and time', 'Organization', 'Employee', 'Email', 'Event code', 'Event label', 'Details', 'IP address'];
  const lines = [
    header.join(','),
    ...logs.map((r) => {
      const { label } = describeAuditAction(r.action);
      return [
        escCsv(r.created_at),
        escCsv(r.company_name || ''),
        escCsv(r.full_name || ''),
        escCsv(r.email || ''),
        escCsv(r.action || ''),
        escCsv(label),
        escCsv(r.details || ''),
        escCsv(r.ip_address || ''),
      ].join(',');
    }),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `activity-report-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortChevron() {
  return (
    <svg className="ml-0.5 inline h-3.5 w-3.5 opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 15.5l-5-5h10l-5 5z" />
    </svg>
  );
}

/**
 * @typedef {{ id: number, name: string }} CompanyOpt
 * @typedef {{ id: number, full_name: string | null, email: string | null, company_id: number | null }} UserOpt
 * @typedef {{ value: string, label: string }} EventOpt
 */

export default function AdminAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState(
    /** @type {{ companies: CompanyOpt[], users: UserOpt[], events: EventOpt[] } | null} */ (null)
  );
  const [metaError, setMetaError] = useState(/** @type {string | null} */ (null));
  const [state, setState] = useState({ loading: true, error: null, logs: [] });
  const companyFromUrl = searchParams.get('companyId') || '';

  const qs = searchParams.toString();

  const patchSearchParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, val]) => {
            if (val === '' || val == null) next.delete(key);
            else next.set(key, String(val));
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  /** Activity log only filters through today; normalize bookmarked URLs with future dates. */
  useEffect(() => {
    const cap = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const df = searchParams.get('dateFrom') || '';
    const dt = searchParams.get('dateTo') || '';
    if (!df && !dt) return;
    let ndf = df;
    let ndt = dt;
    if (df && df > cap) ndf = cap;
    if (dt && dt > cap) ndt = cap;
    if (ndf && ndt && ndf > ndt) ndt = ndf;
    if (ndf !== df || ndt !== dt) {
      patchSearchParams({ dateFrom: ndf, dateTo: ndt });
    }
  }, [searchParams, patchSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetaError(null);
      const result = await fetchAdmin('/audit/meta');
      if (cancelled) return;
      if (result.kind === 'error') {
        setMetaError(result.error);
        setMeta(null);
        return;
      }
      if (result.kind !== 'ok' || !result.data) {
        setMeta(null);
        return;
      }
      setMeta({
        companies: result.data.companies || [],
        users: result.data.users || [],
        events: result.data.events || [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchAdmin(`/audit${qs ? `?${qs}` : ''}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, logs: [] });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, logs: [] });
        return;
      }
      setState({ loading: false, error: null, logs: result.data.logs || [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const userOptions = useMemo(() => {
    if (!meta?.users) return [];
    if (!companyFromUrl) return meta.users;
    const n = parseInt(companyFromUrl, 10);
    if (Number.isNaN(n) || n <= 0) return meta.users;
    return meta.users.filter((u) => u.company_id === n);
  }, [meta, companyFromUrl]);

  const userIdInUrl = searchParams.get('userId') || '';
  useEffect(() => {
    if (!meta || !userIdInUrl) return;
    const ok = userOptions.some((u) => String(u.id) === userIdInUrl);
    if (!ok) patchSearchParams({ userId: '' });
  }, [meta, userIdInUrl, userOptions, patchSearchParams]);

  const hasFilters = useMemo(() => {
    return !!(
      searchParams.get('event') ||
      searchParams.get('userId') ||
      searchParams.get('companyId') ||
      searchParams.get('dateFrom') ||
      searchParams.get('dateTo')
    );
  }, [searchParams]);

  function onOrganizationChange(e) {
    const v = e.target.value;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set('companyId', v);
        else next.delete('companyId');
        const uid = next.get('userId');
        if (v && uid && meta?.users) {
          const cid = parseInt(v, 10);
          const user = meta.users.find((u) => String(u.id) === uid);
          if (user && user.company_id !== cid) next.delete('userId');
        }
        return next;
      },
      { replace: true }
    );
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  if (state.error) {
    return (
      <ErrorState title="Could not load activity log" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  const columns = [
    {
      id: 'when',
      header: (
        <span className="inline-flex items-center normal-case tracking-normal">
          Date and time
          <SortChevron />
        </span>
      ),
      headerClassName: 'bg-slate-100/90 text-slate-600',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="tabular-nums text-slate-800" title={row.created_at ? String(row.created_at) : ''}>
          {formatActivityDateTime(row.created_at)}
        </span>
      ),
    },
    {
      id: 'org',
      header: 'Organization',
      className: 'min-w-[8rem] max-w-[11rem]',
      cell: (row) => {
        const name = row.company_name;
        if (!name) {
          return <span className="text-slate-400">—</span>;
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${orgDotClass(row.company_id)}`}
              aria-hidden
            />
            <span className="truncate text-slate-800" title={name}>
              {name}
            </span>
          </div>
        );
      },
    },
    {
      id: 'user',
      header: 'Employee',
      className: 'min-w-[9rem] max-w-[12rem]',
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">
            {row.full_name || row.email || (row.user_id ? `User #${row.user_id}` : '—')}
          </div>
          {row.email && row.full_name ? <div className="truncate text-xs text-slate-500">{row.email}</div> : null}
        </div>
      ),
    },
    {
      id: 'details',
      header: 'Details',
      className: 'max-w-xs min-w-[10rem]',
      cell: (row) => {
        const text = row.details || '—';
        return (
          <span className="line-clamp-2 break-words text-sm text-slate-600" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      id: 'event',
      header: 'Event',
      className: 'min-w-[12rem]',
      cell: (row) => <AuditEventCell action={row.action} />,
    },
    {
      id: 'extra',
      header: 'Additional',
      className: 'min-w-[8rem] max-w-[14rem]',
      cell: (row) => {
        const code = (row.action || '').trim();
        if (code === 'LOGIN_SUCCESS' || code === 'LOGIN_FAILURE') {
          return <span className="font-mono text-xs text-slate-600">{row.ip_address || '—'}</span>;
        }
        return <span className="text-xs text-slate-500">{row.ip_address ? `IP: ${row.ip_address}` : '—'}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" subtitle="List of all events across organizations and accounts." />

      {metaError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Filters could not be loaded ({metaError}). You can still browse the log; refresh the page to retry.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
            <div className="min-w-[min(100%,17rem)] flex-1 basis-[17rem]">
              <label htmlFor="audit-period-trigger" className="mb-1 block text-xs font-medium text-slate-600">
                Period
              </label>
              <AuditPeriodRangePicker
                triggerId="audit-period-trigger"
                dateFrom={searchParams.get('dateFrom') || ''}
                dateTo={searchParams.get('dateTo') || ''}
                onApply={({ dateFrom: df, dateTo: dt }) => patchSearchParams({ dateFrom: df, dateTo: dt })}
              />
            </div>

            <div className="w-full min-w-[10rem] sm:w-[11.5rem] sm:flex-initial">
              <label htmlFor="audit-companyId" className="mb-1 block text-xs font-medium text-slate-600">
                Organization
              </label>
              <select
                id="audit-companyId"
                value={companyFromUrl}
                onChange={onOrganizationChange}
                disabled={!meta}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a] disabled:opacity-60"
              >
                <option value="">All organizations</option>
                {(meta?.companies || []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full min-w-[10rem] sm:w-[11.5rem] sm:flex-initial">
              <label htmlFor="audit-userId" className="mb-1 block text-xs font-medium text-slate-600">
                Employee
              </label>
              <select
                id="audit-userId"
                value={searchParams.get('userId') || ''}
                onChange={(e) => patchSearchParams({ userId: e.target.value })}
                disabled={!meta}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a] disabled:opacity-60"
              >
                <option value="">All employees</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {(u.full_name || u.email || `User #${u.id}`) + (u.email && u.full_name ? ` (${u.email})` : '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full min-w-[10rem] sm:w-[11.5rem] sm:flex-initial">
              <label htmlFor="audit-event" className="mb-1 block text-xs font-medium text-slate-600">
                Events
              </label>
              <select
                id="audit-event"
                value={searchParams.get('event') || ''}
                onChange={(e) => patchSearchParams({ event: e.target.value })}
                disabled={!meta}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a] disabled:opacity-60"
              >
                <option value="">All events</option>
                {(meta?.events || []).map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 min-[1100px]:ml-auto min-[1100px]:w-auto min-[1100px]:justify-end min-[1100px]:border-l min-[1100px]:border-slate-200 min-[1100px]:pl-4">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => downloadAuditCsv(state.logs)}
                disabled={state.loading || state.logs.length === 0}
                className="rounded-lg bg-[#00684a] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00523c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create report
              </button>
            </div>
          </div>
        </div>
      </div>

      {state.loading ? (
        <LoadingState label="Loading activity…" />
      ) : (
        <DataTable
          columns={columns}
          rows={state.logs}
          rowId={(r) => r.id}
          emptyMessage="No activity matches these filters."
        />
      )}
    </div>
  );
}
