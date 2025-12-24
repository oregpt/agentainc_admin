import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/client';
import { agents } from '../db/schema';
import { ensureDefaultAgent } from '../chat/chatService';
import { AVAILABLE_MODELS } from '../llm';
import { capabilityService } from '../capabilities';
import { getOrchestrator } from '../mcp-hub';
import { eq } from 'drizzle-orm';

export const adminRouter = Router();

// Configure multer for avatar uploads
const uploadsPath = path.join(__dirname, '../../../uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    // Use agentId + timestamp for unique filename
    const agentId = req.params.agentId || 'unknown';
    const ext = path.extname(file.originalname);
    const filename = `avatar-${agentId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const avatarUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Only allow image files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)'));
    }
  },
});

// Get available LLM models
adminRouter.get('/models', async (_req, res) => {
  res.json({ models: AVAILABLE_MODELS });
});

// ============================================================================
// Multi-Agent Routes
// ============================================================================

// List all agents
adminRouter.get('/agents', async (_req, res) => {
  try {
    // Ensure at least one agent exists
    await ensureDefaultAgent();
    const rows = await db.select().from(agents);
    res.json({ agents: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

// Create a new agent
adminRouter.post('/agents', async (req, res) => {
  try {
    const { name, description, instructions, defaultModel, modelMode, allowedModels } = req.body as {
      name: string;
      description?: string;
      instructions?: string;
      defaultModel?: string;
      modelMode?: 'single' | 'multi';
      allowedModels?: string[];
    };

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);

    // Generate unique ID
    const id = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const inserted = (await db
      .insert(agents)
      .values({
        id,
        slug,
        name,
        description: description || '',
        instructions: instructions || 'You are a helpful AI assistant.',
        defaultModel: defaultModel || process.env.CLAUDE_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
        modelMode: modelMode || 'single',
        allowedModels: allowedModels || null,
      })
      .returning()) as any[];

    res.json({ agent: inserted[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Get a specific agent
adminRouter.get('/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const rows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
    const agent = rows[0];

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load agent' });
  }
});

// Update a specific agent
adminRouter.put('/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name, description, instructions, defaultModel, modelMode, allowedModels, branding } = req.body as {
      name?: string;
      description?: string;
      instructions?: string;
      defaultModel?: string;
      modelMode?: 'single' | 'multi';
      allowedModels?: string[] | null;
      branding?: Record<string, any> | null;
    };

    const patch: any = { updatedAt: new Date() };
    if (typeof name === 'string') patch.name = name;
    if (typeof description === 'string') patch.description = description;
    if (typeof instructions === 'string') patch.instructions = instructions;
    if (typeof defaultModel === 'string') patch.defaultModel = defaultModel;
    if (typeof modelMode === 'string') patch.modelMode = modelMode;
    if (allowedModels !== undefined) patch.allowedModels = allowedModels;
    if (branding !== undefined) patch.branding = branding;

    const rows = (await db
      .update(agents)
      .set(patch)
      .where(eq(agents.id, agentId))
      .returning()) as any[];

    const agent = rows[0];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Update agent branding only
adminRouter.put('/agents/:agentId/branding', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { branding } = req.body as { branding: Record<string, any> };

    if (!branding || typeof branding !== 'object') {
      return res.status(400).json({ error: 'branding object is required' });
    }

    const rows = (await db
      .update(agents)
      .set({ branding, updatedAt: new Date() })
      .where(eq(agents.id, agentId))
      .returning()) as any[];

    const agent = rows[0];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// Delete an agent
adminRouter.delete('/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Prevent deleting the last agent
    const allAgents = await db.select().from(agents);
    if (allAgents.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last agent' });
    }

    await db.delete(agents).where(eq(agents.id, agentId));
    res.json({ success: true, agentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Upload avatar image for an agent
adminRouter.post('/agents/:agentId/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const file = req.file;

    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current agent to access existing branding
    const rows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
    const agent = rows[0];

    if (!agent) {
      // Clean up uploaded file if agent doesn't exist
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Delete old avatar file if it exists
    const existingBranding = agent.branding || {};
    if (existingBranding.avatarUrl && existingBranding.avatarUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(uploadsPath, path.basename(existingBranding.avatarUrl));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Build the URL path for the uploaded file
    const avatarUrl = `/uploads/${file.filename}`;

    // Update branding with new avatar URL
    const updatedBranding = {
      ...existingBranding,
      avatarUrl,
    };

    await db
      .update(agents)
      .set({ branding: updatedBranding, updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    res.json({ success: true, avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Delete avatar for an agent
adminRouter.delete('/agents/:agentId/avatar', async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    // Get current agent
    const rows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
    const agent = rows[0];

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const existingBranding = agent.branding || {};

    // Delete the file if it exists
    if (existingBranding.avatarUrl && existingBranding.avatarUrl.startsWith('/uploads/')) {
      const filePath = path.join(uploadsPath, path.basename(existingBranding.avatarUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove avatarUrl from branding
    const { avatarUrl, ...restBranding } = existingBranding;

    await db
      .update(agents)
      .set({ branding: restBranding, updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

// ============================================================================
// Legacy single-agent routes (for backwards compatibility)
// ============================================================================

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

// ============================================================================
// Capability Routes
// ============================================================================

// Get all capabilities (with agent enablement status)
adminRouter.get('/capabilities', async (req, res) => {
  try {
    // Use agentId from query param, or fall back to default agent
    const agentId = (req.query.agentId as string) || (await ensureDefaultAgent());
    const caps = await capabilityService.getAgentCapabilities(agentId);

    // Check which have tokens configured
    const capsWithTokenStatus = await Promise.all(
      caps.map(async (cap) => ({
        ...cap,
        hasTokens: await capabilityService.hasCapabilityTokens(agentId, cap.id),
      }))
    );

    res.json({ capabilities: capsWithTokenStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load capabilities' });
  }
});

// Enable/disable a capability for the agent
adminRouter.post('/capabilities/:capabilityId/toggle', async (req, res) => {
  try {
    const { capabilityId } = req.params;
    const { enabled, agentId: bodyAgentId } = req.body as { enabled: boolean; agentId?: string };
    // Use agentId from body, or fall back to default agent
    const agentId = bodyAgentId || (await ensureDefaultAgent());

    await capabilityService.setAgentCapability(agentId, capabilityId, enabled);

    res.json({ success: true, capabilityId, enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle capability' });
  }
});

// Set tokens for a capability
adminRouter.post('/capabilities/:capabilityId/tokens', async (req, res) => {
  try {
    const { capabilityId } = req.params;
    const { token1, token2, token3, token4, token5, expiresAt, agentId: bodyAgentId } = req.body as {
      token1?: string;
      token2?: string;
      token3?: string;
      token4?: string;
      token5?: string;
      expiresAt?: string;
      agentId?: string;
    };
    // Use agentId from body, or fall back to default agent
    const agentId = bodyAgentId || (await ensureDefaultAgent());

    await capabilityService.setCapabilityTokens(
      agentId,
      capabilityId,
      { token1, token2, token3, token4, token5 },
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({ success: true, capabilityId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save tokens' });
  }
});

// Delete tokens for a capability
adminRouter.delete('/capabilities/:capabilityId/tokens', async (req, res) => {
  try {
    const { capabilityId } = req.params;
    // Use agentId from query param, or fall back to default agent
    const agentId = (req.query.agentId as string) || (await ensureDefaultAgent());

    await capabilityService.deleteCapabilityTokens(agentId, capabilityId);

    res.json({ success: true, capabilityId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tokens' });
  }
});

// Create a new custom capability (for anyapi configs)
adminRouter.post('/capabilities', async (req, res) => {
  try {
    const { id, name, description, type, category, config } = req.body as {
      id: string;
      name: string;
      description?: string;
      type: 'mcp' | 'anyapi';
      category?: string;
      config?: any;
    };

    if (!id || !name || !type) {
      return res.status(400).json({ error: 'id, name, and type are required' });
    }

    await capabilityService.upsertCapability({
      id,
      name,
      description: description || '',
      type,
      category,
      config,
      enabled: true,
    });

    res.json({ success: true, capabilityId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create capability' });
  }
});

// Delete a capability
adminRouter.delete('/capabilities/:capabilityId', async (req, res) => {
  try {
    const { capabilityId } = req.params;

    await capabilityService.deleteCapability(capabilityId);

    res.json({ success: true, capabilityId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete capability' });
  }
});

// ============================================================================
// Per-Agent API Keys Routes
// ============================================================================

// Get API key status for an agent
adminRouter.get('/agents/:agentId/api-keys', async (req, res) => {
  try {
    const { agentId } = req.params;
    const settings = await capabilityService.getAgentApiKeysStatus(agentId);
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load API keys' });
  }
});

// Set an API key for an agent
adminRouter.post('/agents/:agentId/api-keys/:key', async (req, res) => {
  try {
    const { agentId, key } = req.params;
    const { value } = req.body as { value: string };

    const allowedKeys = ['anthropic_api_key', 'openai_api_key', 'gemini_api_key', 'grok_api_key'];
    if (!allowedKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid API key type' });
    }

    if (!value || typeof value !== 'string') {
      return res.status(400).json({ error: 'Value is required' });
    }

    await capabilityService.setAgentApiKey(agentId, key, value);
    res.json({ success: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// Delete an API key for an agent
adminRouter.delete('/agents/:agentId/api-keys/:key', async (req, res) => {
  try {
    const { agentId, key } = req.params;

    const allowedKeys = ['anthropic_api_key', 'openai_api_key', 'gemini_api_key', 'grok_api_key'];
    if (!allowedKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid API key type' });
    }

    await capabilityService.deleteAgentApiKey(agentId, key);
    res.json({ success: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// ============================================================================
// MCP Hub Routes
// ============================================================================

// Get MCP Hub status
adminRouter.get('/mcp/status', async (_req, res) => {
  try {
    const orchestrator = getOrchestrator();
    const status = orchestrator.getHubStatus();
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get MCP Hub status' });
  }
});

// Get all available MCP tools
adminRouter.get('/mcp/tools', async (_req, res) => {
  try {
    const orchestrator = getOrchestrator();
    const tools = orchestrator.getAllTools();
    res.json({ tools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get MCP tools' });
  }
});

// Execute an MCP tool (for testing)
adminRouter.post('/mcp/execute', async (req, res) => {
  try {
    const { server, tool, arguments: args } = req.body as {
      server: string;
      tool: string;
      arguments: any;
    };

    if (!server || !tool) {
      return res.status(400).json({ error: 'server and tool are required' });
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.executeAction(server, tool, args || {});

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to execute MCP tool' });
  }
});
