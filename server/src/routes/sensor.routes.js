import { Router } from 'express';
import { query } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/sensor.controller.js';

const router = Router();

router.use(protect);

const SCENARIOS = ['normal', 'mild_fever', 'high_fever', 'tachycardia', 'hypoxia', 'bradycardia', 'critical'];

router.get(
  '/vitals',
  [query('scenario').optional().isIn(SCENARIOS)],
  validate,
  ctrl.vitals
);

router.get(
  '/image',
  [
    query('sessionId').optional().isString().trim(),
    query('condition').optional().isString().trim(),
  ],
  validate,
  ctrl.image
);

router.get(
  '/full',
  [
    query('sessionId').optional().isString().trim(),
    query('scenario').optional().isIn(SCENARIOS),
  ],
  validate,
  ctrl.full
);

export default router;
