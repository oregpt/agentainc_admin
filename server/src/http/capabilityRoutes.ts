import { Router } from 'express';
import { getCapability, listCapabilities } from '../capabilities/registry';

export const capabilityRouter = Router();

capabilityRouter.get('/', async (_req, res) => {
  res.json({ capabilities: listCapabilities() });
});

capabilityRouter.post('/anyapi/execute', async (req, res) => {
  try {
    const { action, params, agentId, conversationId, externalUserId } = req.body as {
      action: string;
      params?: Record<string, unknown>;
      agentId?: string;
      conversationId?: number;
      externalUserId?: string;
    };

    if (!action) return res.status(400).json({ error: 'action is required (e.g., coingecko.simple_price)' });

    const cap = getCapability('anyapi');
    if (!cap) return res.status(500).json({ error: 'AnyAPI capability not available' });

    const context: any = {
      agentId: agentId || 'default-agent',
      externalUserId,
    };
    if (conversationId !== undefined) {
      context.conversationId = conversationId;
    }

    const result = await cap.execute(action, params || {}, context);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to execute AnyAPI capability' });
  }
});
