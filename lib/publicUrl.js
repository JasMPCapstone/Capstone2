/**
 * Public site URL for links in emails (password reset, etc.).
 * Set APP_PUBLIC_URL in production (e.g. https://portal.example.com).
 */
function publicBaseUrl(req) {
  const env = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (env) return env;

  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

module.exports = { publicBaseUrl };
