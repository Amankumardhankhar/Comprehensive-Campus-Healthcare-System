import asyncHandler from 'express-async-handler';
import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw ApiError.unauthorized('Access token required');

  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User no longer exists or is inactive');

  req.user = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Role '${req.user.role}' not permitted`));
  }
  next();
};
