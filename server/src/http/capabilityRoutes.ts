import { Router } from 'express';
import { getCapability, listCapabilities } from '../capabilities/registry';
import { capabilityService } from '../capabilities/capabilityService';

export const capabilityRouter = Router();

capabilityRouter.get('/', async (_req, res) => {
  res.json({ capabilities: listCapabilities() });
});

// Get enabled capabilities for a specific agent (for widget use)
capabilityRouter.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Get all capabilities with agent-specific enabled status
    const allCapabilities = await capabilityService.getAgentCapabilities(agentId);

    // Filter to only enabled capabilities
    const enabledCapabilities = allCapabilities
      .filter(cap => cap.enabled && cap.agentEnabled)
      .map(cap => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        category: cap.category,
      }));

    res.json({ capabilities: enabledCapabilities });
  } catch (err) {
    console.error('[capabilities] Error fetching agent capabilities:', err);
    res.status(500).json({ error: 'Failed to fetch agent capabilities' });
  }
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
