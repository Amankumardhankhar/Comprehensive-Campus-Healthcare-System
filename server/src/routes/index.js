import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import medicineRoutes from './medicine.routes.js';
import recordRoutes from './medicalRecord.routes.js';
import analyticsRoutes from './analytics.routes.js';
import systemConfigRoutes from './systemConfig.routes.js';
import sensorRoutes from './sensor.routes.js';
import machineRoutes from './machineSession.routes.js';
import quickPickupRoutes from './quickPickup.routes.js';
import adminUserRoutes from './adminUser.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/medicines', medicineRoutes);
router.use('/records', recordRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/system/config', systemConfigRoutes);
router.use('/sensor', sensorRoutes);
router.use('/machine/quick', quickPickupRoutes);
router.use('/machine', machineRoutes);
router.use('/admin/users', adminUserRoutes);

export default router;
