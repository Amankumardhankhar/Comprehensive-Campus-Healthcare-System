import asyncHandler from 'express-async-handler';
import * as authService from '../services/auth.service.js';
import * as resetService from '../services/passwordReset.service.js';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.registerUser(req.body);
  res.status(201).json({ success: true, data: { user, token } });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.loginUser(req.body);
  res.json({ success: true, data: { user, token } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, data: { user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data: { user } });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await resetService.requestPasswordReset({ email: req.body.email });
  res.json({
    success: true,
    message: 'If an account exists for that email, a password reset link has been sent.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await resetService.completePasswordReset({
    token: req.body.token,
    newPassword: req.body.password,
  });
  res.json({ success: true, message: 'Password updated. You can now sign in with your new password.' });
});
