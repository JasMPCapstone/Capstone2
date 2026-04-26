import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import SecurityModals, { SECURITY_ACTION_ROW_CLASS } from '../components/security/SecurityModals';
import { useAuth } from '../hooks/useAuth';
import { roleLabel } from '../lib/roles';
import { HelpCentreContent, PrivacyContent } from '../content/HelpPrivacyContent';
import { RolesInPortalContent } from '../content/RolesInPortalContent';

function IconClose() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const passwordMustChange = Boolean(user?.passwordMustChange);
  const [overlay, setOverlay] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openRolesModal) {
      setOverlay('roles');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!overlay || overlay === 'password' || overlay === '2fa') return;
    function onKey(e) {
      if (e.key === 'Escape') setOverlay(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Security, organization tools, and help — all in this app."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Security" description="Two-factor authentication in the app; password change on the server." />
          <div className="space-y-3 px-5 py-4">
            <button type="button" onClick={() => setOverlay('2fa')} className={SECURITY_ACTION_ROW_CLASS}>
              <span>Two-factor authentication (2FA)</span>
            </button>
            <button type="button" onClick={() => setOverlay('password')} className={SECURITY_ACTION_ROW_CLASS}>
              <span>Change password</span>
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Organization & help" description="Role information and help pages in the app." />
          <div className="space-y-3 px-5 py-4">
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setOverlay('roles')}
                className="text-left font-medium text-[#00684a] hover:underline"
              >
                User roles in this portal
              </button>
            </div>
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setOverlay('help')}
                className="font-medium text-[#00684a] hover:underline"
              >
                Help centre
              </button>
            </div>
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setOverlay('privacy')}
                className="font-medium text-[#00684a] hover:underline"
              >
                Privacy
              </button>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-500">
        Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
        {user?.role ? ` · ${roleLabel(user.role)}` : ''}.
      </p>

      {overlay === 'roles' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-roles-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close dialog"
            onClick={() => setOverlay(null)}
          />
          <div className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="settings-roles-title" className="text-lg font-semibold text-slate-900">
                  User roles in this portal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <RolesInPortalContent />
            </div>
          </div>
        </div>
      ) : null}

      <SecurityModals
        overlay={overlay === 'password' || overlay === '2fa' ? overlay : null}
        onDismiss={() => setOverlay(null)}
        passwordMustChange={passwordMustChange}
        idPrefix="settings"
      />

      {overlay === 'help' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="settings-help-title">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close dialog"
            onClick={() => setOverlay(null)}
          />
          <div className="relative z-10 flex max-h-[min(92vh,44rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
              <h2 id="settings-help-title" className="text-lg font-semibold text-slate-900">
                Help centre
              </h2>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <HelpCentreContent />
            </div>
          </div>
        </div>
      ) : null}

      {overlay === 'privacy' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="settings-privacy-title">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close dialog"
            onClick={() => setOverlay(null)}
          />
          <div className="relative z-10 flex max-h-[min(90vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <h2 id="settings-privacy-title" className="text-lg font-semibold text-slate-900">
                Privacy
              </h2>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700">
              <PrivacyContent />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
