import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import { MEDICINE_CATEGORIES } from '../models/Medicine.js';
import * as ctrl from '../controllers/medicine.controller.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.list);
router.get('/dispensable', ctrl.listDispensable);
router.get('/stats', authorize(ROLES.STAFF, ROLES.ADMIN), ctrl.stats);
router.get('/logs', authorize(ROLES.STAFF, ROLES.ADMIN), ctrl.logs);
router.get('/:id', ctrl.get);

router.post(
  '/',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [
    body('name').trim().notEmpty(),
    body('category').optional().isIn(MEDICINE_CATEGORIES),
    body('quantity').isInt({ min: 0 }),
    body('expiryDate').isISO8601(),
    body('unit').optional().isString(),
    body('pricePerUnit').optional().isFloat({ min: 0 }),
    body('minStockLevel').optional().isInt({ min: 0 }),
  ],
  validate,
  ctrl.create
);

router.put(
  '/:id',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [param('id').isMongoId()],
  validate,
  ctrl.update
);

router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  [param('id').isMongoId()],
  validate,
  ctrl.remove
);

router.patch(
  '/:id/otc',
  authorize(ROLES.ADMIN),
  [
    param('id').isMongoId(),
    body('otcSafe').optional().isBoolean(),
    body('dispensableByMachine').optional().isBoolean(),
    body('maxPerSession').optional().isInt({ min: 1, max: 10 }),
    body('indications').optional().isArray(),
    body('indications.*').optional().isString().trim(),
    body('contraindications').optional().isArray(),
    body('contraindications.*').optional().isString().trim(),
  ],
  validate,
  ctrl.setOtcFlags
);

router.post(
  '/:id/adjust',
  authorize(ROLES.STAFF, ROLES.ADMIN),
  [
    param('id').isMongoId(),
    body('quantity').isInt().not().equals('0'),
    body('reason').trim().notEmpty(),
  ],
  validate,
  ctrl.adjust
);

export default router;
