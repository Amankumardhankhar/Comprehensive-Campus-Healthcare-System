import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  register,
  login,
  me,
  updateMe,
  forgotPassword,
  resetPassword,
  verifyResetToken,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { resetRequestByIp, resetRequestByEmail } from '../middleware/rateLimiters.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
      .optional()
      .isIn([ROLES.STUDENT, ROLES.STAFF])
      .withMessage('Role must be student or staff'),
    body('studentId').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('phone').optional().isString().trim(),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', protect, me);

router.post(
  '/forgot-password',
  resetRequestByIp,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  validate,
  // After validate, so the key is the normalised address and malformed
  // floods are absorbed by the IP limiter instead of polluting this bucket.
  resetRequestByEmail,
  forgotPassword
);

router.get(
  '/reset-password/:token/verify',
  resetRequestByIp,
  [param('token').isString().isLength({ min: 32, max: 128 }).withMessage('Invalid reset token')],
  validate,
  verifyResetToken
);

router.post(
  '/reset-password',
  resetRequestByIp,
  [
    body('token').isString().isLength({ min: 32, max: 128 }).withMessage('Invalid reset token'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  resetPassword
);

router.patch(
  '/me',
  protect,
  [
    body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body('department').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
    body('studentId').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
    body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('dateOfBirth must be ISO date'),
    body('chronicConditions').optional().isArray().withMessage('chronicConditions must be an array'),
    body('chronicConditions.*').optional().isString().trim(),
  ],
  validate,
  updateMe
);

export default router;
