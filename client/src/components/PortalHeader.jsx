import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { roleLabel } from '../lib/roles';
import { useNotifications } from '../hooks/useNotifications';
import { fetchProfileSnapshot, postLogout, postNotificationsMarkDocumentRead } from '../lib/api';
import { IconBell, IconChevronDown, IconLogout } from './icons/ShellIcons';
import { formatDateTime } from '../lib/format';
import UserAvatar from './ui/UserAvatar';

function initialsFromName(name, email) {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase() || '?';
}

function displayName(user, snapshot) {
  const snap = snapshot?.preferredName && String(snapshot.preferredName).trim();
  if (snap) return snap;
  const sessionPref = user?.preferredName && String(user.preferredName).trim();
  if (sessionPref) return sessionPref;
  return user?.fullName || 'Signed in';
}

function avatarInitials(user, snapshot) {
  return initialsFromName(displayName(user, snapshot), user?.email);
}

/**
 * Top bar: notifications + compact profile trigger with account dropdown. Brand #00684a.
 */
export default function PortalHeader({ user }) {
  const enabled = !!user?.userId;
  const { items, unreadCount, loading, markAllRead, refresh: refreshNotifications } = useNotifications(enabled);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [profileSnap, setProfileSnap] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarBust, setAvatarBust] = useState(0);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const showBadge = unreadCount > 0;
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const res = await fetchProfileSnapshot();
    if (res.kind === 'ok') {
      setProfileSnap(res.data);
    } else {
      setProfileSnap(null);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    loadProfile();
  }, [profileOpen, loadProfile]);

  useEffect(() => {
    if (!enabled) return;
    void loadProfile();
  }, [enabled, loadProfile]);

  useEffect(() => {
    function onProfileUpdated() {
      setAvatarBust((b) => b + 1);
      void loadProfile();
    }
    window.addEventListener('medsupply:profile-updated', onProfileUpdated);
    return () => window.removeEventListener('medsupply:profile-updated', onProfileUpdated);
  }, [loadProfile]);

  useEffect(() => {
    if (!notifOpen && !profileOpen) return;
    function onDocClick(e) {
      const t = e.target;
      if (notifRef.current && !notifRef.current.contains(t)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(t)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen, profileOpen]);

  async function onMarkAllRead() {
    setMarking(true);
    try {
      await markAllRead();
    } finally {
      setMarking(false);
    }
  }

  function toggleNotif() {
    setProfileOpen(false);
    setNotifOpen((v) => !v);
  }

  function toggleProfile() {
    setNotifOpen(false);
    setProfileOpen((v) => !v);
  }

  async function onLogout(e) {
    e.preventDefault();
    const result = await postLogout();
    if (result.kind === 'error') {
      window.alert(result.error);
    }
  }

  const orgLine =
    profileSnap?.organizationName ||
    (profileSnap?.companyLabel && String(profileSnap.companyLabel).trim()) ||
    null;

  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <div className="flex min-h-0 items-center justify-end px-4 py-1 sm:px-6 sm:py-1.5">
        <div className="inline-flex items-center gap-0.5 rounded-2xl border border-slate-200/70 bg-white/90 py-1 pl-1 pr-1.5 shadow-sm backdrop-blur-sm">
          <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={toggleNotif}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#00684a]"
            title="Recent uploads"
            aria-expanded={notifOpen}
            aria-haspopup="true"
            aria-label={showBadge ? `${unreadCount} new document uploads` : 'Recent document uploads'}
          >
            <IconBell className="!h-5 !w-5" />
            {showBadge ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">
                {badgeText}
              </span>
            ) : null}
          </button>

          {notifOpen ? (
            <div className="absolute right-0 z-50 mt-1.5 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-900">Recent uploads</p>
                <p className="mt-0.5 text-xs text-slate-500">New uploads in your scope. Mark as read when reviewed.</p>
              </div>
              <div className="max-h-[min(60vh,320px)] overflow-y-auto">
                {loading ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No recent uploads.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {items.map((n) => (
                      <li key={n.id}>
                        <Link
                          to={`/documents/${n.id}`}
                          className="block px-3 py-2.5 transition-colors hover:bg-slate-50"
                          onClick={() => {
                            setNotifOpen(false);
                            postNotificationsMarkDocumentRead(n.id).then((res) => {
                              if (res.kind === 'ok') refreshNotifications();
                            });
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1 font-medium text-[#00684a]">{n.title}</span>
                            {n.isNew ? (
                              <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                New
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                            {n.companyName ? <span>{n.companyName}</span> : null}
                            {n.ownerName ? <span>{n.ownerName}</span> : null}
                            <span className="tabular-nums text-slate-400">{formatDateTime(n.createdAt)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-2.5 py-2">
                <button
                  type="button"
                  disabled={marking || unreadCount === 0}
                  onClick={onMarkAllRead}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#00684a] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {marking ? 'Updating…' : 'Mark all as read'}
                </button>
                <Link
                  to="/documents"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  onClick={() => setNotifOpen(false)}
                >
                  Document library →
                </Link>
              </div>
            </div>
          ) : null}
          </div>

          <div className="relative border-l border-slate-200/60 pl-0.5" ref={profileRef}>
          <button
            type="button"
            onClick={toggleProfile}
            className="flex max-w-[min(100vw-6rem,240px)] items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-left transition-colors hover:bg-slate-100"
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
            aria-label="Account menu"
          >
            <UserAvatar
              initials={avatarInitials(user, profileSnap)}
              hasPhoto={!!profileSnap?.hasAvatar}
              cacheBust={avatarBust}
              tone="brand"
              sizeClass="h-9 w-9 text-[11px]"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold leading-tight text-slate-900">
                {displayName(user, profileSnap)}
              </div>
              <div className="truncate text-xs leading-tight text-slate-500">{user?.role ? roleLabel(user.role) : ''}</div>
            </div>
            <IconChevronDown className="hidden !h-4 !w-4 shrink-0 text-slate-400 sm:block" />
          </button>

          {profileOpen ? (
            <div
              className="absolute right-0 z-50 mt-1.5 w-[min(100vw-1.5rem,17.5rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg"
              role="dialog"
              aria-label="Account"
            >
              <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-3">
                <div className="flex gap-2.5">
                  <UserAvatar
                    initials={avatarInitials(user, profileSnap)}
                    hasPhoto={!!profileSnap?.hasAvatar}
                    cacheBust={avatarBust}
                    tone="brand"
                    sizeClass="h-9 w-9 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{displayName(user, profileSnap)}</p>
                    <p className="truncate text-xs text-slate-500">{user?.role ? roleLabel(user.role) : ''}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-0 px-3 py-2 text-sm">
                {profileLoading ? (
                  <p className="py-3 text-center text-xs text-slate-500">Loading details…</p>
                ) : (
                  <>
                    <div className="border-b border-slate-100 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                      <p className="mt-0.5 break-all text-xs text-slate-800">{profileSnap?.email || user?.email || '—'}</p>
                    </div>
                    <div className="border-b border-slate-100 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Address</p>
                      <p className="mt-0.5 text-xs leading-snug text-slate-800">
                        {profileSnap?.addressLine || '—'}
                      </p>
                    </div>
                    <div className="py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Organization</p>
                      <p className="mt-0.5 text-xs text-slate-800">{orgLine || '—'}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50/50 px-2 py-2">
                <Link
                  to="/profile"
                  className="flex w-full items-center justify-center rounded-lg bg-[#00684a] px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-[#005a40]"
                  onClick={() => setProfileOpen(false)}
                >
                  Edit profile
                </Link>
                <Link
                  to="/settings"
                  className="mt-1.5 block w-full rounded-lg py-2 text-center text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
                  onClick={() => setProfileOpen(false)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-center text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <IconLogout className="!h-3.5 !w-3.5 text-slate-500" />
                  Log out
                </button>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
