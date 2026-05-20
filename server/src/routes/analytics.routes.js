import { Router } from 'express';
import { param, query } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import * as ctrl from '../controllers/analytics.controller.js';

const router = Router();

router.use(protect);

router.get('/ai-health', authorize(ROLES.STAFF, ROLES.ADMIN), ctrl.aiHealth);

router.get(
  '/risk/:studentId',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [param('studentId').isMongoId()],
  validate,
  ctrl.riskProfile
);

router.get(
  '/disease-trends',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [
    query('label').isString().trim().notEmpty(),
    query('days').optional().isInt({ min: 7, max: 365 }),
    query('window').optional().isInt({ min: 2, max: 30 }),
    query('zThreshold').optional().isFloat({ min: 1, max: 5 }),
  ],
  validate,
  ctrl.diseaseTrend
);

router.get(
  '/forecast/:medicineId',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [
    param('medicineId').isMongoId(),
    query('horizonDays').optional().isInt({ min: 1, max: 90 }),
  ],
  validate,
  ctrl.demandForecast
);

router.get('/risk-distribution', authorize(ROLES.ADMIN), ctrl.riskDistribution);

export default router;
