import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/client';
import { agents, folders, tags, documentTags, documents } from '../db/schema';
import { ensureDefaultAgent } from '../chat/chatService';
import { AVAILABLE_MODELS } from '../llm';
import { capabilityService } from '../capabilities';
import { getOrchestrator } from '../mcp-hub';
import { eq, and, isNull, sql } from 'drizzle-orm';

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

// ============================================================================
// Knowledge Base - Folder Routes
// ============================================================================

// List all folders for an agent (returns tree structure)
adminRouter.get('/agents/:agentId/folders', async (req, res) => {
  try {
    const { agentId } = req.params;
    const rows = await db
      .select()
      .from(folders)
      .where(eq(folders.agentId, agentId))
      .orderBy(folders.name);

    // Build tree structure
    const buildTree = (parentId: number | null): any[] => {
      return rows
        .filter((f) => f.parentId === parentId)
        .map((folder) => ({
          ...folder,
          children: buildTree(folder.id),
        }));
    };

    const tree = buildTree(null);
    res.json({ folders: tree, flatList: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load folders' });
  }
});

// Create a folder
adminRouter.post('/agents/:agentId/folders', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name, parentId } = req.body as { name: string; parentId?: number | null };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const inserted = await db
      .insert(folders)
      .values({
        agentId,
        name: name.trim(),
        parentId: parentId || null,
      })
      .returning();

    res.json({ folder: inserted[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Update (rename) a folder
adminRouter.put('/agents/:agentId/folders/:folderId', async (req, res) => {
  try {
    const { agentId, folderId } = req.params;
    const { name } = req.body as { name: string };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const updated = await db
      .update(folders)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.agentId, agentId)))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ folder: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Move a folder to a new parent
adminRouter.put('/agents/:agentId/folders/:folderId/move', async (req, res) => {
  try {
    const { agentId, folderId } = req.params;
    const { parentId } = req.body as { parentId: number | null };

    // Prevent moving a folder into itself or its descendants
    const folderIdNum = parseInt(folderId);
    if (parentId === folderIdNum) {
      return res.status(400).json({ error: 'Cannot move folder into itself' });
    }

    const updated = await db
      .update(folders)
      .set({ parentId: parentId || null, updatedAt: new Date() })
      .where(and(eq(folders.id, folderIdNum), eq(folders.agentId, agentId)))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ folder: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move folder' });
  }
});

// Delete a folder (documents move to parent/root)
adminRouter.delete('/agents/:agentId/folders/:folderId', async (req, res) => {
  try {
    const { agentId, folderId } = req.params;
    const folderIdNum = parseInt(folderId);

    // Get the folder to find its parent
    const folderRows = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderIdNum), eq(folders.agentId, agentId)))
      .limit(1);

    if (!folderRows[0]) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const parentId = folderRows[0].parentId;

    // Move documents in this folder to the parent folder (or null for root)
    await db
      .update(documents)
      .set({ folderId: parentId })
      .where(eq(documents.folderId, folderIdNum));

    // Move subfolders to the parent folder
    await db
      .update(folders)
      .set({ parentId })
      .where(eq(folders.parentId, folderIdNum));

    // Delete the folder
    await db.delete(folders).where(eq(folders.id, folderIdNum));

    res.json({ success: true, folderId: folderIdNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// ============================================================================
// Knowledge Base - Tag Routes
// ============================================================================

// List all tags for an agent
adminRouter.get('/agents/:agentId/tags', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Get tags with document count
    const rows = await db
      .select({
        id: tags.id,
        agentId: tags.agentId,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        documentCount: sql<number>`CAST(COUNT(${documentTags.documentId}) AS INTEGER)`,
      })
      .from(tags)
      .leftJoin(documentTags, eq(tags.id, documentTags.tagId))
      .where(eq(tags.agentId, agentId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    res.json({ tags: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

// Create a tag
adminRouter.post('/agents/:agentId/tags', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name, color } = req.body as { name: string; color?: string };

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const inserted = await db
      .insert(tags)
      .values({
        agentId,
        name: name.trim(),
        color: color || '#6b7280',
      })
      .returning();

    res.json({ tag: inserted[0] });
  } catch (err: any) {
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Tag with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update a tag
adminRouter.put('/agents/:agentId/tags/:tagId', async (req, res) => {
  try {
    const { agentId, tagId } = req.params;
    const { name, color } = req.body as { name?: string; color?: string };

    const patch: any = {};
    if (typeof name === 'string') patch.name = name.trim();
    if (typeof color === 'string') patch.color = color;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updated = await db
      .update(tags)
      .set(patch)
      .where(and(eq(tags.id, parseInt(tagId)), eq(tags.agentId, agentId)))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ tag: updated[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Tag with this name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete a tag
adminRouter.delete('/agents/:agentId/tags/:tagId', async (req, res) => {
  try {
    const { agentId, tagId } = req.params;
    const tagIdNum = parseInt(tagId);

    // Delete the tag (cascades to document_tags junction)
    await db
      .delete(tags)
      .where(and(eq(tags.id, tagIdNum), eq(tags.agentId, agentId)));

    res.json({ success: true, tagId: tagIdNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// ============================================================================
// Knowledge Base - Document Management Routes
// ============================================================================

// Move a document to a folder
adminRouter.put('/agents/:agentId/documents/:docId/move', async (req, res) => {
  try {
    const { agentId, docId } = req.params;
    const { folderId } = req.body as { folderId: number | null };

    const updated = await db
      .update(documents)
      .set({ folderId: folderId || null })
      .where(and(eq(documents.id, parseInt(docId)), eq(documents.agentId, agentId)))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move document' });
  }
});

// Change document category
adminRouter.put('/agents/:agentId/documents/:docId/category', async (req, res) => {
  try {
    const { agentId, docId } = req.params;
    const { category } = req.body as { category: 'knowledge' | 'code' | 'data' };

    const allowedCategories = ['knowledge', 'code', 'data'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be: knowledge, code, or data' });
    }

    const updated = await db
      .update(documents)
      .set({ category })
      .where(and(eq(documents.id, parseInt(docId)), eq(documents.agentId, agentId)))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Update document tags (replace all tags)
adminRouter.put('/agents/:agentId/documents/:docId/tags', async (req, res) => {
  try {
    const { agentId, docId } = req.params;
    const { tagIds } = req.body as { tagIds: number[] };
    const docIdNum = parseInt(docId);

    // Verify document exists and belongs to agent
    const docRows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docIdNum), eq(documents.agentId, agentId)))
      .limit(1);

    if (!docRows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete existing tags for this document
    await db.delete(documentTags).where(eq(documentTags.documentId, docIdNum));

    // Insert new tags (if any)
    if (tagIds && tagIds.length > 0) {
      await db.insert(documentTags).values(
        tagIds.map((tagId) => ({
          documentId: docIdNum,
          tagId,
        }))
      );
    }

    // Get updated tags for the document
    const updatedTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(tags)
      .innerJoin(documentTags, eq(tags.id, documentTags.tagId))
      .where(eq(documentTags.documentId, docIdNum));

    res.json({ tags: updatedTags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update document tags' });
  }
});

// Get documents with folder/category/tag info
adminRouter.get('/agents/:agentId/documents', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { folderId, category } = req.query as { folderId?: string; category?: string };

    // Build query conditions
    const conditions = [eq(documents.agentId, agentId)];

    if (folderId === 'null' || folderId === 'root') {
      conditions.push(isNull(documents.folderId));
    } else if (folderId) {
      conditions.push(eq(documents.folderId, parseInt(folderId)));
    }

    if (category) {
      conditions.push(eq(documents.category, category));
    }

    const docs = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(documents.title);

    // Get tags for each document
    const docsWithTags = await Promise.all(
      docs.map(async (doc) => {
        const docTags = await db
          .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
          })
          .from(tags)
          .innerJoin(documentTags, eq(tags.id, documentTags.tagId))
          .where(eq(documentTags.documentId, doc.id));

        return { ...doc, tags: docTags };
      })
    );

    res.json({ documents: docsWithTags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// Get storage stats for an agent
adminRouter.get('/agents/:agentId/storage', async (req, res) => {
  try {
    const { agentId } = req.params;

    const stats = await db
      .select({
        totalDocuments: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalSize: sql<number>`COALESCE(SUM(${documents.size}), 0)`,
        byCategory: sql<any>`json_object_agg(
          COALESCE(${documents.category}, 'knowledge'),
          CAST(COUNT(*) AS INTEGER)
        )`,
      })
      .from(documents)
      .where(eq(documents.agentId, agentId));

    // Get folder count
    const folderCount = await db
      .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(folders)
      .where(eq(folders.agentId, agentId));

    // Get tag count
    const tagCount = await db
      .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(tags)
      .where(eq(tags.agentId, agentId));

    res.json({
      storage: {
        totalDocuments: stats[0]?.totalDocuments || 0,
        totalSize: stats[0]?.totalSize || 0,
        byCategory: stats[0]?.byCategory || {},
        folderCount: folderCount[0]?.count || 0,
        tagCount: tagCount[0]?.count || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load storage stats' });
  }
});
