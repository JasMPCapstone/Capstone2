import { useEffect } from 'react';
import ChangePasswordForm from '../ChangePasswordForm';
import TwoFactorSettingsPanel from '../TwoFactorSettingsPanel';
import { postTwoFactorCancel } from '../../lib/api';

/** Matches Settings / Profile security action rows (light bordered tiles). */
export const SECURITY_ACTION_ROW_CLASS =
  'flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100';

/**
 * Password + 2FA modal overlays (shared by Settings and Profile).
 *
 * @param {{ overlay: null | 'password' | '2fa', onDismiss: () => void, passwordMustChange: boolean, idPrefix: 'settings' | 'profile' }} props
 */
export default function SecurityModals({ overlay, onDismiss, passwordMustChange, idPrefix }) {
  const pwdTitle = `${idPrefix}-password-title`;
  const pwdDesc = `${idPrefix}-password-desc`;
  const twoTitle = `${idPrefix}-2fa-title`;
  const twoDesc = `${idPrefix}-2fa-desc`;

  useEffect(() => {
    if (!overlay) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (overlay === 'password' && passwordMustChange) return;
      if (overlay === '2fa') void postTwoFactorCancel();
      onDismiss();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, passwordMustChange, onDismiss]);

  if (overlay === 'password') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={pwdTitle}
      >
        <button
          type="button"
          className="absolute inset-0 bg-[#00684a]/18 backdrop-blur-[3px]"
          aria-label="Close dialog"
          onClick={() => {
            if (passwordMustChange) return;
            onDismiss();
          }}
        />
        <div className="relative z-10 max-h-[min(92vh,44rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <ChangePasswordForm
            mustChange={passwordMustChange}
            errorMessage={null}
            showCancel={false}
            headingId={pwdTitle}
            describedById={pwdDesc}
            showBackButton={!passwordMustChange}
            onBack={onDismiss}
            titleTag="h2"
          />
        </div>
      </div>
    );
  }

  if (overlay === '2fa') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={twoTitle}
      >
        <button
          type="button"
          className="absolute inset-0 bg-[#00684a]/18 backdrop-blur-[3px]"
          aria-label="Close dialog"
          onClick={() => {
            void postTwoFactorCancel();
            onDismiss();
          }}
        />
        <div className="relative z-10 max-h-[min(92vh,90vh)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <TwoFactorSettingsPanel variant="modal" onClose={onDismiss} headingId={twoTitle} describedById={twoDesc} />
        </div>
      </div>
    );
  }

  return null;
}
