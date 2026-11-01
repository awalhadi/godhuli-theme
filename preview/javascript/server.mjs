import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { db } from './db.mjs';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// Attach a request id and log timing for every request
app.use((req, res, next) => {
  req.id = req.get('x-request-id') ?? randomUUID();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const { method, originalUrl } = req;
    console.log(`[${req.id}] ${method} ${originalUrl} -> ${res.statusCode} (${ms.toFixed(1)}ms)`);
  });
  next();
});

app.get('/api/orders', async (req, res) => {
  const { status = 'paid', limit = '20' } = req.query;
  const rows = await db.orders.findMany({
    where: { status },
    take: Math.min(parseInt(limit, 10), 100),
    orderBy: { placedAt: 'desc' },
  });
  res.json({ data: rows, meta: { count: rows.length, next: null } });
});

app.post('/api/orders/:id/ship', async (req, res, next) => {
  try {
    const order = await db.orders.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: `Order ${req.params.id} not found` });

    // FIXME: carrier API rate-limits at 5 req/s; replace with a proper queue
    await sleep(250);
    const updated = await db.orders.update({
      where: { id: order.id },
      data: { status: 'shipped', trackingCode: req.body.trackingCode?.trim() || null },
    });
    res.status(202).json(updated);
  } catch (err) {
    next(err);
  }
});

/** Centralised error handler — must keep the 4-arg signature. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status ?? 500;
  console.error(`[${req.id}] ${err.stack}`);
  res.status(status).json({
    error: isProd && status === 500 ? 'Internal Server Error' : err.message,
    requestId: req.id,
  });
});

app.listen(PORT, () => console.log(`\u{1F680} Orders API listening on http://localhost:${PORT}`));
