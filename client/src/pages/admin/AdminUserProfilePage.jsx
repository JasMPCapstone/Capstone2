import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import DocumentStatusBadge from '../../components/ui/DocumentStatusBadge';
import ProfileCoverHeader from '../../components/profile/ProfileCoverHeader';
import { formatDate } from '../../lib/format';
import { roleLabel } from '../../lib/roles';

export default function AdminUserProfilePage() {
  const { id } = useParams();
  const userId = parseInt(id || '', 10);
  const [state, setState] = useState({ loading: true, error: null, payload: null });

  useEffect(() => {
    if (!userId) {
      setState({ loading: false, error: 'Invalid user', payload: null });
      return;
    }
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const res = await fetchAdmin(`/users/${userId}`);
      if (cancelled) return;
      if (res.kind === 'error') {
        setState({ loading: false, error: res.error, payload: null });
        return;
      }
      if (res.kind !== 'ok') {
        setState({ loading: false, error: 'Could not load user', payload: null });
        return;
      }
      setState({ loading: false, error: null, payload: res.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!state.payload || state.loading) return;
    const h = window.location.hash;
    if (h !== '#user_documents' && h !== '#user-documents') return;
    const t = window.requestAnimationFrame(() => {
      document.getElementById('user_documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(t);
  }, [state.payload, state.loading, userId]);

  if (state.loading) return <LoadingState label="Loading user…" />;
  if (state.error || !state.payload) {
    return (
      <div className="space-y-4">
        <Link to="/admin/user-management/users" className="text-sm font-medium text-[#00684a] hover:underline">
          ← Back to all users
        </Link>
        <ErrorState
          title="User not available"
          message={state.error || 'Something went wrong.'}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const { user, documentsUploaded, approvalStars, documents } = state.payload;
  const displayName = (user.preferred_name && String(user.preferred_name).trim()) || user.full_name || 'User';
  const subtitle = `${user.email} · ${roleLabel(user.role)}`;
  const addressParts = [user.suburb, user.city, user.state].filter((p) => p && String(p).trim());
  const addressLine = addressParts.length ? addressParts.join(', ') : null;

  const docColumns = [
    {
      id: 'title',
      header: 'Document',
      className: 'min-w-[10rem]',
      cell: (row) => (
        <Link
          to={`/documents/${row.id}`}
          className="font-medium text-[#00684a] hover:underline"
        >
          {(row.title || row.original_filename || 'Untitled').toString()}
        </Link>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <span className="text-slate-600">{(row.document_type || '—').toString()}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <DocumentStatusBadge status={row.approval_status} />,
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="tabular-nums text-slate-600">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Link to="/admin/user-management/users" className="inline-block text-sm font-medium text-[#00684a] hover:underline">
        ← Back to all users
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
        <ProfileCoverHeader
          variant="full"
          displayName={displayName}
          subtitle={subtitle}
          documentCount={documentsUploaded}
          approvalStars={typeof approvalStars === 'number' ? approvalStars : 0}
          hasAvatar={!!user.hasAvatar}
          avatarUserId={user.id}
        />

        <div
          id="user_documents"
          className="scroll-mt-24 border-t border-slate-100 px-4 py-8 sm:px-8 sm:py-10"
        >
          <h3 className="mb-4 text-base font-medium text-slate-500">Documents uploaded</h3>
          <p className="mb-4 text-sm text-slate-600">
            Files this user has submitted in the portal. Open a row to view or manage the document.
          </p>
          <DataTable
            columns={docColumns}
            rows={documents || []}
            rowId={(r) => r.id}
            emptyMessage="No documents uploaded yet."
            flush
          />
        </div>

        <div className="border-t border-slate-100 px-4 pb-8 sm:px-8 sm:pb-10">
          <h3 className="mb-4 text-base font-medium text-slate-500">Account details</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Organization</dt>
              <dd className="mt-1 text-sm text-slate-900">{user.company_name || user.company || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="mt-1 text-sm text-slate-900">{user.is_active ? 'Active' : 'Inactive'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDate(user.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Location</dt>
              <dd className="mt-1 text-sm text-slate-900">{addressLine || '—'}</dd>
            </div>
            {(user.emergency_contact_name || user.emergency_contact_phone) && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Emergency contact</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {[user.emergency_contact_name, user.emergency_contact_phone].filter(Boolean).join(' · ') || '—'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
