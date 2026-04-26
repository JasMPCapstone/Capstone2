import { useRef } from 'react';
import { IconCamera } from '../icons/ShellIcons';
import UserAvatar from '../ui/UserAvatar';

function initialsFromDisplay(name, email) {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase() || '?';
}

/**
 * Hero banner + overlapping avatar + name + document count (+ optional save action).
 * @param {{
 *   displayName: string,
 *   subtitle?: string,
 *   documentCount: number,
 *   approvalStars?: number | null,
 *   hasAvatar?: boolean,
 *   avatarBust?: number,
 *   avatarBusy?: boolean,
 *   onAvatarFileChange?: (e: import('react').ChangeEvent<HTMLInputElement>) => void,
 *   onAvatarRemove?: () => void,
 *   primaryAction?: import('react').ReactNode,
 *   variant?: 'full' | 'compact',
 *   avatarUserId?: number,
 * }} props
 */
export default function ProfileCoverHeader({
  displayName,
  subtitle,
  documentCount,
  approvalStars,
  hasAvatar = false,
  avatarBust = 0,
  avatarBusy = false,
  onAvatarFileChange,
  onAvatarRemove,
  primaryAction,
  variant = 'full',
  avatarUserId,
}) {
  const tall = variant === 'full';
  const initial = initialsFromDisplay(displayName, '');
  const stars =
    approvalStars == null ? null : Math.max(0, Math.min(5, Math.round(Number(approvalStars) || 0)));
  const fileInputRef = useRef(null);
  const frameClass = tall ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16 sm:h-20 sm:w-20';
  const typoClass = tall ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl';
  const canEditPhoto = typeof onAvatarFileChange === 'function';

  return (
    <>
      <div
        className={`relative w-full overflow-hidden bg-gradient-to-br from-slate-800 via-[#0d3d2e] to-[#00684a] ${
          tall ? 'h-40 sm:h-48' : 'h-28 sm:h-36'
        }`}
      >
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
      </div>

      <div
        className={`relative flex flex-col gap-4 border-b border-slate-100 bg-white px-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 ${
          tall ? '-mt-14 sm:-mt-16' : '-mt-10 sm:-mt-12'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-end gap-4">
          <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
            <div className={`relative shrink-0 rounded-full ${frameClass}`}>
              <UserAvatar
                initials={initial}
                hasPhoto={hasAvatar}
                cacheBust={avatarBust}
                userId={avatarUserId}
                sizeClass={`h-full w-full border-4 border-white ${typoClass}`}
              />
              {canEditPhoto ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={avatarBusy}
                    onChange={(e) => {
                      onAvatarFileChange(e);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    aria-label={avatarBusy ? 'Updating profile photo' : 'Change profile photo'}
                    aria-busy={avatarBusy}
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-x-0 bottom-0 top-1/2 z-[2] flex items-end justify-center rounded-b-full bg-gradient-to-t from-black/60 via-black/30 to-transparent pb-2 text-white outline-none transition hover:from-black/72 hover:via-black/40 focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <IconCamera className="drop-shadow" />
                  </button>
                </>
              ) : null}
            </div>
            {canEditPhoto && hasAvatar && typeof onAvatarRemove === 'function' ? (
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => onAvatarRemove()}
                className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-rose-700 hover:decoration-rose-400 disabled:opacity-50"
              >
                Remove photo
              </button>
            ) : null}
            {canEditPhoto && avatarBusy ? (
              <span className="text-center text-xs text-slate-500 sm:text-left">Updating…</span>
            ) : null}
          </div>
          <div className="min-w-0 pb-0.5">
            <h2 className={`font-bold tracking-tight text-slate-900 ${tall ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
              {displayName || 'Profile'}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
            <p
              className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[#00684a] ${tall ? 'text-sm sm:text-base' : 'text-sm'}`}
            >
              <span>
                {documentCount} document{documentCount === 1 ? '' : 's'} uploaded so far
              </span>
              {stars != null ? (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-500" title={`${stars} of 5 approval stars`}>
                    <span aria-hidden>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={i < stars ? 'text-amber-500' : 'text-slate-200'}>
                          ★
                        </span>
                      ))}
                    </span>
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {primaryAction ? <div className="flex shrink-0 items-center sm:pb-1">{primaryAction}</div> : null}
      </div>
    </>
  );
}
