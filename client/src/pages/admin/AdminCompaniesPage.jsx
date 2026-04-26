import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import { formatDate } from '../../lib/format';

/**
 * Build query string for /api/admin/companies (search + optional flash message).
 */
function companiesApiQuery(searchParams) {
  const u = new URLSearchParams();
  const q = (searchParams.get('q') || '').trim();
  if (q) u.set('q', q);
  const message = (searchParams.get('message') || '').trim();
  if (message) u.set('message', message);
  const s = u.toString();
  return s ? `?${s}` : '';
}

/**
 * @param {{ embedded?: boolean }} props
 */
export default function AdminCompaniesPage({ embedded = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, companies: [] });
  const qFromUrl = searchParams.get('q') || '';
  const [qInput, setQInput] = useState(qFromUrl);

  const apiQuery = useMemo(() => companiesApiQuery(searchParams), [searchParams]);

  useEffect(() => {
    setQInput(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = qInput.trim();
      setSearchParams(
        (prev) => {
          const cur = (prev.get('q') || '').trim();
          if (trimmed === cur) return prev;
          const next = new URLSearchParams(prev);
          if (trimmed) next.set('q', trimmed);
          else next.delete('q');
          return next;
        },
        { replace: true }
      );
    }, 400);
    return () => clearTimeout(t);
  }, [qInput, setSearchParams]);

  const clearSearch = useCallback(() => {
    setQInput('');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchAdmin(`/companies${apiQuery}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, companies: [] });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, companies: [] });
        return;
      }
      setState({ loading: false, error: null, companies: result.data.companies || [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [apiQuery]);

  if (state.loading) return <LoadingState label="Loading organizations…" />;
  if (state.error) {
    return (
      <ErrorState title="Could not load organizations" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  const list = state.companies;
  const msg = (searchParams.get('message') || '').trim();
  const qActive = !!(searchParams.get('q') || '').trim();

  const columns = [
    {
      id: 'name',
      header: 'Organization',
      className: 'min-w-[12rem]',
      cell: (row) => {
        const initial = (row.name || '?').trim().slice(0, 1).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-[#00684a]"
              aria-hidden
            >
              {initial}
            </div>
            <Link to={`/admin/user-management/organizations/${row.id}`} className="font-medium text-[#00684a] hover:underline">
              {row.name}
            </Link>
          </div>
        );
      },
    },
    { id: 'users', header: 'Users', cell: (row) => <span className="tabular-nums text-slate-600">{row.user_count}</span> },
    { id: 'docs', header: 'Documents', cell: (row) => <span className="tabular-nums text-slate-600">{row.doc_count}</span> },
    ...(!embedded
      ? [
          {
            id: 'pending',
            header: 'Pending',
            cell: (row) => <span className="text-amber-800">{row.pending_doc_count}</span>,
          },
        ]
      : []),
    {
      id: 'created',
      header: 'Created',
      cell: (row) => <span className="text-slate-600 tabular-nums">{formatDate(row.created_at)}</span>,
    },
  ];

  const emptyMessage = qActive ? 'No organizations match your search.' : 'No organizations yet.';

  const table = (
    <DataTable
      columns={columns}
      rows={list}
      rowId={(r) => r.id}
      emptyMessage={emptyMessage}
    />
  );

  const searchRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="relative min-w-0 max-w-xl flex-1">
        <label htmlFor="orgs-search" className="sr-only">
          Search organizations
        </label>
        <input
          id="orgs-search"
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search"
          autoComplete="off"
          className="w-full border-0 border-b border-slate-300 bg-transparent py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-0"
        />
        <span className="pointer-events-none absolute bottom-2 right-0 text-slate-400" aria-hidden>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:pb-0.5">
        {embedded ? (
          <Link
            to="/admin/companies/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00523c]"
          >
            <span className="text-lg leading-none">+</span> Add organization
          </Link>
        ) : null}

        {qActive ? (
          <button
            type="button"
            onClick={clearSearch}
            className="text-xs font-medium text-slate-600 hover:text-[#00684a] sm:text-sm"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {searchRow}

        {msg ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{msg}</div>
        ) : null}

        {table}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title="Organizations" subtitle="Companies on the platform and high-level counts." />
        <Link
          to="/admin/companies/new"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#00684a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00523c]"
        >
          New organization
        </Link>
      </div>

      {searchRow}

      {msg ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{msg}</div>
      ) : null}

      {table}
    </div>
  );
}
