import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ordersRouter } from './routes/orders';
import { webhooksRouter } from './routes/webhooks';
import { adminRouter } from './routes/admin';
import { quotesRouter } from './routes/quotes';
import { resumeNotificationQueue } from './services/notifications';

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Origin no permitido por CORS'));
  },
}));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

app.use('/api/webhooks', webhooksRouter);

app.use(express.json({ limit: '128kb' }));
app.use('/api/admin', adminRateLimiter, adminRouter);
app.use('/api', quotesRouter);
app.use('/api', ordersRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  resumeNotificationQueue();
});
