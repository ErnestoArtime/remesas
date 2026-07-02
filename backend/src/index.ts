import express from 'express';
import cors from 'cors';
import { ordersRouter } from './routes/orders';
import { webhooksRouter } from './routes/webhooks';
import { adminRouter } from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

app.use('/api/webhooks', webhooksRouter);

app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api', ordersRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
