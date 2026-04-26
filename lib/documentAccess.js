const { isSystemAdmin, isClientAdmin } = require('./roles');

function canAccessDocument(userId, role, companyId, doc) {
  if (!doc) return false;
  if (isSystemAdmin(role)) return true;
  if (Number(doc.user_id) === Number(userId)) return true;
  if (
    isClientAdmin(role) &&
    companyId != null &&
    doc.owner_company_id != null &&
    Number(doc.owner_company_id) === Number(companyId)
  ) {
    return true;
  }
  return false;
}

module.exports = { canAccessDocument };
