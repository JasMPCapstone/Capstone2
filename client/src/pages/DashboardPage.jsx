import { createElement, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchAdmin, fetchCompany, fetchDocuments } from '../lib/api';
import { formatDate } from '../lib/format';
import { isSystemAdmin, isClientAdmin, isStaff, roleLabel } from '../lib/roles';
import { Card, CardHeader } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import DocumentStatusBadge from '../components/ui/DocumentStatusBadge';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import DocumentResubmitModal, { ManagerDocActionButtons } from '../components/documents/DocumentResubmitModal';
import RejectionReasonDialog from '../components/ui/RejectionReasonDialog';
import PaginationBar from '../components/ui/PaginationBar';
import UserAvatar from '../components/ui/UserAvatar';

function performerInitials(name) {
  const s = (name || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[parts.length - 1][0] || '';
    return (a + b).toUpperCase() || '?';
  }
  return (s[0] || '?').toUpperCase();
}

function IconBuilding({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 21V8l8-4 8 4v13M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}

function IconDocument({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}

function IconTrend({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCircleCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCircleX({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" />
    </svg>
  );
}

/** Line star icon (matches other dashboard KPI icons). */
function IconStarOutline({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M12 2l2.2 5.2 5.6.5-4.2 3.6 1.3 5.5L12 14.9 5.1 16.8l1.3-5.5L2.2 7.7l5.6-.5L12 2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const kpiIconClass = 'pointer-events-none absolute right-4 top-4 h-7 w-7 text-[#00684a] opacity-90';

/** Tighter `top` than {@link kpiIconClass} so icons line up with tiles that use `<Link>` (flip card uses `<button>`). */
const kpiIconClassFlip = 'pointer-events-none absolute right-4 top-3 h-7 w-7 text-[#00684a] opacity-90';

const kpiCardClass =
  'relative block overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-[box-shadow,transform] duration-200 hover:shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-2';

/** Client / org-scoped KPI tile — same chrome as {@link AdminOverviewCards}. */
function ManagerKpiCard({ href, icon: SvgIcon, label, kicker, value, ariaLabel }) {
  return (
    <Link to={href} className={kpiCardClass} aria-label={ariaLabel}>
      {createElement(SvgIcon, { className: kpiIconClass })}
      <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {kicker ? (
        <p className="mt-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{kicker}</p>
      ) : null}
      <p className="mt-2 text-4xl font-semibold tabular-nums text-[#00684a]">{value}</p>
    </Link>
  );
}

/**
 * Same KPI card pattern as system admin; opacity crossfade (no 3D) for correct click targets.
 *
 * @param {{ topPerformer: { id: number, hasAvatar?: boolean, name: string, approvalStars: number, documentsUploaded: number }, worstPerformer: { id: number, hasAvatar?: boolean, name: string, approvalStars: number, documentsUploaded: number } }} props
 */
function FlipTopWorstCard({ topPerformer, worstPerformer }) {
  const [flipped, setFlipped] = useState(false);
  const samePerson = topPerformer.id === worstPerformer.id;
  const topStars = Math.max(0, Math.min(5, Math.round(topPerformer.approvalStars)));
  const lowStars = Math.max(0, Math.min(5, Math.round(worstPerformer.approvalStars)));

  const fade = 'transition-opacity duration-300 ease-out';

  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      className={`${kpiCardClass} w-full cursor-pointer text-left touch-manipulation [font:inherit]`}
      aria-pressed={flipped}
      title={flipped ? 'Show best performer' : 'Show who needs the most support'}
      aria-label={
        flipped
          ? 'Showing teammate who needs the most support. Activate to show the best performer.'
          : 'Showing best performer. Activate to show who needs the most support.'
      }
    >
      {/*
        Grid stacks both faces in one cell so layout matches ManagerKpiCard (icon absolute to this button, not to an inner absolute layer).
      */}
      <div className="grid">
        <div
          className={`col-start-1 row-start-1 min-w-0 ${fade} ${flipped ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          aria-hidden={flipped}
        >
          <IconStarOutline className={kpiIconClassFlip} />
          <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">Best performer</p>
          <p className="mt-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Documents uploaded</p>
          <p className="mt-2 pr-12 text-4xl font-semibold tabular-nums text-[#00684a]">{topPerformer.documentsUploaded}</p>
          <div className="mt-3 flex min-w-0 items-start gap-2.5 pr-12">
            <UserAvatar
              userId={topPerformer.id}
              hasPhoto={!!topPerformer.hasAvatar}
              initials={performerInitials(topPerformer.name)}
              sizeClass="h-8 w-8 shrink-0 text-[9px]"
              tone="brand"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-medium text-slate-800" title={topPerformer.name}>
                {topPerformer.name}
              </p>
              <p
                className="mt-1 text-[11px] leading-none tracking-tight text-amber-500"
                aria-label={`${topStars} of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < topStars ? 'text-amber-500' : 'text-slate-200'}>
                    ★
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 min-w-0 ${fade} ${flipped ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={!flipped}
        >
          <IconTrend className={kpiIconClassFlip} />
          {samePerson ? (
            <>
              <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">Needs support</p>
              <p className="mt-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Team comparison</p>
              <p className="mt-2 pr-12 text-sm leading-snug text-slate-600">
                Only one team member is in this ranking. Add more staff to compare who needs the most help.
              </p>
            </>
          ) : (
            <>
              <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">Needs support</p>
              <p className="mt-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Documents uploaded</p>
              <p className="mt-2 pr-12 text-4xl font-semibold tabular-nums text-[#00684a]">{worstPerformer.documentsUploaded}</p>
              <div className="mt-3 flex min-w-0 items-start gap-2.5 pr-12">
                <UserAvatar
                  userId={worstPerformer.id}
                  hasPhoto={!!worstPerformer.hasAvatar}
                  initials={performerInitials(worstPerformer.name)}
                  sizeClass="h-8 w-8 shrink-0 text-[9px]"
                  tone="surface"
                />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-medium text-slate-800" title={worstPerformer.name}>
                    {worstPerformer.name}
                  </p>
                  <p
                    className="mt-1 text-[11px] leading-none tracking-tight text-amber-600"
                    aria-label={`${lowStars} of 5 stars`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < lowStars ? 'text-amber-600' : 'text-slate-200'}>
                        ★
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function AdminOverviewCards({ dash }) {
  const deltaClass =
    dash.docUploadDeltaClass === 'is-positive'
      ? 'text-emerald-700'
      : dash.docUploadDeltaClass === 'is-negative'
        ? 'text-rose-700'
        : 'text-slate-600';

  const uploadActivityLink = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const qs = new URLSearchParams({
      dateFrom: ymd(start),
      dateTo: ymd(end),
      event: 'DOCUMENT_UPLOAD',
    });
    return `/admin/audit?${qs.toString()}`;
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link
        to="/admin/user-management/organizations"
        className={kpiCardClass}
        aria-label={`Organizations: ${dash.companyCount}. Open user management, organizations.`}
      >
        <IconBuilding className={kpiIconClass} />
        <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">Organizations</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-[#00684a]">{dash.companyCount}</p>
      </Link>
      <Link
        to="/admin/user-management/users"
        className={kpiCardClass}
        aria-label={`All users: ${dash.userCount}. Open user management, users.`}
      >
        <IconUsers className={kpiIconClass} />
        <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">All users</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-[#00684a]">{dash.userCount}</p>
      </Link>
      <Link
        to="/documents?tab=review"
        className={kpiCardClass}
        aria-label={`New documents awaiting approval: ${dash.pendingApprovalCount}. Open document library pending tab.`}
      >
        <IconDocument className={kpiIconClass} />
        <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">New documents</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Awaiting approval</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-[#00684a]">{dash.pendingApprovalCount}</p>
      </Link>
      <Link
        to={uploadActivityLink}
        className={kpiCardClass}
        aria-label={`Uploads in the last 30 days: ${dash.docUploadsLast30Days ?? 0}. Open activity log for document uploads in this period.`}
      >
        <IconTrend className={kpiIconClass} />
        <p className="pr-12 text-xs font-semibold uppercase tracking-wide text-slate-500">Upload rate</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Last 30 days</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-[#00684a]">{dash.docUploadsLast30Days ?? 0}</p>
        {dash.docUploadDeltaText ? (
          <p className={`mt-2 text-sm font-medium ${deltaClass}`}>{dash.docUploadDeltaText}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No comparison data</p>
        )}
      </Link>
    </div>
  );
}

/**
 * @param {{ stats: { total: number, pending: number | null, approved: number | null, rejected: number | null }, hasApproval: boolean, manager: boolean, team: object | null, topPerformer: object | null, worstPerformer: object | null }} props
 */
function OrgScopedOverviewCards({ stats, hasApproval, manager, team, topPerformer, worstPerformer }) {
  if (!hasApproval) {
    const t = stats.total;
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ManagerKpiCard
          href="/documents"
          icon={IconDocument}
          label="Documents"
          kicker="In your library"
          value={t}
          ariaLabel={`Documents: ${t}. Open document library.`}
        />
      </div>
    );
  }

  const pending = stats.pending ?? 0;
  const approved = stats.approved ?? 0;
  const rejected = stats.rejected ?? 0;
  const members = team?.members ?? [];
  const memberTotal = members.length;
  const memberActive = members.filter((m) => m.is_active).length;
  const memberKicker =
    memberTotal === 0
      ? 'Team roster'
      : memberActive === memberTotal
        ? 'In your organization'
        : `${memberActive} active · ${memberTotal} total`;
  const showFlip = !!(manager && topPerformer && worstPerformer);
  const libraryKicker = `${stats.total} in library`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {manager ? (
        <ManagerKpiCard
          href="/company/team"
          icon={IconUsers}
          label="Employees"
          kicker={memberKicker}
          value={memberTotal}
          ariaLabel={`Employees: ${memberTotal} in organization. Open team.`}
        />
      ) : (
        <ManagerKpiCard
          href="/documents"
          icon={IconDocument}
          label="Documents"
          kicker="In your library"
          value={stats.total}
          ariaLabel={`Documents: ${stats.total}. Open document library.`}
        />
      )}
      <ManagerKpiCard
        href="/documents?tab=review"
        icon={IconClock}
        label="Pending"
        kicker="Awaiting approval"
        value={pending}
        ariaLabel={`Pending documents: ${pending}. Open review queue.`}
      />
      <ManagerKpiCard
        href="/documents?tab=approved"
        icon={IconCircleCheck}
        label="Approved"
        kicker={libraryKicker}
        value={approved}
        ariaLabel={`Approved documents: ${approved}. Open approved list.`}
      />
      {showFlip ? (
        <FlipTopWorstCard topPerformer={topPerformer} worstPerformer={worstPerformer} />
      ) : (
        <ManagerKpiCard
          href="/documents?tab=rejected"
          icon={IconCircleX}
          label="Rejected"
          kicker={libraryKicker}
          value={rejected}
          ariaLabel={`Rejected documents: ${rejected}. Open rejected list.`}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({
    loading: true,
    error: null,
    payload: null,
    adminDash: null,
    pendingDocs: [],
    /** Client admin: `/api/company/team` payload for top-performer card. */
    team: null,
  });
  const [preview, setPreview] = useState(null);
  /** System admin: reject-with-reason modal (POST to HTML route). */
  const [rejectModal, setRejectModal] = useState(null);
  /** Client admin: update & resubmit modal. */
  const [resubmitDoc, setResubmitDoc] = useState(null);
  /** Client admin: full rejection note (dashboard table). */
  const [rejectionDialog, setRejectionDialog] = useState(null);
  /** Admin “Recent documents awaiting approval” table (10 per page). */
  const [pendingPage, setPendingPage] = useState(1);

  const admin = user && isSystemAdmin(user.role);
  const manager = user && isClientAdmin(user.role);
  const staff = user && isStaff(user.role);

  const flashMessage = useMemo(() => (searchParams.get('message') || '').trim(), [searchParams]);
  const flashError = useMemo(() => (searchParams.get('error') || '').trim(), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setState((s) => ({ ...s, loading: true, error: null }));

      if (isSystemAdmin(user.role)) {
        const [dRes, pRes] = await Promise.all([
          fetchAdmin('/dashboard'),
          fetchDocuments(`?tab=review&page=${pendingPage}&pageSize=10`),
        ]);
        if (cancelled) return;
        if (dRes.kind !== 'ok') {
          setState({
            loading: false,
            error: dRes.kind === 'error' ? dRes.error : 'Could not load dashboard.',
            payload: null,
            adminDash: null,
            pendingDocs: [],
            team: null,
          });
          return;
        }
        if (pRes.kind !== 'ok' && pRes.kind !== 'unauthorized' && pRes.kind !== 'redirect') {
          setState({
            loading: false,
            error: pRes.kind === 'error' ? pRes.error : 'Could not load pending documents.',
            payload: null,
            adminDash: dRes.data,
            pendingDocs: [],
            team: null,
          });
          return;
        }
        const pendingData = pRes.kind === 'ok' ? pRes.data : { documents: [], hasApprovalStatus: true };
        setState({
          loading: false,
          error: null,
          payload: pendingData,
          adminDash: dRes.data,
          pendingDocs: pendingData.documents || [],
          team: null,
        });
        return;
      }

      const result = await fetchDocuments('?page=1&pageSize=500');
      if (cancelled) return;
      if (result.kind === 'redirect' || result.kind === 'unauthorized') {
        setState({ loading: false, error: null, payload: null, adminDash: null, pendingDocs: [], team: null });
        return;
      }
      if (result.kind === 'error') {
        setState({ loading: false, error: result.error, payload: null, adminDash: null, pendingDocs: [], team: null });
        return;
      }
      let team = null;
      if (isClientAdmin(user.role)) {
        const tRes = await fetchCompany('/team');
        if (!cancelled && tRes.kind === 'ok') team = tRes.data;
      }
      setState({ loading: false, error: null, payload: result.data, adminDash: null, pendingDocs: [], team });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.role, pendingPage, location.pathname]);

  useEffect(() => {
    if (!rejectModal) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setRejectModal(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [rejectModal]);

  const docs = useMemo(() => state.payload?.documents ?? [], [state.payload]);
  const hasApproval = !!state.payload?.hasApprovalStatus;

  const stats = useMemo(() => {
    const total = docs.length;
    if (!hasApproval) {
      return { total, pending: null, approved: null, rejected: null };
    }
    const upper = (d) => String(d.approval_status || '').toUpperCase();
    return {
      total,
      pending: docs.filter((d) => upper(d) === 'PENDING').length,
      approved: docs.filter((d) => upper(d) === 'APPROVED').length,
      rejected: docs.filter((d) => upper(d) === 'REJECTED').length,
    };
  }, [docs, hasApproval]);

  /** Client admin: best staff member by approval stars, then document count (matches team API logic). */
  const topPerformer = useMemo(() => {
    const members = state.team?.members;
    if (!members?.length) return null;
    const eligible = members.filter((m) => m.role === 'CLIENT' && m.is_active);
    const pool = eligible.length ? eligible : members.filter((m) => m.is_active);
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => {
      const sa = Number(a.approvalStars) || 0;
      const sb = Number(b.approvalStars) || 0;
      if (sb !== sa) return sb - sa;
      const da = Number(a.documentsUploaded) || 0;
      const db = Number(b.documentsUploaded) || 0;
      if (db !== da) return db - da;
      return String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''), undefined, {
        sensitivity: 'base',
      });
    });
    const m = sorted[0];
    return {
      id: m.id,
      hasAvatar: !!m.hasAvatar,
      name: (m.full_name || m.email || 'Team member').toString(),
      approvalStars: Number(m.approvalStars) || 0,
      documentsUploaded: Number(m.documentsUploaded) || 0,
    };
  }, [state.team]);

  const worstPerformer = useMemo(() => {
    const members = state.team?.members;
    if (!members?.length) return null;
    const eligible = members.filter((m) => m.role === 'CLIENT' && m.is_active);
    const pool = eligible.length ? eligible : members.filter((m) => m.is_active);
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => {
      const sa = Number(a.approvalStars) || 0;
      const sb = Number(b.approvalStars) || 0;
      if (sa !== sb) return sa - sb;
      const da = Number(a.documentsUploaded) || 0;
      const db = Number(b.documentsUploaded) || 0;
      if (da !== db) return da - db;
      return String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''), undefined, {
        sensitivity: 'base',
      });
    });
    const m = sorted[0];
    return {
      id: m.id,
      hasAvatar: !!m.hasAvatar,
      name: (m.full_name || m.email || 'Team member').toString(),
      approvalStars: Number(m.approvalStars) || 0,
      documentsUploaded: Number(m.documentsUploaded) || 0,
    };
  }, [state.team]);

  const recentNonAdmin = useMemo(() => docs.slice(0, 8), [docs]);

  /** Client Admin: surface only items still pending or rejected (with rejection note when applicable). */
  const managerAttentionDocs = useMemo(() => {
    if (!manager || !hasApproval) return [];
    const upper = (d) => String(d.approval_status || '').toUpperCase();
    return docs
      .filter((d) => upper(d) === 'PENDING' || upper(d) === 'REJECTED')
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 20);
  }, [manager, hasApproval, docs]);

  const pendingTotal = state.payload?.total ?? state.pendingDocs.length;
  const pendingPageSize = state.payload?.pageSize ?? 10;
  const pendingTotalPages = state.payload?.totalPages ?? 1;
  const pendingCurrentPage = state.payload?.page ?? pendingPage;

  const recentColumnsNonAdmin = useMemo(() => {
    const cols = [
      {
        id: 'name',
        header: 'Document',
        className: 'max-w-xs',
        cell: (row) => (
          <Link to={`/documents/${row.id}`} className="font-medium text-[#00684a] hover:underline">
            {(row.title || row.original_filename || 'Untitled').toString()}
          </Link>
        ),
      },
    ];
    if (admin) {
      cols.push({
        id: 'org',
        header: 'Organization',
        cell: (row) => <span className="text-slate-600">{(row.company_name || '—').toString()}</span>,
      });
    }
    if (hasApproval) {
      cols.push({
        id: 'status',
        header: 'Status',
        cell: (row) => <DocumentStatusBadge status={row.approval_status} />,
      });
    }
    cols.push({
      id: 'updated',
      header: 'Last updated',
      cell: (row) => <span className="text-slate-600">{formatDate(row.updated_at)}</span>,
    });
    return cols;
  }, [admin, hasApproval]);

  const managerAttentionColumns = useMemo(() => {
    const cols = [
      {
        id: 'name',
        header: 'Document',
        className: 'max-w-xs',
        cell: (row) => (
          <Link to={`/documents/${row.id}`} className="font-medium text-[#00684a] hover:underline">
            {(row.title || row.original_filename || 'Untitled').toString()}
          </Link>
        ),
      },
      {
        id: 'updated',
        header: 'Last updated',
        cell: (row) => <span className="text-slate-600 tabular-nums">{formatDate(row.updated_at)}</span>,
      },
    ];
    if (state.payload?.hasDocumentType !== false) {
      cols.push({
        id: 'type',
        header: 'Type',
        className: 'max-w-[11rem]',
        cell: (row) => (
          <span className="line-clamp-2 text-slate-700" title={(row.document_type || '').toString()}>
            {(row.document_type || '—').toString()}
          </span>
        ),
      });
    }
    cols.push(
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <DocumentStatusBadge status={row.approval_status} />,
      },
      {
        id: 'responsible',
        header: 'Responsible',
        className: 'max-w-[10rem]',
        cell: (row) => <span className="text-slate-700">{(row.owner_name || '—').toString()}</span>,
      },
      {
        id: 'rejectReason',
        header: 'Rejection reason',
        className: 'max-w-[12rem]',
        cell: (row) => {
          const u = String(row.approval_status || '').toUpperCase();
          if (u !== 'REJECTED') {
            return <span className="text-slate-400">—</span>;
          }
          const docTitle = (row.title || row.original_filename || 'Document').toString();
          const reason = (row.approval_rejection_reason || '').toString().trim();
          if (!reason) {
            return <span className="text-slate-400">—</span>;
          }
          const preview = reason.length > 15 ? `${reason.slice(0, 15)}…` : reason;
          return (
            <button
              type="button"
              onClick={() => setRejectionDialog({ documentTitle: docTitle, reason })}
              className="max-w-full cursor-pointer text-left text-sm font-medium text-slate-800 transition-colors hover:text-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-1"
            >
              <span className="border-b border-dashed border-slate-300 hover:border-[#00684a]">{preview}</span>
            </button>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        className: 'w-[1%] whitespace-nowrap',
        cell: (row) => <ManagerDocActionButtons row={row} onResubmit={setResubmitDoc} />,
      }
    );
    return cols;
  }, [state.payload?.hasDocumentType]);

  const pendingColumns = useMemo(() => {
    const hasDocType = state.payload?.hasDocumentType !== false;
    const cols = [
      {
        id: 'name',
        header: 'Document name',
        className: 'max-w-xs',
        cell: (row) => (
          <button
            type="button"
            className="text-left font-medium text-[#00684a] hover:underline"
            onClick={() =>
              setPreview({
                id: row.id,
                title: (row.title || row.original_filename || 'Document').toString(),
              })
            }
          >
            {(row.title || row.original_filename || 'Untitled').toString()}
          </button>
        ),
      },
      {
        id: 'org',
        header: 'Organization',
        cell: (row) => <span className="text-slate-600">{(row.company_name || '—').toString()}</span>,
      },
    ];
    if (hasDocType) {
      cols.push({
        id: 'type',
        header: 'Type',
        className: 'max-w-[11rem]',
        cell: (row) => (
          <span className="line-clamp-2 text-slate-700" title={(row.document_type || '').toString()}>
            {(row.document_type || '—').toString()}
          </span>
        ),
      });
    }
    cols.push(
      {
        id: 'owner',
        header: 'Responsible',
        className: 'max-w-[9rem]',
        cell: (row) => <span className="text-slate-700">{(row.owner_name || '—').toString()}</span>,
      },
      {
        id: 'date',
        header: 'Date',
        cell: (row) => <span className="text-slate-600 tabular-nums">{formatDate(row.updated_at)}</span>,
      }
    );
    if (hasApproval) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        className: 'whitespace-nowrap',
        cell: (row) => {
          const cid = row.owner_company_id;
          if (cid == null || cid === '') {
            return <span className="text-xs text-slate-400">—</span>;
          }
          const docTitle = (row.title || row.original_filename || 'Untitled').toString();
          const orgName = (row.company_name || '').toString();
          return (
            <div className="inline-flex flex-nowrap items-center gap-2">
              <form
                method="post"
                action={`/admin/companies/${cid}/documents/${row.id}/approval`}
                className="inline-flex shrink-0"
              >
                <input type="hidden" name="approval_status" value="APPROVED" />
                <input type="hidden" name="redirect" value="/" />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-[#00684a] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#00523c]"
                >
                  Approve
                </button>
              </form>
              <button
                type="button"
                className="shrink-0 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                onClick={() =>
                  setRejectModal({
                    companyId: cid,
                    docId: row.id,
                    title: docTitle,
                    organization: orgName,
                  })
                }
              >
                Reject
              </button>
            </div>
          );
        },
      });
    }
    return cols;
  }, [hasApproval, state.payload?.hasDocumentType]);

  if (state.loading) {
    return <LoadingState label="Loading dashboard…" />;
  }

  if (state.error) {
    return (
      <ErrorState title="Could not load dashboard data" message={state.error} onRetry={() => window.location.reload()} />
    );
  }

  let subtitle = `${user?.fullName ? `Welcome back, ${user.fullName}.` : 'Welcome.'} You are signed in as ${roleLabel(user?.role)}.`;
  if (staff) {
    subtitle += ' You see documents you uploaded.';
  } else if (manager) {
    subtitle += ' Documents are scoped to your organization.';
  } else if (admin) {
    subtitle += ' You can review submissions across all organizations.';
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={subtitle} />

      {flashMessage ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{flashMessage}</div>
      ) : null}

      {flashError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          {flashError}
        </div>
      ) : null}

      {admin && state.adminDash ? <AdminOverviewCards dash={state.adminDash} /> : null}

      {!admin ? (
        <OrgScopedOverviewCards
          stats={stats}
          hasApproval={hasApproval}
          manager={!!manager}
          team={state.team}
          topPerformer={manager && hasApproval ? topPerformer : null}
          worstPerformer={manager && hasApproval ? worstPerformer : null}
        />
      ) : null}

      {admin && hasApproval ? (
        <Card>
          <CardHeader
            title="Recent documents awaiting approval"
            description="Pending submissions across organizations."
            action={
              <Link to="/documents?tab=review" className="text-sm font-medium text-[#00684a] hover:underline">
                View all in library
              </Link>
            }
          />
          <DataTable
            flush
            columns={pendingColumns}
            rows={state.pendingDocs}
            rowId={(r) => r.id}
            emptyMessage="No documents awaiting approval."
          />
          <div className="border-t border-slate-100 px-5 py-4">
            <PaginationBar
              currentPage={pendingCurrentPage}
              totalPages={pendingTotalPages}
              totalRows={pendingTotal}
              pageSize={pendingPageSize}
              onPageChange={setPendingPage}
            />
          </div>
        </Card>
      ) : admin ? (
        <Card>
          <CardHeader title="Reviews" description="Approval workflow" />
          <p className="px-5 py-4 text-sm text-slate-600">
            Document approval is not enabled in the database, so the review queue is unavailable. Open the{' '}
            <Link to="/documents" className="font-medium text-[#00684a] hover:underline">
              document library
            </Link>{' '}
            to browse files.
          </p>
        </Card>
      ) : manager && hasApproval ? (
        <Card>
          <CardHeader
            title="Pending and rejected documents"
            description="Items in your organization that are awaiting system administrator review or were sent back with a reason."
          />
          <DataTable
            flush
            columns={managerAttentionColumns}
            rows={managerAttentionDocs}
            rowId={(r) => r.id}
            emptyMessage="No pending or rejected documents. Approved items stay in the document library."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Recent documents"
            description={
              manager
                ? "Most recently updated in your organization's library."
                : 'Most recently updated from your uploads.'
            }
            action={
              <Link to="/documents" className="text-sm font-medium text-[#00684a] hover:underline">
                View all in library
              </Link>
            }
          />
          <DataTable
            flush
            columns={recentColumnsNonAdmin}
            rows={recentNonAdmin}
            rowId={(r) => r.id}
            emptyMessage="No documents yet. Upload from the sidebar."
          />
        </Card>
      )}

      {!admin && manager && resubmitDoc ? (
        <DocumentResubmitModal document={resubmitDoc} onClose={() => setResubmitDoc(null)} />
      ) : null}

      {!admin && manager ? (
        <RejectionReasonDialog
          open={!!rejectionDialog}
          documentTitle={rejectionDialog?.documentTitle}
          reason={rejectionDialog?.reason ?? ''}
          onClose={() => setRejectionDialog(null)}
        />
      ) : null}

      {admin && rejectModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-reject-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setRejectModal(null)}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 id="dashboard-reject-title" className="text-lg font-semibold text-slate-900">
                Reject document
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{rejectModal.title}</span>
                {rejectModal.organization ? (
                  <>
                    <span className="text-slate-400"> · </span>
                    <span>{rejectModal.organization}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                The organization&apos;s client admins will see this reason on the dashboard and document detail.
              </p>
            </div>
            <form
              method="post"
              action={`/admin/companies/${rejectModal.companyId}/documents/${rejectModal.docId}/approval`}
              className="px-5 py-4"
            >
              <input type="hidden" name="approval_status" value="REJECTED" />
              <input type="hidden" name="redirect" value="/" />
              <label htmlFor="dashboard-reject-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason for rejection
              </label>
              <textarea
                id="dashboard-reject-reason"
                name="rejectionReason"
                required
                rows={4}
                maxLength={4000}
                autoComplete="off"
                placeholder="Explain clearly what needs to change or why this cannot be approved…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-1 focus:ring-[#00684a]"
              />
              <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setRejectModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                >
                  Confirm rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {preview ? (
        <DocumentPreviewModal
          documentId={preview.id}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
