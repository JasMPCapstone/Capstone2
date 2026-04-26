import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import PaginationBar from '../../components/ui/PaginationBar';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AdminUserDirectoryCard from './AdminUserDirectoryCard';
import { roleLabel } from '../../lib/roles';

function postTo(url) {
  const f = document.createElement('form');
  f.method = 'post';
  f.action = url;
  document.body.appendChild(f);
  f.submit();
}

/**
 * @param {{ embedded?: boolean }} props
 */
export default function AdminUsersPage({ embedded = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [deleteModal, setDeleteModal] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [directoryRefresh, setDirectoryRefresh] = useState(0);
  const filterPanelRef = useRef(null);
  const nameFromUrl = searchParams.get('name') || '';
  const [nameInput, setNameInput] = useState(nameFromUrl);

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  /** Grouped directory ignores pagination. */
  const directoryQueryString = useMemo(() => {
    const p = new URLSearchParams(searchParams);
    p.delete('page');
    return p.toString();
  }, [searchParams]);

  useEffect(() => {
    setNameInput(nameFromUrl);
  }, [nameFromUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = nameInput.trim();
      setSearchParams(
        (prev) => {
          const cur = (prev.get('name') || '').trim();
          if (trimmed === cur) return prev;
          const next = new URLSearchParams(prev);
          if (trimmed) next.set('name', trimmed);
          else next.delete('name');
          next.delete('page');
          return next;
        },
        { replace: true }
      );
    }, 400);
    return () => clearTimeout(t);
  }, [nameInput, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const path = embedded
        ? `/users/grouped${directoryQueryString ? `?${directoryQueryString}` : ''}`
        : `/users${queryString ? `?${queryString}` : ''}`;
      const result = await fetchAdmin(path);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, data: null });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, data: null });
        return;
      }
      setState({ loading: false, error: null, data: result.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [embedded, directoryQueryString, queryString, directoryRefresh]);

  useEffect(() => {
    if (!embedded) return;
    function onProfileUpdated() {
      setDirectoryRefresh((n) => n + 1);
    }
    window.addEventListener('medsupply:profile-updated', onProfileUpdated);
    return () => window.removeEventListener('medsupply:profile-updated', onProfileUpdated);
  }, [embedded]);

  useEffect(() => {
    if (!deleteModal) return;
    function onKey(e) {
      if (e.key === 'Escape') setDeleteModal(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteModal]);

  useEffect(() => {
    if (!filterPanelOpen) return;
    function onDocClick(e) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) {
        setFilterPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [filterPanelOpen]);

  const clearFilters = useCallback(() => {
    setNameInput('');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('name');
        next.delete('companyId');
        next.delete('unassigned');
        next.delete('page');
        return next;
      },
      { replace: true }
    );
    setFilterPanelOpen(false);
  }, [setSearchParams]);

  if (state.loading) return <LoadingState label="Loading users…" />;
  if (state.error) {
    return <ErrorState title="Could not load users" message={state.error} onRetry={() => window.location.reload()} />;
  }

  const d = state.data;
  if (!d) return null;

  const msg = (searchParams.get('message') || d.message || '').trim();

  const companyOptions = d.companies || [];
  const users = d.users || [];
  const totalCount = d.usersTotalCount ?? users.length;
  const companyIdParam = (searchParams.get('companyId') || '').trim();
  const unassignedOnly = searchParams.get('unassigned') === '1';

  function setFilter(cId) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('unassigned');
      if (cId) next.set('companyId', cId);
      else next.delete('companyId');
      next.delete('page');
      return next;
    });
  }

  function clearOrgFilter() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('companyId');
        next.delete('unassigned');
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }

  function goPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    });
  }

  function requestDeactivate(row) {
    setStatusDialog({ action: 'deactivate', row });
  }

  function requestReactivate(row) {
    setStatusDialog({ action: 'reactivate', row });
  }

  const columnsClassic = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <Link to={`/admin/user-management/users/${row.id}`} className="font-medium text-[#00684a] hover:underline">
          {row.full_name}
        </Link>
      ),
    },
    { id: 'email', header: 'Email', cell: (row) => <span className="text-slate-600">{row.email}</span> },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <span className="text-slate-600">{roleLabel(row.role)}</span>,
    },
    {
      id: 'company',
      header: 'Organization',
      cell: (row) => <span className="text-slate-600">{row.company_name || '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.is_active ? (
          <button
            type="button"
            onClick={() => requestDeactivate(row)}
            className="font-medium text-emerald-800 hover:underline"
          >
            Active
          </button>
        ) : (
          <button
            type="button"
            onClick={() => requestReactivate(row)}
            className="font-medium text-rose-800 hover:underline"
          >
            Inactive
          </button>
        ),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-40',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link to={`/admin/users/${row.id}/reset-password`} className="text-xs font-medium text-[#00684a] hover:underline">
            Reset password
          </Link>
          <button
            type="button"
            onClick={() =>
              setDeleteModal({
                id: row.id,
                fullName: (row.full_name || row.email || 'User').trim(),
                isActive: !!row.is_active,
              })
            }
            className="text-xs font-medium text-rose-700 hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const columns = columnsClassic;

  const page = d.usersPage || 1;
  const totalPages = d.usersTotalPages || 1;
  const pageSize = d.usersPageSize || 10;

  const addFilterBadgeCount = (companyIdParam ? 1 : 0) + (unassignedOnly ? 1 : 0);

  const hasActiveFilters = !!(searchParams.get('name') || '').trim() || !!companyIdParam || unassignedOnly;

  const PREVIEW_LIMIT = 6;

  const directorySections =
    embedded && Array.isArray(d.groups) ? (
      <div className="space-y-10">
        {companyIdParam || unassignedOnly ? (
          <button
            type="button"
            onClick={clearOrgFilter}
            className="text-sm font-semibold text-[#00684a] hover:underline"
          >
            ← All organizations
          </button>
        ) : null}

        {!d.groups.length ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center text-sm text-slate-500">
            No users match this search.
          </p>
        ) : (
          d.groups.map((group) => {
            const isOrgFiltered = !!(companyIdParam || unassignedOnly);
            const all = group.users;
            const showViewAllTile = !isOrgFiltered && all.length > PREVIEW_LIMIT;
            const visible = showViewAllTile ? all.slice(0, PREVIEW_LIMIT) : all;
            const viewAllParams = new URLSearchParams();
            if (group.companyId != null) viewAllParams.set('companyId', String(group.companyId));
            else viewAllParams.set('unassigned', '1');
            const nameQ = (searchParams.get('name') || '').trim();
            if (nameQ) viewAllParams.set('name', nameQ);
            const viewAllSearch = viewAllParams.toString();
            const sectionKey = group.companyId != null ? `c-${group.companyId}` : 'none';
            const heading = (group.companyName || 'Organization').toUpperCase();

            return (
              <section key={sectionKey} aria-labelledby={`admin-org-${sectionKey}`}>
                <h2
                  id={`admin-org-${sectionKey}`}
                  className="mb-3 border-b border-slate-200/80 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-800"
                >
                  {heading}
                </h2>
                <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin] sm:snap-none">
                  {visible.map((u) => (
                    <div key={u.id} className="snap-start">
                      <AdminUserDirectoryCard user={u} />
                    </div>
                  ))}
                  {showViewAllTile ? (
                    <Link
                      to={{ pathname: '/admin/user-management/users', search: viewAllSearch ? `?${viewAllSearch}` : '' }}
                      className="flex min-w-[9.5rem] max-w-[10rem] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/90 bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 text-center transition-colors hover:border-[#00684a]/45 hover:from-[#00684a]/[0.07] hover:to-slate-50"
                    >
                      <span className="text-sm font-bold text-[#00684a]">View all</span>
                      <span className="mt-1 text-xs text-slate-500">{group.totalCount} people</span>
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })
        )}
      </div>
    ) : null;

  const table = (
    <DataTable
      columns={columns}
      rows={users}
      rowId={(r) => r.id}
      emptyMessage="No users match this filter."
    />
  );

  const pagination = (
    <PaginationBar
      currentPage={page}
      totalPages={totalPages}
      totalRows={totalCount}
      pageSize={pageSize}
      onPageChange={goPage}
    />
  );

  const searchAndFilterRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="relative min-w-0 max-w-xl flex-1">
        <label htmlFor="users-search" className="sr-only">
          Search users
        </label>
        <input
          id="users-search"
          type="search"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
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
        <div className="relative" ref={filterPanelRef}>
          <button
            type="button"
            onClick={() => setFilterPanelOpen((o) => !o)}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#00684a] transition-colors hover:text-[#005a40]"
            aria-expanded={filterPanelOpen}
            aria-controls="users-filter-panel"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" strokeLinejoin="round" />
            </svg>
            Add filter
            {addFilterBadgeCount > 0 ? (
              <span className="rounded-full bg-[#00684a] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {addFilterBadgeCount}
              </span>
            ) : null}
          </button>

          {filterPanelOpen ? (
            <div
              id="users-filter-panel"
              className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.1)]"
              role="region"
              aria-label="User filters"
            >
              <div>
                <label htmlFor="users-org-filter" className="mb-1 block text-xs font-semibold text-slate-700">
                  Organization
                </label>
                <select
                  id="users-org-filter"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                  value={unassignedOnly ? '' : companyIdParam}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">All organizations</option>
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-slate-600 hover:text-[#00684a] sm:text-sm"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );

  const statusDialogEl =
    statusDialog != null ? (
      <ConfirmDialog
        open
        title={statusDialog.action === 'deactivate' ? 'Deactivate user?' : 'Reactivate user?'}
        message={
          statusDialog.action === 'deactivate' ? (
            <>
              <span className="font-semibold text-slate-800">
                {(statusDialog.row.full_name || statusDialog.row.email || 'This user').trim()}
              </span>{' '}
              will no longer be able to sign in until an administrator reactivates their account.
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-800">
                {(statusDialog.row.full_name || statusDialog.row.email || 'This user').trim()}
              </span>{' '}
              will be able to sign in again with their existing credentials.
            </>
          )
        }
        confirmLabel={statusDialog.action === 'deactivate' ? 'Deactivate' : 'Reactivate'}
        cancelLabel="Cancel"
        tone={statusDialog.action === 'deactivate' ? 'amber' : 'emerald'}
        onCancel={() => setStatusDialog(null)}
        onConfirm={() => {
          const { action, row } = statusDialog;
          setStatusDialog(null);
          if (action === 'deactivate') postTo(`/admin/users/${row.id}/deactivate`);
          else postTo(`/admin/users/${row.id}/reactivate`);
        }}
      />
    ) : null;

  const deleteDialog =
    deleteModal != null ? (
      <ConfirmDialog
        open
        title="Remove user?"
        tone="rose"
        icon="trash"
        message={
          <>
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-slate-800">{deleteModal.fullName}</span>? This removes their account and
            associated documents. If you only need to block access, use <span className="font-medium text-slate-800">Deactivate only</span>{' '}
            below.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Delete permanently"
        middleAction={
          deleteModal.isActive
            ? {
                label: 'Deactivate only',
                onClick: () => {
                  const id = deleteModal.id;
                  setDeleteModal(null);
                  postTo(`/admin/users/${id}/deactivate`);
                },
              }
            : null
        }
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => {
          const id = deleteModal.id;
          setDeleteModal(null);
          postTo(`/admin/users/${id}/delete`);
        }}
      />
    ) : null;

  if (embedded) {
    return (
      <div className="space-y-4">
        {searchAndFilterRow}

        {msg ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{msg}</div>
        ) : null}

        {directorySections}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="All accounts. Filter by organization or manage individually." />

      {msg ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{msg}</div>
      ) : null}

      {searchAndFilterRow}

      {table}
      {pagination}
      {statusDialogEl}
      {deleteDialog}
    </div>
  );
}
