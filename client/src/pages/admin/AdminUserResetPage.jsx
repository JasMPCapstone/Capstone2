import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function AdminUserResetPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, user: null });

  const msg = (searchParams.get('message') || '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchAdmin(`/users/${id}/for-reset${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, user: null });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, user: null });
        return;
      }
      setState({ loading: false, error: null, user: result.data.user });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  if (state.loading) return <LoadingState label="Loading…" />;
  if (state.error) {
    return <ErrorState title="Could not load user" message={state.error} onRetry={() => window.location.reload()} />;
  }

  const u = state.user;
  if (!u) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Reset password" subtitle={`Set a new password for ${u.email}`} />
      <Link to="/admin/user-management/users" className="text-sm font-medium text-[#00684a] hover:underline">
        ← Back to users
      </Link>

      {msg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">{msg}</div>
      ) : null}

      <form
        method="post"
        action={`/admin/users/${u.id}/reset-password`}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
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
          Save password
        </button>
      </form>
    </div>
  );
}
