import { Router } from 'express';
import { db } from '../db/client';
import { agents } from '../db/schema';
import { ensureDefaultAgent } from '../chat/chatService';
import { eq } from 'drizzle-orm';

export const adminRouter = Router();

adminRouter.get('/agent', async (_req, res) => {
  try {
    const id = await ensureDefaultAgent();
    const rows = (await db.select().from(agents).where(eq(agents.id, id)).limit(1)) as any[];
    const agent = rows[0];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    res.json({ agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load agent config' });
  }
});

adminRouter.post('/agent', async (req, res) => {
  try {
    const id = await ensureDefaultAgent();
    const { name, description, instructions, defaultModel } = req.body as {
      name?: string;
      description?: string;
      instructions?: string;
      defaultModel?: string;
    };

    const patch: any = {};
    if (typeof name === 'string') patch.name = name;
    if (typeof description === 'string') patch.description = description;
    if (typeof instructions === 'string') patch.instructions = instructions;
    if (typeof defaultModel === 'string') patch.defaultModel = defaultModel;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const rows = (await db
      .update(agents)
      .set(patch)
      .where(eq(agents.id, id))
      .returning()) as any[];

    const agent = rows[0];
    res.json({ agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update agent config' });
  }
});
