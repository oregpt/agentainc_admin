# Agent-in-a-Box

## License Key Generation

In production (NODE_ENV=production), env var feature flags are DISABLED.
Customers need a license key to unlock features.

### Generate a License Key

From the `server/` directory:

```bash
node -e "
const jwt = require('jsonwebtoken');
const secret = 'agenticledger-prod-secret-2024';
const payload = {
  org: 'Customer Name',
  name: 'Enterprise License',
  features: {
    multiAgent: true,
    maxAgents: 100,
    multimodal: true,
    mcpHub: true,
    allowedCapabilities: ['anyapi', 'calendar', 'weather', 'email', 'slack'],
    customBranding: true
  },
  issuedAt: Date.now()
};
const token = jwt.sign(payload, secret, { expiresIn: '1y' });
console.log(token);
"
```

### Customer adds to env:
```
LICENSE_SECRET=agenticledger-prod-secret-2024
AGENTICLEDGER_LICENSE_KEY=<generated-jwt>
```

### Feature Tiers
- **Base**: 1 agent, no multimodal, no MCP Hub, no custom branding
- **Starter**: 1 agent, multimodal enabled
- **Pro**: 5 agents, multimodal, MCP Hub, custom branding
- **Enterprise**: 100 agents, all features, all capabilities

See `LICENSE_KEY_GENERATION.md` (gitignored) for full details and example keys.

## Running Locally

```bash
# Server (from server/)
npm run dev

# Web (from web/)
npm run dev
```

Server runs on port 4000, web dev server on port 5173.

## Deployment

Railway deployment uses Dockerfile. Required env vars:
- `DATABASE_URL` - Neon PostgreSQL (must have pgvector)
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` (for embeddings)
- `NODE_ENV=production`
- `LICENSE_SECRET` + `AGENTICLEDGER_LICENSE_KEY` (for features)
