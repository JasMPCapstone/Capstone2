import { useEffect, useState } from 'react';

/**
 * Round avatar: profile photo when hasPhoto, else initials.
 * When `userId` is set, loads `/api/users/:id/avatar` (authorized viewers only). Otherwise uses signed-in `/api/profile/avatar`.
 * @param {{ initials: string, hasPhoto: boolean, cacheBust?: number, sizeClass: string, tone?: 'surface' | 'brand', userId?: number }} props
 */
export default function UserAvatar({ initials, hasPhoto, cacheBust = 0, sizeClass, tone = 'surface', userId }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [hasPhoto, cacheBust, userId]);

  const showImg = hasPhoto && !imgFailed;
  const uid = userId != null && Number.isFinite(Number(userId)) ? Number(userId) : null;
  const src =
    uid != null ? `/api/users/${uid}/avatar?v=${cacheBust}` : `/api/profile/avatar?v=${cacheBust}`;
  const toneCls =
    tone === 'brand'
      ? 'bg-[#00684a] font-semibold text-white ring-1 ring-white/25'
      : 'bg-slate-100 font-semibold text-[#00684a] shadow-md ring-1 ring-slate-200/80';

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${toneCls} ${sizeClass}`}>
      {showImg ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <span className={`relative z-[1] ${showImg ? 'sr-only' : ''}`} aria-hidden={showImg}>
        {initials}
      </span>
    </div>
  );
}
