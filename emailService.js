/**
 * Email Service
 * Handles sending OTP verification and password reset emails via Nodemailer.
 * Falls back to console logging if SMTP is not configured (dev mode).
 */

const nodemailer = require('nodemailer');

// ── Configuration ──────────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"IKSA Player" <noreply@iksaplayer.com>';
const IS_DEV = !SMTP_HOST || !SMTP_USER;

let transporter = null;

if (!IS_DEV) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  // Verify connection on startup
  transporter.verify().then(() => {
    console.log('[EmailService] SMTP connection verified ✓');
  }).catch((err) => {
    console.error('[EmailService] SMTP connection failed:', err.message);
  });
} else {
  console.log('[EmailService] No SMTP configured → OTP codes will be logged to console (dev mode)');
}

// ── HTML Email Templates ───────────────────────────────────────────────────────

function baseTemplate(title, body) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;border:1px solid rgba(148,163,184,0.15);padding:40px 32px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="width:56px;height:56px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px;line-height:56px;font-size:28px;text-align:center;">🎵</div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">IKSA Player</h1>
        </td></tr>
        ${body}
        <tr><td align="center" style="padding-top:32px;">
          <p style="margin:0;font-size:11px;color:#64748b;">This email was sent by IKSA Player. If you didn't request this, you can safely ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpBlock(code, purpose) {
  const heading = purpose === 'email_verify'
    ? 'Verify your email'
    : 'Reset your password';
  const description = purpose === 'email_verify'
    ? 'Welcome to IKSA Player! Enter the code below in the app to verify your email address and get started.'
    : 'We received a request to reset your password. Enter the code below to set a new password.';

  return baseTemplate(heading, `
    <tr><td align="center" style="padding-bottom:16px;">
      <h2 style="margin:0;font-size:18px;font-weight:700;color:#e2e8f0;">${heading}</h2>
    </td></tr>
    <tr><td align="center" style="padding-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">${description}</p>
    </td></tr>
    <tr><td align="center" style="padding-bottom:8px;">
      <div style="display:inline-block;background:rgba(124,58,237,0.15);border:2px dashed rgba(124,58,237,0.4);border-radius:16px;padding:16px 40px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#a855f7;font-family:monospace;">${code}</span>
      </div>
    </td></tr>
    <tr><td align="center" style="padding-bottom:4px;">
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong style="color:#e2e8f0;">10 minutes</strong>.</p>
    </td></tr>
  `);
}

function passwordChangedTemplate(displayName) {
  return baseTemplate('Password Changed', `
    <tr><td align="center" style="padding-bottom:16px;">
      <h2 style="margin:0;font-size:18px;font-weight:700;color:#e2e8f0;">Password changed successfully</h2>
    </td></tr>
    <tr><td align="center" style="padding-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Hi ${displayName || 'there'}, your IKSA Player password was just changed.
        If you didn't do this, please reset your password immediately.
      </p>
    </td></tr>
    <tr><td align="center">
      <div style="display:inline-block;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:12px 24px;">
        <span style="font-size:14px;color:#4ade80;font-weight:600;">✓ Password updated</span>
      </div>
    </td></tr>
  `);
}

// ── Send Functions ─────────────────────────────────────────────────────────────

async function sendOTPEmail(email, code, purpose = 'email_verify') {
  const subject = purpose === 'email_verify'
    ? `${code} is your IKSA Player verification code`
    : `${code} is your password reset code`;

  if (IS_DEV) {
    console.log(`\n╔═══════════════════════════════════════════════════════╗`);
    console.log(`║  📧  OTP EMAIL (${purpose})                          `);
    console.log(`║  To:   ${email}`);
    console.log(`║  Code: ${code}`);
    console.log(`║  Expires: 10 minutes`);
    console.log(`╚═══════════════════════════════════════════════════════╝\n`);
    return { success: true, dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject,
      html: otpBlock(code, purpose),
    });
    console.log(`[EmailService] OTP sent to ${email} (messageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed to send OTP to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendPasswordChangedEmail(email, displayName) {
  if (IS_DEV) {
    console.log(`[EmailService] DEV: Password changed notification → ${email}`);
    return { success: true, dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your IKSA Player password has been changed',
      html: passwordChangedTemplate(displayName),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed to send password-changed email:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOTPEmail,
  sendPasswordChangedEmail,
};
