/** Outline icons for app shell navigation (stroke via currentColor). */

/** Sidebar row icons: ~14px to align with text-sm labels (passed className only sets color). */
const S14 = 'inline-block h-[0.875rem] w-[0.875rem] shrink-0';

function shell(sizeClass, className) {
  return `${sizeClass} ${className || ''}`.trim();
}

export function IconDashboard({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDocuments({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h8" strokeLinecap="round" />
    </svg>
  );
}

export function IconUpload({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

export function IconSettings({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconAdmin({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTeam({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconHelp({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.95-.5c0 2-2.5 2-2.5 4M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

const S16 = 'inline-block h-4 w-4 shrink-0';

/** Header bell — slightly larger than sidebar for visibility. */
export function IconBell({ className = '' }) {
  return (
    <svg className={shell(S16, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M18 16H6l1-1.5V11a6 6 0 1 1 12 0v3.5L18 16z" strokeLinejoin="round" />
      <path d="M10 20h4" strokeLinecap="round" />
    </svg>
  );
}

/** Change-photo control on profile avatar (half-circle overlay). */
export function IconCamera({ className = '' }) {
  return (
    <svg
      className={shell('inline-block h-5 w-5 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.25" />
    </svg>
  );
}

export function IconLogout({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const S12 = 'inline-block h-3 w-3 shrink-0';

/** Profile menu chevron */
export function IconChevronDown({ className = '' }) {
  return (
    <svg className={shell(S12, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBuilding({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 21V8l8-4 8 4v13M9 21v-6h6v6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUsers({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export function IconAudit({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      <path d="M18 16l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRoles({ className = '' }) {
  return (
    <svg className={shell(S14, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" strokeLinejoin="round" />
    </svg>
  );
}
