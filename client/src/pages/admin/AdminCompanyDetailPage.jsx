import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import { formatDate } from '../../lib/format';
import { roleLabel } from '../../lib/roles';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const ORG_LIST = '/admin/user-management/organizations';

/**
 * @param {{ embedded?: boolean }} props
 */
export default function AdminCompanyDetailPage({ embedded = false }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteFormRef = useRef(null);

  const msg = (searchParams.get('message') || '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchAdmin(`/companies/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, payload: null });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, payload: null });
        return;
      }
      setState({ loading: false, error: null, payload: result.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  if (state.loading) return <LoadingState label="Loading organization…" />;
  if (state.error) {
    return (
      <div className="space-y-4">
        {embedded ? (
          <Link to={ORG_LIST} className="inline-block text-sm font-medium text-[#00684a] hover:underline">
            ← Back to all organizations
          </Link>
        ) : null}
        <ErrorState title="Could not load organization" message={state.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const data = state.payload;
  if (!data || !data.company) return null;

  const company = data.company;
  const users = data.users || [];
  const documents = data.documents || [];
  const banner = msg || (data.message || '').trim();

  const userColumns = [
    { id: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.full_name}</span> },
    { id: 'email', header: 'Email', cell: (row) => <span className="text-slate-600">{row.email}</span> },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <span className="text-slate-600">{roleLabel(row.role)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <span>{row.is_active ? 'Active' : 'Inactive'}</span>,
    },
    {
      id: 'created',
      header: 'Created',
      cell: (row) => <span className="text-slate-600">{formatDate(row.created_at)}</span>,
    },
  ];

  const docColumns = [
    {
      id: 'title',
      header: 'Document',
      cell: (row) => (
        <Link to={`/documents/${row.id}`} className="font-medium text-[#00684a] hover:underline">
          {row.title || row.original_filename || 'Untitled'}
        </Link>
      ),
    },
    { id: 'owner', header: 'Uploaded by', cell: (row) => <span className="text-slate-600">{row.owner_name}</span> },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <span className="text-slate-600">{roleLabel(row.owner_role)}</span>,
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      cell: (row) => <span className="text-slate-600">{formatDate(row.created_at)}</span>,
    },
    {
      id: 'approval',
      header: 'Approval',
      cell: (row) => (
        <form
          method="post"
          action={`/admin/companies/${company.id}/documents/${row.id}/approval`}
          className="flex max-w-[18rem] flex-col gap-1.5"
        >
          <label htmlFor={`ap-${row.id}`} className="sr-only">
            Status
          </label>
          <select
            id={`ap-${row.id}`}
            name="approval_status"
            defaultValue={(row.approval_status || 'PENDING').toString()}
            className="rounded border border-slate-300 text-sm"
          >
            <option value="PENDING">Waiting</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <label htmlFor={`ap-reason-${row.id}`} className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
            Rejection reason (required if rejected)
          </label>
          <textarea
            id={`ap-reason-${row.id}`}
            name="rejectionReason"
            rows={2}
            maxLength={4000}
            defaultValue={(row.approval_rejection_reason || '').toString()}
            placeholder="Explain what needs to change…"
            className="w-full resize-y rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <button type="submit" className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900">
            Save
          </button>
        </form>
      ),
    },
  ];

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      <Link
        to={`/admin/companies/${company.id}/admins/new`}
        className="rounded-lg bg-[#00684a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#00523c]"
      >
        Add client admin
      </Link>
      <Link
        to={`/admin/companies/${company.id}/users/new`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Add client
      </Link>
      <Link
        to={`/documents?companyId=${company.id}`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Open in library
      </Link>
      <>
        <form ref={deleteFormRef} method="post" action={`/admin/companies/${company.id}/delete`} className="inline">
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50"
          >
            Delete organization
          </button>
        </form>
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete organization?"
          message="The organization and all related users and documents will be permanently removed. This cannot be recovered."
          confirmLabel="Delete organization"
          cancelLabel="Cancel"
          tone="rose"
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            setDeleteConfirmOpen(false);
            deleteFormRef.current?.submit();
          }}
        />
      </>
    </div>
  );

  const bodySections = (
    <>
      {banner ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{banner}</div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
        <DataTable columns={userColumns} rows={users} rowId={(r) => r.id} emptyMessage="No users linked yet." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        <DataTable columns={docColumns} rows={documents} rowId={(r) => r.id} emptyMessage="No documents yet." />
      </section>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        <Link to={ORG_LIST} className="inline-block text-sm font-medium text-[#00684a] hover:underline">
          ← Back to all organizations
        </Link>

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 px-4 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{company.name}</h2>
                <p className="mt-1 text-sm text-slate-600">Created {formatDate(company.created_at)}</p>
              </div>
              {actionButtons}
            </div>
          </div>

          <div className="space-y-10 border-t border-slate-100 px-4 py-8 sm:px-8 sm:py-10">{bodySections}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title={company.name} subtitle={`Created ${formatDate(company.created_at)}`} />
        {actionButtons}
      </div>

      {bodySections}
    </div>
  );
}
