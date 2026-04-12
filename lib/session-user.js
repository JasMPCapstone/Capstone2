function applyUserToSession(req, user) {
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.fullName = user.full_name;
  req.session.role = user.role;
  req.session.userActive = !!user.is_active;
  req.session.passwordMustChange = !!user.password_must_change;
  req.session.profileCompleted = !!user.profile_completed;
  req.session.twoFactorEnabled = !!user.two_factor_enabled;
  req.session.companyId = user.company_id != null ? user.company_id : null;
}

module.exports = { applyUserToSession };
