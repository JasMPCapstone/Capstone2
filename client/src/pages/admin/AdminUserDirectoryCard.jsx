import { Link } from 'react-router-dom';
import UserAvatar from '../../components/ui/UserAvatar';
import { roleLabel } from '../../lib/roles';

function initialsFromUser(row) {
  const s = (row.full_name || row.email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase() || '?';
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

const profileHref = (userId) => `/admin/user-management/users/${userId}#user_documents`;

/**
 * User card for system admin directory — profile opens user detail with their documents.
 */
export default function AdminUserDirectoryCard({ user }) {
  const name = user.full_name || '—';
  const roleText = roleLabel(user.role);
  const docCount = Number(user.documentsUploaded) || 0;
  const stars = Number(user.approvalStars) || 0;

  return (
    <article className="relative flex min-w-[14.5rem] max-w-[16rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_28px_rgba(15,23,42,0.1)] sm:min-w-[15.5rem]">
      <div className="absolute right-3 top-3 z-10">
        <span
          className={`text-xs font-semibold ${user.is_active ? 'text-[#00684a]' : 'text-slate-400'}`}
          title={user.is_active ? 'Account is active' : 'Account is inactive'}
        >
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <Link
        to={profileHref(user.id)}
        className="flex flex-1 flex-col items-center rounded-t-2xl px-4 pb-3 pt-9 text-center outline-none transition-colors hover:bg-slate-50/60 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        aria-label={`${name}: view profile and documents`}
      >
        <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-full shadow-inner ring-1 ring-slate-200/80">
          <UserAvatar
            initials={initialsFromUser(user)}
            hasPhoto={!!user.hasAvatar}
            userId={Number(user.id)}
            sizeClass="h-full w-full border-2 border-white text-lg font-bold tracking-tight"
            tone="surface"
          />
        </div>
        <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-slate-900">{name}</h3>
        <p className="mt-1.5 text-sm font-medium leading-snug text-slate-600">{roleText}</p>
        <p className="mt-1 break-all text-xs leading-relaxed text-slate-500">{user.email}</p>
        <p className="mt-2.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{docCount}</span> document{docCount === 1 ? '' : 's'} uploaded
        </p>
        <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">Approval (decided)</p>
        <div className="mt-1.5 w-full">
          <StarRating value={stars} />
        </div>
      </Link>

      <div className="border-t border-slate-100 bg-slate-50/80">
        <Link
          to={profileHref(user.id)}
          className="flex min-h-[2.75rem] w-full items-center justify-center py-2.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a]/40 focus-visible:ring-inset"
          title={`Profile and documents for ${name}`}
          aria-label={`Open profile and documents for ${name}`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
