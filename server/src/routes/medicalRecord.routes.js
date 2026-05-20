import { Router } from 'express';
import { param } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/User.js';
import * as ctrl from '../controllers/medicalRecord.controller.js';

const router = Router();

router.use(protect);

const GONE_MSG = {
  success: false,
  message:
    'Manual medical-record workflows are deprecated. The system has moved to the automated vending-machine flow at /api/machine.',
};
const deprecated = (_req, res) => res.status(410).json(GONE_MSG);

router.get('/', ctrl.list);
router.get('/:id', [param('id').isMongoId()], validate, ctrl.get);

router.post('/', authorize(ROLES.ADMIN), deprecated);
router.put('/:id', authorize(ROLES.ADMIN), deprecated);
router.delete('/:id', authorize(ROLES.ADMIN), deprecated);
router.post('/:id/issue', authorize(ROLES.ADMIN), deprecated);

export default router;
