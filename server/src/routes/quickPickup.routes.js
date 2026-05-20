import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/quickPickup.controller.js';

const router = Router();

router.use(protect);

router.get('/catalog', ctrl.catalog);

router.post(
  '/session/start',
  [
    body('underAge').optional().isBoolean().toBoolean(),
    body('hasAllergies').optional().isBoolean().toBoolean(),
    body('notes').optional().isString().trim(),
    body('language').optional().isString().trim(),
  ],
  validate,
  ctrl.start
);

router.post(
  '/session/:id/cart',
  [
    param('id').isString().trim().notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.medicineId').isString().trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1, max: 5 }),
  ],
  validate,
  ctrl.setCart
);

export default router;
