const path = require('path');
const nodemailer = require('nodemailer');

/**
 * Optional: set SMTP_PRESET=gmail | outlook | yahoo | office365
 * so you only need SMTP_USER + SMTP_PASS (and SMTP_FROM) in .env.
 */
function applySmtpPresets() {
  const preset = String(process.env.SMTP_PRESET || '').trim().toLowerCase();
  if (!preset) return;
  if (!process.env.SMTP_PORT) process.env.SMTP_PORT = '587';
  if (preset === 'gmail') {
    if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp.gmail.com';
  } else if (preset === 'outlook' || preset === 'hotmail' || preset === 'live') {
    if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp-mail.outlook.com';
  } else if (preset === 'yahoo') {
    if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp.mail.yahoo.com';
  } else if (preset === 'office365' || preset === 'microsoft365' || preset === 'm365') {
    if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp.office365.com';
  }
}

applySmtpPresets();

function smtpConfigured() {
  const url = String(process.env.SMTP_URL || '').trim();
  if (url) return true;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  const url = String(process.env.SMTP_URL || '').trim();
  if (url) {
    try {
      return nodemailer.createTransport(url);
    } catch (e) {
      console.warn('[mail] Invalid SMTP_URL:', e.message);
      return null;
    }
  }
  if (!smtpConfigured()) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === '1' || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    ...(secure
      ? {}
      : {
          requireTLS: process.env.SMTP_REQUIRE_TLS !== '0',
        }),
  });
}

/**
 * @param {{ to: string, resetUrl: string, expiryHours?: number }} opts
 * @returns {Promise<{ mode: 'smtp' | 'console' }>}
 */
async function sendPasswordResetEmail({ to, resetUrl, expiryHours = 1 }) {
  const hours = Number.isFinite(Number(expiryHours)) && Number(expiryHours) > 0 ? Number(expiryHours) : 1;
  const expiryPhrase = hours === 1 ? '1 hour' : `${hours} hours`;

  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    '"MedSupply Innovations" <noreply@example.com>';
  const subject = 'Password reset — MedSupply Innovations Management Portal';

  const text = [
    'MedSupply Innovations — Management Portal',
    '',
    'We received a request to reset the password for your account.',
    '',
    `Use the link below to choose a new password. For security, this link expires in ${expiryPhrase}:`,
    resetUrl,
    '',
    'If you did not request a password reset, you can safely ignore this message. Your password will not be changed.',
    '',
    '— MedSupply Innovations',
  ].join('\n');

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function escapeHtmlText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const hrefAttr = escapeAttr(resetUrl);
  const urlVisible = escapeHtmlText(resetUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f4f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background-color:#00684a;padding:20px 28px;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);">MedSupply Innovations</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:700;line-height:1.25;color:#ffffff;">Password reset</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Hello,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">We received a request to reset the password for your account on the <strong style="color:#0f172a;">Management Portal</strong>.</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">Select the button below to choose a new password. For your security, this link is valid for <strong style="color:#0f172a;">${expiryPhrase}</strong> only.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-radius:8px;background-color:#00684a;">
                  <a href="${hrefAttr}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset my password</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#00684a;">${urlVisible}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 28px;">
            <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request this reset, you can ignore this email. Your password will remain unchanged.</p>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;max-width:560px;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">This is an automated message. Please do not reply to this email.</p>
    </td>
  </tr>
</table>
</body>
</html>`;

  const transport = createTransport();
  if (!transport) {
    console.warn(
      '[mail] No SMTP — password reset was not emailed. Add .env next to server.js (see .env.example). Link for this request:',
      resetUrl
    );
    return { mode: 'console' };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    console.info('[mail] Password reset email sent to', to);
    return { mode: 'smtp' };
  } catch (e) {
    console.warn('[mail] sendMail failed:', e.message || e);
    console.warn('[mail] Reset link (copy if needed):', resetUrl);
    return { mode: 'console' };
  }
}

function logSmtpStartupHint() {
  if (smtpConfigured()) {
    console.info('[mail] SMTP is configured — password reset emails will be sent to users’ inboxes.');
    return;
  }
  console.info('');
  console.info('[mail] Password reset emails are NOT sent until you add SMTP to .env');
  console.info('     File location: ' + path.join(__dirname, '..', '.env'));
  console.info('     Quick Gmail:   SMTP_PRESET=gmail  SMTP_USER=you@gmail.com  SMTP_PASS=<app password>  SMTP_FROM="MedSupply <you@gmail.com>"');
  console.info('     See .env.example for Outlook, Yahoo, and Office 365.');
  console.info('');
}

module.exports = {
  sendPasswordResetEmail,
  smtpConfigured,
  logSmtpStartupHint,
};
