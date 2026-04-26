/** Maps audit_logs.action codes to short labels and badge tones for the activity UI. */
const MAP = {
  LOGIN_SUCCESS: { label: 'Sign-in', tone: 'success' },
  LOGIN_FAILURE: { label: 'Sign-in failed', tone: 'danger' },
  LOGOUT: { label: 'Sign out', tone: 'neutral' },
  PASSWORD_CHANGED: { label: 'Password changed', tone: 'warning' },
  PASSWORD_RESET: { label: 'Password reset request', tone: 'warning' },
  '2FA_ENABLED': { label: '2FA enabled', tone: 'success' },
  '2FA_DISABLED': { label: '2FA disabled', tone: 'warning' },
  DOCUMENT_UPLOAD: { label: 'Document uploaded', tone: 'info' },
  DOCUMENT_DOWNLOAD: { label: 'Document downloaded', tone: 'neutral' },
  DOCUMENT_EDIT: { label: 'Document updated', tone: 'info' },
  DOCUMENT_DELETE: { label: 'Document deleted', tone: 'danger' },
  DOCUMENT_APPROVAL_SET: { label: 'Document approval', tone: 'info' },
  SYSTEM_CREATE_USER: { label: 'User created', tone: 'info' },
  SYSTEM_CREATE_CLIENT_ADMIN: { label: 'Client admin created', tone: 'info' },
  ADMIN_USER_DEACTIVATE: { label: 'User deactivated', tone: 'warning' },
  ADMIN_USER_REACTIVATE: { label: 'User reactivated', tone: 'success' },
  ADMIN_USER_DELETE: { label: 'User deleted', tone: 'danger' },
  ADMIN_PASSWORD_RESET: { label: 'Admin password reset', tone: 'warning' },
  CLIENT_ADMIN_CREATE_USER: { label: 'Team user created', tone: 'info' },
  CLIENT_ADMIN_DEACTIVATE: { label: 'Team user deactivated', tone: 'warning' },
  CLIENT_ADMIN_REACTIVATE: { label: 'Team user reactivated', tone: 'success' },
  CLIENT_ADMIN_PASSWORD_RESET: { label: 'Team password reset', tone: 'warning' },
  CLIENT_ADMIN_DELETE_USER: { label: 'Team user removed', tone: 'danger' },
  COMPANY_CREATE: { label: 'Organization created', tone: 'info' },
  COMPANY_DELETE: { label: 'Organization removed', tone: 'danger' },
  RATE_LIMIT_HIT: { label: 'Rate limit', tone: 'warning' },
};

const TONE_CLASS = {
  neutral: 'bg-slate-100 text-slate-800 ring-slate-200/80',
  success: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
  warning: 'bg-amber-100 text-amber-950 ring-amber-200/80',
  danger: 'bg-rose-100 text-rose-900 ring-rose-200/80',
  info: 'bg-sky-100 text-sky-950 ring-sky-200/80',
};

function titleCaseWords(s) {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * @param {string | null | undefined} action
 * @returns {{ label: string, badgeClass: string, code: string }}
 */
export function describeAuditAction(action) {
  const code = (action || '').trim() || '—';
  const meta = MAP[code];
  if (meta) {
    return {
      code,
      label: meta.label,
      badgeClass: `ring-1 ring-inset ${TONE_CLASS[meta.tone]}`,
    };
  }
  return {
    code,
    label: titleCaseWords(code.replace(/_/g, ' ')),
    badgeClass: `ring-1 ring-inset ${TONE_CLASS.neutral}`,
  };
}

/**
 * Visual category for activity log icons (create / delete / login / status / neutral).
 * @param {string | null | undefined} action
 * @returns {'create' | 'delete' | 'login' | 'status' | 'neutral'}
 */
export function auditActionIconKind(action) {
  const code = (action || '').trim();
  if (!code) return 'neutral';
  if (code === 'LOGIN_SUCCESS' || code === 'LOGIN_FAILURE') return 'login';
  if (code === 'DOCUMENT_APPROVAL_SET') return 'status';
  if (code.includes('DELETE') || code === 'COMPANY_DELETE') return 'delete';
  if (
    code.includes('CREATE') ||
    code.includes('UPLOAD') ||
    code.includes('_ENABLED') ||
    code === 'ADMIN_USER_REACTIVATE' ||
    code === 'CLIENT_ADMIN_REACTIVATE'
  ) {
    return 'create';
  }
  return 'neutral';
}
