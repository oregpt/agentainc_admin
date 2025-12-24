import { loadConfig } from './config/appConfig';
import { createHttpApp } from './http/app';
import { getOrchestrator } from './mcp-hub';
import { anyapiServer } from './mcp-hub/servers/anyapi';
import { capabilityService } from './capabilities';
import { initializeDatabase } from './db/init';

const config = loadConfig();
const app = createHttpApp();

// Initialize MCP Hub and capabilities
async function initializeMCPHub() {
  try {
    const orchestrator = getOrchestrator();

    // Register the AnyAPI MCP server
    await orchestrator.registerServer(anyapiServer);

    console.log('[server] MCP Hub initialized successfully');
  } catch (error) {
    console.error('[server] Failed to initialize MCP Hub:', error);
  }
}

async function initializeCapabilities() {
  try {
    // Seed default capabilities
    await capabilityService.seedDefaultCapabilities();
    console.log('[server] Default capabilities seeded');
  } catch (error) {
    console.error('[server] Failed to seed capabilities:', error);
  }
}

// Start server
app.listen(config.port, async () => {
  console.log(`Agent-in-a-Box server listening on port ${config.port}`);

  // Initialize database (pgvector extension, migrations)
  await initializeDatabase();

  // Initialize MCP Hub and capabilities after server starts
  await initializeMCPHub();
  await initializeCapabilities();
});
