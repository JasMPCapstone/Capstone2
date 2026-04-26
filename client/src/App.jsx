import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { isSystemAdmin, mustEnforceFullOnboarding } from './lib/roles';
import AppShell from './components/AppShell';
import Spinner from './components/Spinner';
import LoginPage from './pages/LoginPage';
import LoginTwoFactorPage from './pages/LoginTwoFactorPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import DocumentEditPage from './pages/DocumentEditPage';
import SettingsPage from './pages/SettingsPage';
import SettingsTwoFactorPage from './pages/SettingsTwoFactorPage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';
import PrivacyPage from './pages/PrivacyPage';
import RequireSystemAdmin from './components/RequireSystemAdmin';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserNewPage from './pages/admin/AdminUserNewPage';
import AdminUserResetPage from './pages/admin/AdminUserResetPage';
import AdminUserProfilePage from './pages/admin/AdminUserProfilePage';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage';
import UserManagementLayout from './pages/admin/UserManagementLayout';
import AdminCompanyNewPage from './pages/admin/AdminCompanyNewPage';
import AdminCompanyDetailPage from './pages/admin/AdminCompanyDetailPage';
import AdminCompanyStaffNewPage from './pages/admin/AdminCompanyStaffNewPage';
import AdminCompanyAdminNewPage from './pages/admin/AdminCompanyAdminNewPage';
import RequireClientAdmin from './components/RequireClientAdmin';
import CompanyTeamPage from './pages/company/CompanyTeamPage';
import CompanyUserResetPage from './pages/company/CompanyUserResetPage';

function LegacyCompanyDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/user-management/organizations/${id}`} replace />;
}

function RedirectSettingsRolesModal() {
  return <Navigate to="/settings" replace state={{ openRolesModal: true }} />;
}

function ProtectedLayout() {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || loading) return;
    if (isSystemAdmin(user.role)) return;

    // 1) New users must set a new password before anything else (matches server enforceOnboarding).
    if (user.passwordMustChange) {
      if (location.pathname !== '/account/change-password') {
        navigate('/account/change-password', { replace: true });
      }
      return;
    }

    // 2) Complete profile (password is already set).
    if (!user.profileCompleted) {
      if (location.pathname !== '/profile') {
        navigate('/profile', { replace: true });
      }
      return;
    }

    // 3) Client / client admin: enable 2FA before using the rest of the app.
    if (mustEnforceFullOnboarding(user.role) && !user.twoFactorEnabled) {
      if (!location.pathname.startsWith('/settings/2fa')) {
        navigate('/settings/2fa?style=required', { replace: true });
      }
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-100">
        <Spinner />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center overflow-y-auto bg-slate-100 px-4 py-8">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-950">
          <p className="font-medium">Connection problem</p>
          <p className="mt-2 text-sm opacity-90">{error}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            onClick={() => refresh()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/2fa" element={<LoginTwoFactorPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/account/change-password" element={<ChangePasswordPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route element={<RequireClientAdmin />}>
                <Route path="company/team" element={<CompanyTeamPage />} />
                <Route path="company/team/:id/reset-password" element={<CompanyUserResetPage />} />
              </Route>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/upload" element={<DocumentUploadPage />} />
              <Route path="documents/:id/edit" element={<DocumentEditPage />} />
              <Route path="documents/:id" element={<DocumentDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/2fa" element={<SettingsTwoFactorPage />} />
              <Route path="admin" element={<RequireSystemAdmin />}>
                <Route index element={<Navigate to="/" replace />} />
                <Route path="user-management" element={<UserManagementLayout />}>
                  <Route index element={<Navigate to="users" replace />} />
                  <Route path="organizations/:id" element={<AdminCompanyDetailPage embedded />} />
                  <Route path="organizations" element={<AdminCompaniesPage embedded />} />
                  <Route path="users/:id" element={<AdminUserProfilePage />} />
                  <Route path="users" element={<AdminUsersPage embedded />} />
                </Route>
                <Route path="user-management/roles" element={<RedirectSettingsRolesModal />} />
                <Route path="roles" element={<RedirectSettingsRolesModal />} />
                <Route path="users" element={<Navigate to="/admin/user-management/users" replace />} />
                <Route path="companies" element={<Navigate to="/admin/user-management/organizations" replace />} />
                <Route path="users/new" element={<AdminUserNewPage />} />
                <Route path="users/:id/reset-password" element={<AdminUserResetPage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="companies/new" element={<AdminCompanyNewPage />} />
                <Route path="companies/:id" element={<LegacyCompanyDetailRedirect />} />
                <Route path="companies/:id/users/new" element={<AdminCompanyStaffNewPage />} />
                <Route path="companies/:id/admins/new" element={<AdminCompanyAdminNewPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
