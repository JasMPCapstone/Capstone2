import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fetchCompany } from '../../lib/api';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function CompanyUserResetPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, user: null });

  const msg = (searchParams.get('message') || '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchCompany(`/team/${id}/for-reset${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
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
      <h2 className="text-xl font-semibold text-slate-900">Reset staff password</h2>
      <Link to="/company/team" className="text-sm font-medium text-[#00684a] hover:underline">
        ← Back to team
      </Link>

      {msg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">{msg}</div>
      ) : null}

      <p className="text-sm text-slate-600">
        Set a temporary password for <strong>{u.full_name}</strong> ({u.email}).
      </p>

      <form method="post" action={`/company/team/${u.id}/reset-password`} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-slate-700">
            New temporary password
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
