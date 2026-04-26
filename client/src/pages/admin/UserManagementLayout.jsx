import { NavLink, Outlet } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';

const tabClass = ({ isActive }) =>
  `-mb-px border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium transition-colors ${
    isActive
      ? 'border-[#00684a] text-slate-900'
      : 'border-transparent text-slate-500 hover:text-slate-800'
  }`;

export default function UserManagementLayout() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="User management"
        subtitle="User accounts and organizations."
      />

      <nav
        className="flex flex-wrap gap-x-8 gap-y-0 border-b border-slate-200"
        role="tablist"
        aria-label="User management sections"
      >
        <NavLink to="users" className={tabClass} role="tab">
          Users
        </NavLink>
        <NavLink to="organizations" className={tabClass} role="tab">
          Organizations
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
