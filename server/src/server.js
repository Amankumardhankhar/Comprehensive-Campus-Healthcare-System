import app from './app.js';
import { config } from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { seedOtcMedicines } from './utils/seedOtcMedicines.js';
import { SystemConfig } from './models/SystemConfig.js';
import { verifyEmailTransport } from './services/email.service.js';

const start = async () => {
  await connectDB();

  try {
    await seedOtcMedicines();
    await SystemConfig.getOrCreate();
    logger.info('Boot seeds complete (OTC medicines, system config)');
  } catch (e) {
    logger.error('Boot seed failed', e);
  }

  // Surfaces bad SMTP credentials at boot rather than on a user's first
  // password reset. Never fatal — the app must still serve without email.
  verifyEmailTransport().catch(() => {});

  const server = app.listen(config.port, () => {
    logger.info(`Server running in ${config.env} mode on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/api/health`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', reason);
    shutdown('unhandledRejection');
  });
};

start();
