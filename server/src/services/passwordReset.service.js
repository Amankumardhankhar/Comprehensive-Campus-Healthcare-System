import crypto from 'crypto';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { sendEmail, renderPasswordResetEmail } from './email.service.js';
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

  const result = await sendEmail({
    to: user.email,
    subject: 'Reset your Campus Healthcare password',
    html,
    text,
  });

  if (!result.delivered && result.mode === 'console') {
    logger.info(`[password-reset] Link for ${user.email}: ${resetUrl}`);
  }

  return { ok: true };
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

  user.password = newPassword;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Invalidate any other outstanding tokens for this user
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  return { ok: true };
};
