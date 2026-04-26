import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingState from '../components/ui/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { roleLabel } from '../lib/roles';
import { deleteProfileAvatar, fetchProfileSnapshot, postProfileAvatar } from '../lib/api';
import ProfileCoverHeader from '../components/profile/ProfileCoverHeader';
import SecurityModals, { SECURITY_ACTION_ROW_CLASS } from '../components/security/SecurityModals';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]';
const labelClass = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500';

/**
 * Profile completion / edit — hero layout with document count and outline save action.
 */
export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const { user, refresh } = useAuth();
  const passwordMustChange = Boolean(user?.passwordMustChange);
  const error = (searchParams.get('error') || '').trim();
  const saved = (searchParams.get('saved') || '').trim() === '1';
  const onboarding = user && !user.profileCompleted;

  const [load, setLoad] = useState({ status: 'loading' });
  const [securityOverlay, setSecurityOverlay] = useState(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarBust, setAvatarBust] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoad({ status: 'loading' });
      const res = await fetchProfileSnapshot();
      if (cancelled) return;
      if (res.kind === 'ok') {
        setLoad({ status: 'ok', data: res.data });
        setFormEpoch((n) => n + 1);
        if (searchParams.get('saved') === '1') {
          await refresh({ quiet: true });
          window.dispatchEvent(new CustomEvent('medsupply:profile-updated'));
        }
      } else {
        setLoad({ status: 'ok', data: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString(), refresh]);

  if (load.status === 'loading') {
    return <LoadingState label="Loading profile…" />;
  }

  const d = load.data || {};
  const displayName = (d.preferredName && String(d.preferredName).trim()) || d.fullName || user?.fullName || 'Your profile';
  const docCount = typeof d.documentsUploaded === 'number' ? d.documentsUploaded : 0;
  const hasAvatar = Boolean(d.hasAvatar);

  const saveLabel = onboarding ? 'Save and continue' : 'Save changes';

  async function reloadProfileSnapshot() {
    const res = await fetchProfileSnapshot();
    if (res.kind === 'ok') {
      setLoad({ status: 'ok', data: res.data });
    }
  }

  async function onAvatarFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAvatarBusy(true);
    const res = await postProfileAvatar(file);
    setAvatarBusy(false);
    if (res.kind === 'ok') {
      setAvatarBust((n) => n + 1);
      setLoad((prev) =>
        prev.status === 'ok' && prev.data ? { status: 'ok', data: { ...prev.data, hasAvatar: true } } : prev
      );
      await refresh({ quiet: true });
      await reloadProfileSnapshot();
      window.dispatchEvent(new CustomEvent('medsupply:profile-updated'));
      return;
    }
    const msg = res.kind === 'error' ? res.error : 'Could not update photo.';
    window.alert(msg);
  }

  async function onAvatarRemove() {
    if (!window.confirm('Remove your profile photo?')) return;
    setAvatarBusy(true);
    const res = await deleteProfileAvatar();
    setAvatarBusy(false);
    if (res.kind === 'ok') {
      setAvatarBust((n) => n + 1);
      setLoad((prev) =>
        prev.status === 'ok' && prev.data ? { status: 'ok', data: { ...prev.data, hasAvatar: false } } : prev
      );
      await refresh({ quiet: true });
      await reloadProfileSnapshot();
      window.dispatchEvent(new CustomEvent('medsupply:profile-updated'));
      return;
    }
    window.alert(res.kind === 'error' ? res.error : 'Could not remove photo.');
  }

  return (
    <div className="mx-auto max-w-4xl">
      {saved ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
          Profile saved. Your name and details in the header update automatically.
        </div>
      ) : null}

      {error === 'save' ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          Could not save your profile. Please try again.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
        <ProfileCoverHeader
          displayName={displayName}
          subtitle={d.email ? `${d.email} · ${roleLabel(d.role)}` : roleLabel(d.role)}
          documentCount={docCount}
          approvalStars={typeof d.approvalStars === 'number' ? d.approvalStars : 0}
          hasAvatar={hasAvatar}
          avatarBust={avatarBust}
          avatarBusy={avatarBusy}
          onAvatarFileChange={onAvatarFileChange}
          onAvatarRemove={onAvatarRemove}
          variant="full"
          primaryAction={
            <button
              type="submit"
              form="profile-form"
              className="rounded-full border-2 border-[#00684a] bg-white px-6 py-2.5 text-sm font-semibold text-[#00684a] shadow-sm transition-colors hover:bg-[#00684a]/5"
            >
              {saveLabel}
            </button>
          }
        />

        <div className="px-4 py-8 sm:px-8 sm:py-10">
          <h3 className="mb-6 text-base font-medium text-slate-500">Personal details</h3>
          <form key={formEpoch} id="profile-form" method="post" action="/profile" className="space-y-5">
            <div>
              <label htmlFor="preferredName" className={labelClass}>
                Preferred name
              </label>
              <input
                id="preferredName"
                name="preferredName"
                type="text"
                maxLength={255}
                defaultValue={d.preferredName || ''}
                placeholder="How you would like to be addressed"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={50}
                defaultValue={d.phone || ''}
                placeholder="Your contact number"
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="addressSuburb" className={labelClass}>
                  Suburb
                </label>
                <input
                  id="addressSuburb"
                  name="addressSuburb"
                  type="text"
                  maxLength={100}
                  defaultValue={d.suburb || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="addressCity" className={labelClass}>
                  City
                </label>
                <input
                  id="addressCity"
                  name="addressCity"
                  type="text"
                  maxLength={100}
                  defaultValue={d.city || ''}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="addressState" className={labelClass}>
                State
              </label>
              <input
                id="addressState"
                name="addressState"
                type="text"
                maxLength={100}
                defaultValue={d.state || ''}
                className={inputClass}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="emergencyContactName" className={labelClass}>
                  Emergency contact name
                </label>
                <input
                  id="emergencyContactName"
                  name="emergencyContactName"
                  type="text"
                  maxLength={255}
                  defaultValue={d.emergencyContactName || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="emergencyContactPhone" className={labelClass}>
                  Emergency contact phone
                </label>
                <input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  type="text"
                  maxLength={50}
                  defaultValue={d.emergencyContactPhone || ''}
                  className={inputClass}
                />
              </div>
            </div>

            <p className="sr-only">
              <button type="submit">{saveLabel}</button>
            </p>
          </form>

          <div className="mt-10 border-t border-slate-100 pt-10">
            <h3 className="mb-2 text-base font-medium text-slate-500">Security</h3>
            <p className="mb-4 text-sm text-slate-600">
              Two-factor authentication in the app; password change on the server.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSecurityOverlay('2fa')}
                className={SECURITY_ACTION_ROW_CLASS}
              >
                <span>Two-factor authentication (2FA)</span>
              </button>
              <button
                type="button"
                onClick={() => setSecurityOverlay('password')}
                className={SECURITY_ACTION_ROW_CLASS}
              >
                <span>Change password</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <SecurityModals
        overlay={securityOverlay}
        onDismiss={() => setSecurityOverlay(null)}
        passwordMustChange={passwordMustChange}
        idPrefix="profile"
      />

      {onboarding ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          We need a few details before you can use the rest of the portal.
        </p>
      ) : null}
    </div>
  );
}
