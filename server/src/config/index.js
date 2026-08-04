import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`FATAL: missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';

// Gmail rewrites any From header that doesn't match the authenticated
// account, so derive it from SMTP_USER rather than let it be set wrong.
const defaultFrom = smtpUser
  ? `Campus Healthcare <${smtpUser}>`
  : 'Campus Healthcare <onboarding@resend.dev>';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  appUrl: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5050',
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      user: smtpUser,
      pass: smtpPass,
    },
    from: process.env.EMAIL_FROM || defaultFrom,
  },
  ai: {
    riskUrl: process.env.AI_RISK_URL || 'http://localhost:8001',
    trendUrl: process.env.AI_TREND_URL || 'http://localhost:8002',
    forecastUrl: process.env.AI_FORECAST_URL || 'http://localhost:8003',
    orchestratorUrl: process.env.AI_ORCHESTRATOR_URL || 'http://localhost:8100',
  },
};
