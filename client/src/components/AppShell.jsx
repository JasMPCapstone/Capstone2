import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSystemAdmin, isClientAdmin } from '../lib/roles';
import { SidebarSection } from './ui/SidebarSection';
import PortalHeader from './PortalHeader';
import {
  IconAudit,
  IconDashboard,
  IconDocuments,
  IconSettings,
  IconTeam,
  IconUpload,
  IconUsers,
} from './icons/ShellIcons';

const sectionTitle = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50';

const navClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-black/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-white/90 hover:bg-white/10 hover:text-white'
  }`;

const navIconClass = (isActive) => (isActive ? 'text-white' : 'text-white/70');

export default function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const admin = user && isSystemAdmin(user.role);
  const userManagementActive = pathname.startsWith('/admin/user-management');
  const manager = user && isClientAdmin(user.role);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#f3f4f6]">
      <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-black/10 bg-[#00684a] text-white shadow-[4px_0_24px_rgba(0,0,0,0.08)]">
        <div className="shrink-0 border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" aria-hidden>
                <path
                  fill="currentColor"
                  d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">MedSupply Innovations</div>
              <div className="mt-0.5 text-sm font-semibold leading-tight text-white">Management Portal</div>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/65">
            Secure document management aligned with your organization&apos;s policies.
          </p>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2" aria-label="Main">
          <SidebarSection title="Main" titleClassName={sectionTitle}>
            <NavLink to="/" end className={navClass}>
              {({ isActive }) => (
                <>
                  <IconDashboard className={navIconClass(isActive)} />
                  <span>Dashboard</span>
                </>
              )}
            </NavLink>
            <NavLink to="/documents" end className={navClass}>
              {({ isActive }) => (
                <>
                  <IconDocuments className={navIconClass(isActive)} />
                  <span>Documents</span>
                </>
              )}
            </NavLink>
            <NavLink to="/documents/upload" end className={navClass}>
              {({ isActive }) => (
                <>
                  <IconUpload className={navIconClass(isActive)} />
                  <span className="leading-tight">Create new document</span>
                </>
              )}
            </NavLink>
            {admin ? (
              <NavLink to="/admin/user-management/users" className={() => navClass({ isActive: userManagementActive })}>
                {() => (
                  <>
                    <IconUsers className={navIconClass(userManagementActive)} />
                    <span>User management</span>
                  </>
                )}
              </NavLink>
            ) : null}
            {admin ? (
              <NavLink to="/admin/audit" end className={navClass}>
                {({ isActive }) => (
                  <>
                    <IconAudit className={navIconClass(isActive)} />
                    <span>Activity log</span>
                  </>
                )}
              </NavLink>
            ) : null}
            {manager ? (
              <NavLink to="/company/team" className={navClass}>
                {({ isActive }) => (
                  <>
                    <IconTeam className={navIconClass(isActive)} />
                    <span>Team</span>
                  </>
                )}
              </NavLink>
            ) : null}
            <NavLink to="/settings" className={navClass}>
              {({ isActive }) => (
                <>
                  <IconSettings className={navIconClass(isActive)} />
                  <span>Settings</span>
                </>
              )}
            </NavLink>
          </SidebarSection>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <p className="px-3 text-[10px] leading-snug text-white/45">Session uses secure cookies on this site.</p>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PortalHeader user={user} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-2 sm:px-5 lg:px-8 lg:pb-8 lg:pt-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
