import express from 'express';
import cors from 'cors';
import path from 'path';
import { chatRouter } from './chatRoutes';
import { capabilityRouter } from './capabilityRoutes';
import { kbRouter } from './kbRoutes';
import { ragRouter } from './ragRoutes';
import { adminRouter } from './adminRoutes';

export function createHttpApp() {
  const app = express();

  // Enable CORS for all origins (dev mode)
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'agentinabox-server' });
  });

  app.use('/api/chat', chatRouter);
  app.use('/api/capabilities', capabilityRouter);
  app.use('/api/kb', kbRouter);
  app.use('/api/rag', ragRouter);
  app.use('/api/admin', adminRouter);

  // In production, serve the frontend static files
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, '../../public');
    app.use(express.static(publicPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  return app;
}
