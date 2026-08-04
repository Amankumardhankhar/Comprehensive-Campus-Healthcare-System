import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// One proxy hop (the Hugging Face edge, or nginx on a VM deploy). Without
// this every request appears to come from the proxy's address, which would
// make per-IP rate limiting apply to the whole deployment at once.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use('/api', apiRoutes);

// Serve built React client in production
if (config.env === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) => {
    res.json({ name: 'Campus Healthcare API', version: '1.0.0', docs: '/api/health' });
  });
  app.use(notFound);
}

app.use(errorHandler);

export default app;
