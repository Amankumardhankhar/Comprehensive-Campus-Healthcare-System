import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import * as ctrl from '../controllers/adminUser.controller.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get(
  '/',
  [
    query('role').optional().isIn(Object.values(ROLES)),
    query('isActive').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
  ],
  validate,
  ctrl.list
);

router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(Object.values(ROLES)),
    body('studentId').optional({ nullable: true }).isString().trim(),
    body('department').optional({ nullable: true }).isString().trim(),
    body('phone').optional({ nullable: true }).isString().trim(),
    body('dateOfBirth').optional({ nullable: true }).isISO8601(),
    body('chronicConditions').optional().isArray(),
  ],
  validate,
  ctrl.create
);

router.get('/:id', [param('id').isMongoId()], validate, ctrl.get);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body('department').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
    body('studentId').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
    body('dateOfBirth').optional({ nullable: true }).isISO8601(),
    body('chronicConditions').optional().isArray(),
    body('chronicConditions.*').optional().isString().trim(),
    body('role').optional().isIn(Object.values(ROLES)),
    body('isActive').optional().isBoolean(),
    body('password').optional().isLength({ min: 8 }),
  ],
  validate,
  ctrl.update
);

router.delete('/:id', [param('id').isMongoId()], validate, ctrl.remove);

export default router;
