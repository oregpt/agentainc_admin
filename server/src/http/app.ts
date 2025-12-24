import express from 'express';
import { chatRouter } from './chatRoutes';
import { capabilityRouter } from './capabilityRoutes';
import { kbRouter } from './kbRoutes';
import { ragRouter } from './ragRoutes';
import { adminRouter } from './adminRoutes';

export function createHttpApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'agentinabox-server' });
  });

  app.use('/api/chat', chatRouter);
  app.use('/api/capabilities', capabilityRouter);
  app.use('/api/kb', kbRouter);
  app.use('/api/rag', ragRouter);
  app.use('/api/admin', adminRouter);

  return app;
}
