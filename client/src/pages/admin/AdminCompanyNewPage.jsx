import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';

export default function AdminCompanyNewPage() {
  const [searchParams] = useSearchParams();
  const msg = (searchParams.get('message') || '').trim();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="New organization"
        subtitle="Creates a company record and its first client admin account in one step."
      />
      <Link to="/admin/user-management/organizations" className="text-sm font-medium text-[#00684a] hover:underline">
        ← Back to organizations
      </Link>

      {msg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">{msg}</div>
      ) : null}

      <form method="post" action="/admin/companies" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Organization name
          </label>
          <input id="name" name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Client admin full name
          </label>
          <input id="fullName" name="fullName" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Client admin email
          </label>
          <input id="email" name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
          Create organization
        </button>
      </form>
    </div>
  );
}
