/**
 * Event types for audit log filters and labels.
 * Keep aligned with client `auditLabels.js` MAP keys and copy.
 */
const AUDIT_EVENT_OPTIONS = [
  { value: '2FA_DISABLED', label: '2FA disabled' },
  { value: '2FA_ENABLED', label: '2FA enabled' },
  { value: 'ADMIN_PASSWORD_RESET', label: 'Admin password reset' },
  { value: 'ADMIN_USER_DEACTIVATE', label: 'User deactivated' },
  { value: 'ADMIN_USER_DELETE', label: 'User deleted' },
  { value: 'ADMIN_USER_REACTIVATE', label: 'User reactivated' },
  { value: 'CLIENT_ADMIN_CREATE_USER', label: 'Team user created' },
  { value: 'CLIENT_ADMIN_DEACTIVATE', label: 'Team user deactivated' },
  { value: 'CLIENT_ADMIN_PASSWORD_RESET', label: 'Team password reset' },
  { value: 'CLIENT_ADMIN_REACTIVATE', label: 'Team user reactivated' },
  { value: 'COMPANY_CREATE', label: 'Organization created' },
  { value: 'COMPANY_DELETE', label: 'Organization removed' },
  { value: 'DOCUMENT_APPROVAL_SET', label: 'Document approval' },
  { value: 'DOCUMENT_DELETE', label: 'Document deleted' },
  { value: 'DOCUMENT_DOWNLOAD', label: 'Document downloaded' },
  { value: 'DOCUMENT_EDIT', label: 'Document updated' },
  { value: 'DOCUMENT_UPLOAD', label: 'Document uploaded' },
  { value: 'LOGIN_FAILURE', label: 'Sign-in failed' },
  { value: 'LOGIN_SUCCESS', label: 'Sign-in' },
  { value: 'LOGOUT', label: 'Sign out' },
  { value: 'PASSWORD_CHANGED', label: 'Password changed' },
  { value: 'PASSWORD_RESET', label: 'Password reset request' },
  { value: 'RATE_LIMIT_HIT', label: 'Rate limit' },
  { value: 'SYSTEM_CREATE_CLIENT_ADMIN', label: 'Client admin created' },
  { value: 'SYSTEM_CREATE_USER', label: 'User created' },
].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

module.exports = { AUDIT_EVENT_OPTIONS };
