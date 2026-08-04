import crypto from 'crypto';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { sendEmail, renderPasswordResetEmail, renderPasswordChangedEmail } from './email.service.js';
import { logger } from '../utils/logger.js';

const TOKEN_TTL_MINUTES = 60;

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

export const requestPasswordReset = async ({ email }) => {
  if (!email) throw ApiError.badRequest('Email is required');

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Always return the same response regardless of whether the user exists,
  // to avoid leaking which emails are registered.
  if (!user || !user.isActive) {
    logger.info(`Password reset requested for non-existent or inactive email: ${email}`);
    return { ok: true };
  }

  // Invalidate any unused existing tokens
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

  const resetUrl = `${config.appUrl.replace(/\/$/, '')}/reset-password/${rawToken}`;
  const { html, text } = renderPasswordResetEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });

  // Deliberately not awaited. Awaiting the provider call makes the response
  // measurably slower for real accounts than for non-existent ones, which
  // undoes the generic message above as an anti-enumeration defence.
  sendEmail({
    to: user.email,
    subject: 'Reset your Campus Healthcare password',
    html,
    text,
  })
    .then((result) => {
      // The raw token exists only in this closure — Mongo holds just its
      // hash. If delivery failed, logging the link here is the only way an
      // operator can still rescue the user.
      if (!result.delivered) {
        logger.warn(
          `[password-reset] Delivery failed (mode=${result.mode}) for ${user.email}. Link: ${resetUrl}`
        );
      }
    })
    .catch((err) => {
      logger.error(`[password-reset] Send threw for ${user.email}: ${err.message}. Link: ${resetUrl}`);
    });

  return { ok: true };
};

/** Masks an address for display: "student@campus.edu" → "s••••••@campus.edu" */
const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
};

export const verifyResetToken = async (token) => {
  if (!token) return { valid: false };

  const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { valid: false };

  const user = await User.findById(record.userId);
  if (!user || !user.isActive) return { valid: false };

  return { valid: true, maskedEmail: maskEmail(user.email), expiresAt: record.expiresAt };
};

export const completePasswordReset = async ({ token, newPassword }) => {
  if (!token || !newPassword) throw ApiError.badRequest('Token and new password are required');
  if (String(newPassword).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const tokenHash = hashToken(token);
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }

  const user = await User.findById(record.userId).select('+password');
  if (!user || !user.isActive) throw ApiError.badRequest('Reset link is invalid or has expired');

  const sameAsCurrent = await user.comparePassword(newPassword);
  if (sameAsCurrent) {
    throw ApiError.badRequest('New password must be different from your current password');
  }

  user.password = newPassword;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Invalidate any other outstanding tokens for this user
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  // Notification only — a failure here must not fail the reset itself.
  const changed = renderPasswordChangedEmail({ name: user.name, changedAt: new Date() });
  sendEmail({
    to: user.email,
    subject: 'Your Campus Healthcare password was changed',
    html: changed.html,
    text: changed.text,
  }).catch((err) => logger.error(`[password-reset] Confirmation email failed: ${err.message}`));

  return { ok: true };
};
