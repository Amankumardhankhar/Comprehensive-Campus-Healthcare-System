import { connectDB, disconnectDB } from '../config/db.js';
import { User, ROLES } from '../models/User.js';
import { logger } from './logger.js';

const run = async () => {
  await connectDB();

  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'System Admin';

  if (!email || !password) {
    logger.error('Usage: node src/utils/seedAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === ROLES.ADMIN) {
      logger.info(`Admin already exists: ${email}`);
    } else {
      existing.role = ROLES.ADMIN;
      await existing.save();
      logger.info(`Promoted existing user to admin: ${email}`);
    }
  } else {
    await User.create({ name, email, password, role: ROLES.ADMIN });
    logger.info(`Admin created: ${email}`);
  }

  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  logger.error('Seed failed', err.message);
  process.exit(1);
});
