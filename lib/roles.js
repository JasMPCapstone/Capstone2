const SYSTEM_ADMIN = 'SYSTEM_ADMIN';
const CLIENT_ADMIN = 'CLIENT_ADMIN';
const CLIENT = 'CLIENT';

function isSystemAdmin(role) {
  return role === SYSTEM_ADMIN || role === 'ADMIN';
}

function isClientAdmin(role) {
  return role === CLIENT_ADMIN;
}

function isClientEmployee(role) {
  return role === CLIENT;
}

function mustEnforceFullOnboarding(role) {
  return role === CLIENT || role === CLIENT_ADMIN;
}

module.exports = {
  SYSTEM_ADMIN,
  CLIENT_ADMIN,
  CLIENT,
  isSystemAdmin,
  isClientAdmin,
  isClientEmployee,
  mustEnforceFullOnboarding,
};
