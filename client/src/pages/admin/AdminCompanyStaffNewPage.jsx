import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function AdminCompanyStaffNewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, company: null });

  const msg = (searchParams.get('message') || '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchAdmin(`/companies/${id}/staff-new${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, company: null });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, company: null });
        return;
      }
      setState({ loading: false, error: null, company: result.data.company });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  if (state.loading) return <LoadingState label="Loading…" />;
  if (state.error) {
    return <ErrorState title="Could not load" message={state.error} onRetry={() => window.location.reload()} />;
  }

  const c = state.company;
  if (!c) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Add client" subtitle={`Organization: ${c.name}`} />
      <Link to={`/admin/user-management/organizations/${id}`} className="text-sm font-medium text-[#00684a] hover:underline">
        ← Back to organization
      </Link>

      {msg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">{msg}</div>
      ) : null}

      <form
        method="post"
        action={`/admin/companies/${id}/users`}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input id="fullName" name="fullName" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="tempPassword" className="mb-1 block text-sm font-medium text-slate-700">
            Temporary password
          </label>
          <input
            id="tempPassword"
            name="tempPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-[#00684a] py-2.5 text-sm font-semibold text-white hover:bg-[#00523c]"
        >
          Create client user
        </button>
      </form>
    </div>
  );
}
