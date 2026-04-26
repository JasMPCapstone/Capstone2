export function isSystemAdmin(role) {
  return role === 'SYSTEM_ADMIN' || role === 'ADMIN';
}

export function isClientAdmin(role) {
  return role === 'CLIENT_ADMIN';
}

export function isStaff(role) {
  return role === 'CLIENT';
}

/** Matches server `mustEnforceFullOnboarding` (2FA required for clients and client admins). */
export function mustEnforceFullOnboarding(role) {
  return role === 'CLIENT' || role === 'CLIENT_ADMIN';
}

export function roleLabel(role) {
  if (isSystemAdmin(role)) return 'System administrator';
  if (isClientAdmin(role)) return 'Client Admin';
  if (isStaff(role)) return 'Client';
  return role || 'User';
}
