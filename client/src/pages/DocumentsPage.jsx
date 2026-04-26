import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchDocuments } from '../lib/api';
import { formatDate } from '../lib/format';
import { isClientAdmin, isSystemAdmin } from '../lib/roles';
import DataTable from '../components/ui/DataTable';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import DocumentStatusBadge from '../components/ui/DocumentStatusBadge';
import DocumentTableActions from '../components/documents/DocumentTableActions';
import PaginationBar from '../components/ui/PaginationBar';
import DocumentPreviewModal from '../components/DocumentPreviewModal';

function canManageDocument(row, user) {
  if (!user) return false;
  if (isSystemAdmin(user.role)) return true;
  if (Number(row.user_id) === Number(user.userId)) return true;
  if (
    isClientAdmin(user.role) &&
    user.companyId != null &&
    row.owner_company_id != null &&
    Number(row.owner_company_id) === Number(user.companyId)
  ) {
    return true;
  }
  return false;
}

function buildFetchQuery(searchParams) {
  const u = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (value === '' || value == null) return;
    if (key === 'tab' && value === 'all') return;
    u.append(key, value);
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const admin = user && isSystemAdmin(user.role);

  const queryString = useMemo(() => buildFetchQuery(searchParams), [searchParams]);

  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [qInput, setQInput] = useState(() => searchParams.get('q') || '');

  useEffect(() => {
    setQInput(searchParams.get('q') || '');
  }, [searchParams]);

  /** Remove date filters from URL (no longer exposed in UI). */
  useEffect(() => {
    setSearchParams((prev) => {
      if (!prev.get('dateFrom') && !prev.get('dateTo')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('dateFrom');
      next.delete('dateTo');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = qInput.trim();
      setSearchParams((prev) => {
        const current = (prev.get('q') || '').trim();
        if (trimmed === current) return prev;
        const next = new URLSearchParams(prev);
        if (trimmed) next.set('q', trimmed);
        else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 380);
    return () => clearTimeout(t);
  }, [qInput, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchDocuments(queryString);
      if (cancelled) return;
      if (result.kind === 'redirect' || result.kind === 'unauthorized') {
        setState({ loading: false, error: null, payload: null });
        return;
      }
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, payload: null });
        return;
      }
      setState({ loading: false, error: null, payload: result.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString, user?.userId]);

  const docs = state.payload?.documents || [];
  const totalRows = state.payload?.total ?? 0;
  const currentPage = state.payload?.page ?? 1;
  const pageSize = state.payload?.pageSize ?? 10;
  const totalPages = state.payload?.totalPages ?? 1;
  const hasApproval = !!state.payload?.hasApprovalStatus;
  const hasDocType = state.payload?.hasDocumentType !== false;
  const activeTab = state.payload?.activeTab || 'all';
  const companies = state.payload?.companiesForFilter || [];
  const tagOptions = state.payload?.tagOptions || [];
  const documentTypes = state.payload?.documentTypes || [];

  const selectedTags = searchParams.getAll('tags');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef(null);
  const [preview, setPreview] = useState(null);

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

  const addFilterBadgeCount = useMemo(() => {
    let n = 0;
    if (searchParams.get('documentType')) n += 1;
    if (searchParams.get('companyId')) n += 1;
    if (selectedTags.length > 0) n += 1;
    return n;
  }, [searchParams, selectedTags.length]);

  const setTab = useCallback(
    (tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        if (tab === 'all') next.delete('tab');
        else next.set('tab', tab);
        return next;
      });
    },
    [setSearchParams]
  );

  const setCompanyId = useCallback(
    (cid) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        if (!cid) next.delete('companyId');
        else next.set('companyId', cid);
        return next;
      });
    },
    [setSearchParams]
  );

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        if (!value) next.delete(key);
        else next.set(key, value);
        return next;
      });
    },
    [setSearchParams]
  );

  const toggleTag = useCallback(
    (slug) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        const all = prev.getAll('tags');
        next.delete('tags');
        const lower = slug.toLowerCase();
        const exists = all.map((x) => x.toLowerCase()).includes(lower);
        all.forEach((t) => {
          if (t.toLowerCase() !== lower) next.append('tags', t);
        });
        if (!exists) next.append('tags', lower);
        return next;
      });
    },
    [setSearchParams]
  );

  const setPage = useCallback(
    (nextPage) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextPage <= 1) next.delete('page');
        else next.set('page', String(nextPage));
        return next;
      });
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const tab = prev.get('tab');
      if (tab && tab !== 'all') next.set('tab', tab);
      return next;
    });
    setQInput('');
    setFilterPanelOpen(false);
  }, [setSearchParams]);

  const columns = useMemo(() => {
    const cols = [
      {
        id: 'doc',
        header: 'Document',
        className: 'min-w-[10rem] max-w-xs',
        cell: (row) => (
          <div>
            <span className="text-[11px] font-medium tabular-nums text-slate-400">#{row.id}</span>
            <Link
              to={`/documents/${row.id}`}
              className="mt-0.5 block w-full truncate text-left font-medium text-[#00684a] hover:underline"
              aria-label={`Open documentation: ${(row.title || row.original_filename || 'document').toString()}`}
            >
              {(row.title || row.original_filename || 'Untitled').toString()}
            </Link>
          </div>
        ),
      },
      {
        id: 'uploaded',
        header: 'Uploaded',
        className: 'whitespace-nowrap',
        cell: (row) => <span className="text-slate-600 tabular-nums">{formatDate(row.created_at)}</span>,
      },
    ];
    if (hasDocType) {
      cols.push({
        id: 'type',
        header: 'Type',
        className: 'max-w-[11rem]',
        cell: (row) => (
          <span className="line-clamp-2 text-slate-700" title={(row.document_type || '').toString()}>
            {(row.document_type || '—').toString()}
          </span>
        ),
      });
    }
    cols.push({
      id: 'org',
      header: 'Organization',
      className: 'max-w-[10rem]',
      cell: (row) => <span className="text-slate-600">{(row.company_name || '—').toString()}</span>,
    });
    if (hasApproval) {
      cols.push({
        id: 'status',
        header: 'Status',
        className: 'whitespace-nowrap',
        cell: (row) => <DocumentStatusBadge status={row.approval_status} />,
      });
    }
    const showResponsibleColumn = user && (isSystemAdmin(user.role) || isClientAdmin(user.role));
    if (showResponsibleColumn) {
      cols.push({
        id: 'owner',
        header: 'Responsible',
        className: 'max-w-[9rem]',
        cell: (row) => <span className="text-slate-700">{(row.owner_name || '—').toString()}</span>,
      });
    }
    cols.push({
      id: 'actions',
      header: 'Actions',
      className: 'w-[1%] text-right',
      cell: (row) => {
        const can = canManageDocument(row, user);
        return (
          <DocumentTableActions
            id={row.id}
            showEdit={can}
            showDelete={can}
            onPreview={() =>
              setPreview({
                id: row.id,
                title: (row.title || row.original_filename || 'Document').toString(),
                fileType: row.file_type,
                fileExtension: row.file_extension,
              })
            }
          />
        );
      },
    });
    return cols;
  }, [hasApproval, hasDocType, user]);

  if (state.loading) {
    return <LoadingState label="Loading documents…" />;
  }

  if (state.error) {
    return (
      <ErrorState title="Could not load documents" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  const hasActiveFilters =
    !!searchParams.get('q')?.trim() ||
    !!searchParams.get('documentType') ||
    searchParams.getAll('tags').length > 0 ||
    !!searchParams.get('companyId');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documents"
        subtitle="Search the library and refine with filters. Approval views appear as tabs when available for your role."
      />

      {admin && hasApproval ? (
        <nav
          className="flex flex-wrap gap-x-8 gap-y-0 border-b border-slate-200"
          role="tablist"
          aria-label="Approval status"
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'review', label: 'Pending' },
          ].map(({ id, label }) => {
            const isActive =
              id === 'all' ? !['review', 'approved', 'rejected'].includes(activeTab) : activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#00684a] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 max-w-xl flex-1">
          <label htmlFor="doc-search" className="sr-only">
            Search documents
          </label>
          <input
            id="doc-search"
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
          <div className="relative" ref={filterPanelRef}>
            <button
              type="button"
              onClick={() => setFilterPanelOpen((o) => !o)}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#00684a] transition-colors hover:text-[#005a40]"
              aria-expanded={filterPanelOpen}
              aria-controls="documents-filter-panel"
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
                id="documents-filter-panel"
                className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.1)]"
                role="region"
                aria-label="Document filters"
              >
                <div className="space-y-4">
                  {hasDocType ? (
                    <div>
                      <label htmlFor="filter-type" className="mb-1 block text-xs font-semibold text-slate-700">
                        Document type
                      </label>
                      <select
                        id="filter-type"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                        value={searchParams.get('documentType') || ''}
                        onChange={(e) => setFilter('documentType', e.target.value)}
                      >
                        <option value="">Document type</option>
                        {documentTypes.map((dt) => (
                          <option key={dt} value={dt}>
                            {dt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {admin && companies.length > 0 ? (
                    <div>
                      <label htmlFor="company-filter" className="mb-1 block text-xs font-semibold text-slate-700">
                        Organization
                      </label>
                      <select
                        id="company-filter"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
                        value={searchParams.get('companyId') || ''}
                        onChange={(e) => setCompanyId(e.target.value)}
                      >
                        <option value="">Organization</option>
                        {companies.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {tagOptions.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tagOptions.map((opt) => {
                          const active = selectedTags.map((t) => t.toLowerCase()).includes(opt.slug);
                          return (
                            <button
                              key={opt.slug}
                              type="button"
                              onClick={() => toggleTag(opt.slug)}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors ${
                                active
                                  ? 'bg-[#00684a] text-white ring-[#00684a]'
                                  : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {!hasDocType && !(admin && companies.length > 0) && tagOptions.length === 0 ? (
                    <p className="text-sm text-slate-500">No additional filters available.</p>
                  ) : null}
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

      <DataTable
        columns={columns}
        rows={docs}
        rowId={(r) => r.id}
        emptyMessage="No documents match the current filters."
      />

      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        totalRows={totalRows}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <p className="text-xs text-slate-500">
        Preview and download use your signed-in session. Actions follow your role (system admin, client admin, or owner).
      </p>

      {preview ? (
        <DocumentPreviewModal
          documentId={preview.id}
          title={preview.title}
          fileType={preview.fileType}
          fileExtension={preview.fileExtension}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
