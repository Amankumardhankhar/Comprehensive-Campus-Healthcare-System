import { Resend } from 'resend';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let resend = null;
if (config.email.resendApiKey) {
  resend = new Resend(config.email.resendApiKey);
  logger.info('Email service: Resend configured');
} else {
  logger.warn('Email service: RESEND_API_KEY not set — emails will be logged to console only');
}

export const sendEmail = async ({ to, subject, html, text }) => {
  if (!resend) {
    logger.info(`[email→console] To: ${to} | Subject: ${subject}\n${text || html}`);
    return { delivered: false, mode: 'console' };
  }
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
      return { delivered: false, mode: 'resend', error };
    }
    return { delivered: true, mode: 'resend', id: data?.id };
  } catch (err) {
    logger.error(`Resend exception: ${err.message}`);
    return { delivered: false, mode: 'resend', error: err.message };
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
