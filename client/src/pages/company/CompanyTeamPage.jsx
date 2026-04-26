import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCompany } from '../../lib/api';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import UserAvatar from '../../components/ui/UserAvatar';
import DocumentStatusBadge from '../../components/ui/DocumentStatusBadge';
import { formatDate } from '../../lib/format';
import { roleLabel } from '../../lib/roles';

function initialsFromName(name, email) {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase() || '?';
}

function IconSearch({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

/** @param {{ value?: number, className?: string }} props */
function StarRating({ value, className = '' }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div
      className={`flex justify-center gap-px ${className}`.trim()}
      aria-label={`Approval rating ${v} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-base leading-none ${i <= v ? 'text-amber-400' : 'text-slate-200'}`}>
          ★
        </span>
      ))}
    </div>
  );
}

/** Key — reset / set password */
function IconKeyPassword({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}

/** Circle with slash — deactivate */
function IconDeactivate({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M8 16l8-8" strokeLinecap="round" />
    </svg>
  );
}

function IconReactivate({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function IconInfo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const teamActionBtn =
  'flex min-h-[2.75rem] flex-1 items-center justify-center py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#00684a]/40 focus-visible:ring-inset';

/**
 * @param {{ member: object, currentUserId?: number, avatarListBust?: number, onOpenDetail?: (m: object) => void, onOpenBasicInfo?: (m: object) => void }} props
 */
function TeamMemberCard({ member, currentUserId, avatarListBust = 0, onOpenDetail, onOpenBasicInfo }) {
  const isStaff = member.role === 'CLIENT';
  const canManageStaff = isStaff;
  const isSelf = currentUserId != null && Number(member.id) === Number(currentUserId);
  const name = member.full_name || '—';
  const roleText = roleLabel(member.role);
  const docCount = Number(member.documentsUploaded) || 0;
  const stars = Number(member.approvalStars) || 0;

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_28px_rgba(15,23,42,0.1)]">
      <div className="absolute right-3 top-3 z-10">
        <span
          className={`text-xs font-semibold ${member.is_active ? 'text-[#00684a]' : 'text-slate-400'}`}
          title={member.is_active ? 'Account is active' : 'Account is inactive'}
        >
          {member.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenDetail?.(member)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetail?.(member);
          }
        }}
        className="flex flex-1 cursor-pointer flex-col items-center rounded-t-2xl px-5 pb-4 pt-10 text-center outline-none transition-colors hover:bg-slate-50/60 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        title="View documents and approval rating"
      >
        <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full shadow-inner ring-1 ring-slate-200/80">
          <UserAvatar
            initials={initialsFromName(member.full_name, member.email)}
            hasPhoto={!!member.hasAvatar}
            userId={Number(member.id)}
            cacheBust={avatarListBust}
            sizeClass="h-full w-full border-2 border-white text-lg font-bold tracking-tight"
            tone="surface"
          />
        </div>
        <h3 className="mt-4 line-clamp-2 text-base font-bold leading-snug text-slate-900">{name}</h3>
        <p className="mt-2 text-sm font-medium leading-snug text-slate-600">{roleText}</p>
        <p className="mt-1.5 break-all text-xs leading-relaxed text-slate-500">{member.email}</p>
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{docCount}</span> document{docCount === 1 ? '' : 's'} uploaded
        </p>
        <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">Approval (decided)</p>
        <div className="mt-2 w-full">
          <StarRating value={stars} />
        </div>
      </div>

      {canManageStaff ? (
        <div
          className="flex divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/80"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${teamActionBtn} text-slate-600 hover:bg-white hover:text-slate-900`}
            title="Basic info"
            aria-label={`Basic info for ${name}`}
            onClick={() => onOpenBasicInfo?.(member)}
          >
            <IconInfo className="h-5 w-5" />
          </button>
          <Link
            to={`/company/team/${member.id}/reset-password`}
            className={`${teamActionBtn} text-[#00684a] hover:bg-white`}
            title="Reset password"
            aria-label={`Reset password for ${name}`}
          >
            <IconKeyPassword className="h-5 w-5" />
          </Link>
          {member.is_active ? (
            <form method="post" action={`/company/team/${member.id}/deactivate`} className="contents">
              <button
                type="submit"
                className={`${teamActionBtn} text-rose-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={isSelf}
                title={isSelf ? 'You cannot deactivate your own account' : `Deactivate ${name}`}
                aria-label={isSelf ? 'Cannot deactivate your own account' : `Deactivate ${name}`}
              >
                <IconDeactivate className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <form method="post" action={`/company/team/${member.id}/reactivate`} className="contents">
              <button
                type="submit"
                className={`${teamActionBtn} text-emerald-700 hover:bg-white`}
                title={`Reactivate ${name}`}
                aria-label={`Reactivate ${name}`}
              >
                <IconReactivate className="h-5 w-5" />
              </button>
            </form>
          )}
          <form
            method="post"
            action={`/company/team/${member.id}/delete`}
            className="contents"
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Remove ${name} permanently? Their account and uploaded documents will be deleted. This cannot be undone.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className={`${teamActionBtn} text-rose-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={isSelf}
              title={isSelf ? 'You cannot remove your own account' : `Delete ${name} from the team`}
              aria-label={isSelf ? 'Cannot remove your own account' : `Delete ${name} from the team`}
            >
              <IconTrash className="h-5 w-5" />
            </button>
          </form>
        </div>
      ) : (
        <div
          className="border-t border-slate-100 bg-slate-50/80"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${teamActionBtn} w-full text-slate-600 hover:bg-white hover:text-slate-900`}
            title={isSelf ? 'Your profile' : 'Client Admin profile'}
            aria-label={isSelf ? 'Your basic info' : `Basic info for ${name}`}
            onClick={() => onOpenBasicInfo?.(member)}
          >
            <IconInfo className="h-5 w-5" />
          </button>
        </div>
      )}
    </article>
  );
}

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00684a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#d1f0e8]';

export default function CompanyTeamPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [createOpen, setCreateOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [detailMember, setDetailMember] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, error: null, documents: null });
  const [basicInfoMember, setBasicInfoMember] = useState(null);
  const [avatarListBust, setAvatarListBust] = useState(0);

  const qs = searchParams.toString();

  const reloadTeamDataQuiet = useCallback(async () => {
    const result = await fetchCompany(`/team${qs ? `?${qs}` : ''}`);
    if (result.kind === 'ok') {
      setState((s) => ({ ...s, data: result.data }));
    }
  }, [qs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await fetchCompany(`/team${qs ? `?${qs}` : ''}`);
      if (cancelled) return;
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, data: null });
        return;
      }
      if (result.kind !== 'ok') {
        setState({ loading: false, error: null, data: null });
        return;
      }
      setState({ loading: false, error: null, data: result.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  useEffect(() => {
    function onProfileUpdated() {
      setAvatarListBust((b) => b + 1);
      void reloadTeamDataQuiet();
    }
    window.addEventListener('medsupply:profile-updated', onProfileUpdated);
    return () => window.removeEventListener('medsupply:profile-updated', onProfileUpdated);
  }, [reloadTeamDataQuiet]);

  useEffect(() => {
    if (!createOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setCreateOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [createOpen]);

  useEffect(() => {
    if (!detailMember) return;
    let cancelled = false;
    (async () => {
      setDetailState({ loading: true, error: null, documents: null });
      const res = await fetchCompany(`/team/${detailMember.id}/documents`);
      if (cancelled) return;
      if (res.kind === 'error') {
        setDetailState({ loading: false, error: res.error, documents: null });
        return;
      }
      if (res.kind !== 'ok') {
        setDetailState({ loading: false, error: null, documents: null });
        return;
      }
      setDetailState({ loading: false, error: null, documents: res.data.documents || [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [detailMember]);

  useEffect(() => {
    if (!detailMember) return;
    function onKey(e) {
      if (e.key === 'Escape') setDetailMember(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailMember]);

  useEffect(() => {
    if (!basicInfoMember) return;
    function onKey(e) {
      if (e.key === 'Escape') setBasicInfoMember(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [basicInfoMember]);

  const allMembers = useMemo(() => {
    const list = [...(state.data?.members || [])];
    list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' }));
    return list;
  }, [state.data?.members]);

  const filteredMembers = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return allMembers;
    return allMembers.filter((m) => {
      const name = (m.full_name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const role = roleLabel(m.role).toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [allMembers, teamSearch]);

  if (state.loading) return <LoadingState label="Loading team…" />;
  if (state.error) {
    return <ErrorState title="Could not load team" message={state.error} onRetry={() => window.location.reload()} />;
  }

  const d = state.data;
  if (!d) return null;

  const msg = (searchParams.get('message') || d.message || '').trim();
  const currentUserId = d.currentUserId;

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">My Team</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="team-search" className="sr-only">
            Search team by name, email, or role
          </label>
          <input
            id="team-search"
            type="search"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="Search…"
            autoComplete="off"
            className="w-full border-0 border-b border-slate-300 bg-transparent py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-0"
            aria-label="Search team by name, email, or role"
          />
          <span className="pointer-events-none absolute bottom-2 right-0 text-slate-400" aria-hidden>
            <IconSearch className="h-4 w-4" />
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 rounded-full bg-[#00684a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-2 sm:mb-px"
        >
          Create user
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950" role="status">
          {msg}
        </div>
      ) : null}

      {allMembers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center text-sm text-slate-500">
          No team members yet. Use <strong className="text-slate-700">Create user</strong> to add clients.
        </p>
      ) : filteredMembers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center text-sm text-slate-500">
          No one matches &ldquo;{teamSearch.trim()}&rdquo;. Try another name, email, or role.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              currentUserId={currentUserId}
              avatarListBust={avatarListBust}
              onOpenDetail={(m) => setDetailMember(m)}
              onOpenBasicInfo={(m) => setBasicInfoMember(m)}
            />
          ))}
        </div>
      )}

      {basicInfoMember ? (
        <div
          className="fixed inset-0 z-[84] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-basic-info-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setBasicInfoMember(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 id="team-basic-info-title" className="text-lg font-bold text-slate-900">
                Basic info
              </h2>
              <button
                type="button"
                onClick={() => setBasicInfoMember(null)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
              {d.companyName ? (
                <p className="text-xs text-slate-500">
                  Organization: <span className="font-medium text-slate-700">{d.companyName}</span>
                </p>
              ) : null}
              <dl className="space-y-3">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Full name</dt>
                  <dd className="font-medium text-slate-900">{basicInfoMember.full_name || '—'}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="break-all font-medium text-slate-900">{basicInfoMember.email || '—'}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="font-medium text-slate-900">{roleLabel(basicInfoMember.role)}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Account status</dt>
                  <dd className="font-medium text-slate-900">
                    {basicInfoMember.is_active ? 'Active' : 'Inactive'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Member since</dt>
                  <dd className="font-medium text-slate-900">{formatDate(basicInfoMember.created_at)}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Profile completed</dt>
                  <dd className="font-medium text-slate-900">
                    {basicInfoMember.profile_completed ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium text-slate-900">{basicInfoMember.phone?.trim() || '—'}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Emergency contact name</dt>
                  <dd className="font-medium text-slate-900">
                    {basicInfoMember.emergency_contact_name?.trim() || '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Emergency contact number</dt>
                  <dd className="font-medium text-slate-900">
                    {basicInfoMember.emergency_contact_phone?.trim() || '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-slate-500">Documents uploaded</dt>
                  <dd className="font-medium text-slate-900">
                    {Number(basicInfoMember.documentsUploaded) || 0}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-slate-500">Approval (decided)</dt>
                  <dd>
                    <StarRating
                      value={basicInfoMember.approvalStars}
                      className="inline-flex justify-end sm:justify-start [&>span]:text-base"
                    />
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="rounded-full bg-[#00684a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00523c]"
                  onClick={() => {
                    const m = basicInfoMember;
                    setBasicInfoMember(null);
                    setDetailMember(m);
                  }}
                >
                  View uploaded documents
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setBasicInfoMember(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailMember ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setDetailMember(null)}
          />
          <div className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 id="team-detail-title" className="truncate text-lg font-bold text-slate-900">
                  {detailMember.full_name || 'Team member'}
                </h2>
                <p className="mt-0.5 truncate text-sm text-slate-500">{detailMember.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>
                    <strong className="text-slate-800">{Number(detailMember.documentsUploaded) || 0}</strong> uploaded
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="shrink-0">Approval</span>
                    <StarRating
                      value={detailMember.approvalStars}
                      className="inline-flex items-center justify-start gap-px [&>span]:text-sm"
                    />
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {detailState.loading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading documents…</p>
              ) : detailState.error ? (
                <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">{detailState.error}</p>
              ) : !detailState.documents?.length ? (
                <p className="py-8 text-center text-sm text-slate-500">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detailState.documents.map((doc) => (
                    <li key={doc.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          to={`/documents/${doc.id}`}
                          className="font-medium text-[#00684a] hover:underline"
                          onClick={() => setDetailMember(null)}
                        >
                          {doc.title?.trim() || doc.original_filename || `Document #${doc.id}`}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">Uploaded {formatDate(doc.created_at)}</p>
                      </div>
                      <DocumentStatusBadge status={doc.approval_status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-create-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#00684a]/20 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white px-6 py-6 shadow-[0_4px_24px_rgba(15,23,42,0.12)] sm:px-8 sm:py-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="team-create-title" className="text-lg font-bold text-slate-900">
                  Add team member
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a client login with a temporary password. They complete profile and security on first sign-in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <form method="post" action="/company/team" className="space-y-4">
              <div>
                <label htmlFor="team-modal-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  id="team-modal-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  className={fieldClass}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label htmlFor="team-modal-fullName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Full name
                  </label>
                  <input id="team-modal-fullName" name="fullName" required autoComplete="off" className={fieldClass} />
                </div>
                <div className="sm:col-span-1">
                  <label
                    htmlFor="team-modal-tempPassword"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Temporary password
                  </label>
                  <input
                    id="team-modal-tempPassword"
                    name="tempPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-full bg-[#00684a] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c]"
                >
                  Create user
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
