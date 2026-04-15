const { z } = require('zod');

const loginBodySchema = z.object({
  email: z
    .string()
    .max(255)
    .trim()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'Password is required').max(2048),
});

const login2faBodySchema = z.object({
  token: z.string().trim().min(1).max(128),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .transform((s) => s.replace(/\s/g, ''))
    .pipe(z.string().min(6, 'Enter your 6-digit code').max(12)),
});

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().max(2048).optional(),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(2048),
    confirmPassword: z.string().min(1, 'Confirm your new password').max(2048),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New passwords do not match.',
    path: ['confirmPassword'],
  });

function safeParseLogin(body) {
  const r = loginBodySchema.safeParse(body || {});
  if (!r.success) {
    const first = r.error.flatten().fieldErrors;
    const msg = first.email?.[0] || first.password?.[0] || 'Invalid input';
    return { ok: false, error: msg };
  }
  return { ok: true, data: r.data };
}

function safeParseLogin2fa(body) {
  const r = login2faBodySchema.safeParse(body || {});
  if (!r.success) {
    const first = r.error.flatten().fieldErrors;
    const form = r.error.flatten().formErrors;
    const msg = first.token?.[0] || first.code?.[0] || form[0] || 'Invalid input';
    return { ok: false, error: msg };
  }
  return { ok: true, data: r.data };
}

function safeParseChangePassword(body) {
  const r = changePasswordBodySchema.safeParse(body || {});
  if (!r.success) {
    const first = r.error.flatten().fieldErrors;
    const form = r.error.flatten().formErrors;
    const msg = first.newPassword?.[0] || first.confirmPassword?.[0] || form[0] || 'Invalid input';
    return { ok: false, error: msg };
  }
  return { ok: true, data: r.data };
}

module.exports = {
  loginBodySchema,
  login2faBodySchema,
  changePasswordBodySchema,
  safeParseLogin,
  safeParseLogin2fa,
  safeParseChangePassword,
};
