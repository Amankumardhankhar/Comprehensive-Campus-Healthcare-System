import dns from 'node:dns';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Transport is chosen once at startup, in priority order:
//   SMTP credentials → Resend API key → console fallback.
// Every branch resolves to the same { delivered, mode } shape so callers
// never need to know which provider is live.
let mode = 'console';
let smtpTransport = null;
let resend = null;

if (config.email.smtp.user && config.email.smtp.pass) {
  mode = 'smtp';

  // Container platforms (Hugging Face Spaces among them) routinely have no
  // IPv6 route, while smtp.gmail.com resolves to IPv6 first. Every attempt
  // then dies with ENETUNREACH before reaching Gmail at all. Preferring IPv4
  // sends the socket somewhere actually reachable.
  dns.setDefaultResultOrder('ipv4first');

  smtpTransport = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.port === 465,
    auth: { user: config.email.smtp.user, pass: config.email.smtp.pass },
    // Defaults let a blocked port hang for two minutes, which reads as a
    // stuck request rather than a failure. Fail fast and log instead.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  logger.info(
    `Email service: SMTP configured (${config.email.smtp.host}:${config.email.smtp.port}, IPv4-first)`
  );
} else if (config.email.resendApiKey) {
  mode = 'resend';
  resend = new Resend(config.email.resendApiKey);
  logger.info('Email service: Resend configured');
} else {
  logger.warn(
    'Email service: no SMTP_USER/SMTP_PASS or RESEND_API_KEY set — emails will be logged to console only'
  );
}

export const emailMode = () => mode;

const sendViaSmtp = async ({ to, subject, html, text }) => {
  try {
    const info = await smtpTransport.sendMail({ from: config.email.from, to, subject, html, text });
    return { delivered: true, mode, id: info.messageId };
  } catch (err) {
    logger.error(`SMTP send failed: ${err.message}`);
    return { delivered: false, mode, error: err.message };
  }
};

const sendViaResend = async ({ to, subject, html, text }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      logger.error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
      return { delivered: false, mode, error };
    }
    return { delivered: true, mode, id: data?.id };
  } catch (err) {
    logger.error(`Resend exception: ${err.message}`);
    return { delivered: false, mode, error: err.message };
  }
};

export const sendEmail = async ({ to, subject, html, text }) => {
  if (mode === 'smtp') return sendViaSmtp({ to, subject, html, text });
  if (mode === 'resend') return sendViaResend({ to, subject, html, text });

  logger.info(`[email→console] To: ${to} | Subject: ${subject}\n${text || html}`);
  return { delivered: false, mode: 'console' };
};

/** Verifies the configured transport can actually authenticate. Called at boot. */
export const verifyEmailTransport = async () => {
  if (mode !== 'smtp') return { ok: mode === 'resend', mode };
  try {
    await smtpTransport.verify();
    logger.info('Email service: SMTP credentials verified');
    return { ok: true, mode };
  } catch (err) {
    logger.error(
      `Email service: SMTP verification FAILED (${err.message}). ` +
        'Check SMTP_USER / SMTP_PASS — reset emails will not be delivered.'
    );
    return { ok: false, mode, error: err.message };
  }
};

export const renderPasswordResetEmail = ({ name, resetUrl, expiresInMinutes }) => {
  const safeName = name ? name.replace(/[<>&]/g, '') : 'there';
  const text = `Hi ${safeName},

We received a request to reset your Campus Healthcare password.

Reset your password using this link (valid for ${expiresInMinutes} minutes):
${resetUrl}

If you didn't request this, you can safely ignore this email — your password will not change.

— Campus Healthcare`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Reset your password</h1>
    <p style="margin:0 0 24px;color:#475569;">Hi ${safeName}, we received a request to reset your Campus Healthcare password.</p>
    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(90deg,#2563eb,#1d4ed8);color:white;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">Reset password</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">This link is valid for ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not change.</p>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;word-break:break-all;">Or paste this URL into your browser: ${resetUrl}</p>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">Campus Healthcare · Automated message</p>
</body></html>`;

  return { html, text };
};

export const renderPasswordChangedEmail = ({ name, changedAt }) => {
  const safeName = name ? name.replace(/[<>&]/g, '') : 'there';
  const when = changedAt.toUTCString();

  const text = `Hi ${safeName},

Your Campus Healthcare password was changed on ${when}.

If this was you, no action is needed.

If this wasn't you, someone may have access to your account. Reset your
password immediately and contact the campus health centre.

— Campus Healthcare`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;background:#f8fafc;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Your password was changed</h1>
    <p style="margin:0 0 20px;color:#475569;">Hi ${safeName}, your Campus Healthcare password was changed on <strong>${when}</strong>.</p>
    <p style="margin:0 0 20px;color:#475569;">If this was you, no action is needed.</p>
    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:8px;padding:14px 16px;">
      <p style="margin:0;color:#991b1b;font-size:14px;">If this wasn't you, someone may have access to your account. Reset your password immediately and contact the campus health centre.</p>
    </div>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">Campus Healthcare · Automated message</p>
</body></html>`;

  return { html, text };
};
