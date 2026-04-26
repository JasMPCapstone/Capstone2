import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdmin } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function AdminUserNewPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, companies: [] });

  const msg = (searchParams.get('message') || '').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchAdmin('/companies-list');
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
  }, []);

  const prefillCompany = (searchParams.get('companyId') || '').trim();

  if (state.loading) return <LoadingState label="Loading form…" />;
  if (state.error) {
    return <ErrorState title="Could not load organizations" message={state.error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Add client admin"
        subtitle="Creates a client admin for the selected organization. Add clients from the organization detail page."
      />
      <Link to="/admin/user-management/users" className="text-sm font-medium text-[#00684a] hover:underline">
        ← Back to users
      </Link>

      {msg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">{msg}</div>
      ) : null}

      <form method="post" action="/admin/users" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="companyId" className="mb-1 block text-sm font-medium text-slate-700">
            Organization
          </label>
          <select
            id="companyId"
            name="companyId"
            required
            defaultValue={prefillCompany}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {state.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
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
        <input type="hidden" name="role" value="CLIENT_ADMIN" />
        <button
          type="submit"
          className="w-full rounded-lg bg-[#00684a] py-2.5 text-sm font-semibold text-white hover:bg-[#00523c]"
        >
          Create client admin
        </button>
      </form>
    </div>
  );
}
