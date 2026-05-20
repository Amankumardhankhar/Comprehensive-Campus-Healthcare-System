import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/machineSession.controller.js';

const router = Router();

router.use(protect);

router.get('/sessions', ctrl.list);

router.post(
  '/session/start',
  [
    body('text').optional().isString().trim(),
    body('audioTranscript').optional().isString().trim(),
    body('quickSelections').optional().isArray(),
    body('inputMode').optional().isIn(['text', 'voice', 'quick', 'mixed']),
    body('language').optional().isString().trim(),
  ],
  validate,
  ctrl.startSession
);

router.get('/session/:id', [param('id').isString().trim().notEmpty()], validate, ctrl.get);

router.post(
  '/session/:id/sensor',
  [
    param('id').isString().trim().notEmpty(),
    body('heartRate').optional().isFloat({ min: 0, max: 250 }),
    body('temperature').optional().isFloat(),
    body('spO2').optional().isFloat({ min: 0, max: 100 }),
    body('respirationRate').optional().isFloat({ min: 0, max: 80 }),
    body('capturedImageUrl').optional().isString().trim(),
    body('source').optional().isString().trim(),
  ],
  validate,
  ctrl.attachSensor
);

router.post(
  '/session/:id/analyze',
  [
    param('id').isString().trim().notEmpty(),
    body('text').optional().isString(),
    body('symptoms').optional().isArray(),
    body('symptoms.*').optional().isString().trim(),
    body('imageBase64').optional().isString(),
    body('age').optional().isFloat({ min: 0, max: 120 }),
    body('flags').optional().isArray(),
    body('flags.*').optional().isString().trim(),
    body('minConfidence').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  ctrl.analyze
);

router.post(
  '/session/:id/payment/intent',
  [
    param('id').isString().trim().notEmpty(),
    body('method').isIn(['upi', 'card', 'cash', 'qr']),
  ],
  validate,
  ctrl.createPaymentIntent
);

router.post(
  '/session/:id/payment/confirm',
  [
    param('id').isString().trim().notEmpty(),
    body('transactionId').optional().isString().trim(),
  ],
  validate,
  ctrl.confirmPayment
);

router.post(
  '/session/:id/dispense',
  [param('id').isString().trim().notEmpty()],
  validate,
  ctrl.dispense
);

router.post(
  '/session/:id/acknowledge-referral',
  [param('id').isString().trim().notEmpty()],
  validate,
  ctrl.acknowledgeReferral
);

router.post(
  '/session/:id/cancel',
  [
    param('id').isString().trim().notEmpty(),
    body('reason').optional().isString().trim(),
  ],
  validate,
  ctrl.cancel
);

export default router;
