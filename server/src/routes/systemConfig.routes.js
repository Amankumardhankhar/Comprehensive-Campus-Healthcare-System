import { Router } from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import * as ctrl from '../controllers/systemConfig.controller.js';

const router = Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', ctrl.getConfig);

router.put(
  '/',
  [
    body('minDiseaseConfidence').optional().isFloat({ min: 0, max: 1 }),
    body('maxHighRiskAllowed').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('maxMedicinesPerSession').optional().isInt({ min: 1, max: 10 }),
    body('blockDispenseOnSevereImage').optional().isBoolean(),
    body('currency').optional().isString().trim(),
    body('vitalBands').optional().isObject(),
  ],
  validate,
  ctrl.updateConfig
);

export default router;
