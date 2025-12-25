#!/usr/bin/env npx ts-node
/**
 * License Key Generator
 *
 * Usage:
 *   LICENSE_SECRET=your-secret npx ts-node scripts/generate-license.ts --org "acme-corp" --tier pro
 *
 * Options:
 *   --org <name>       Organization name (required)
 *   --name <name>      License display name (optional)
 *   --tier <tier>      Preset tier: base, pro, enterprise (default: base)
 *   --expires <time>   Expiration time: 1y, 6m, 30d, etc (optional)
 *   --decode <key>     Decode an existing license key
 *
 * Custom features (override tier defaults):
 *   --multi-agent      Enable multi-agent
 *   --max-agents <n>   Max agents allowed
 *   --multimodal       Enable multimodal
 *   --mcp-hub          Enable MCP Hub
 *   --capabilities <list>  Comma-separated capability IDs (or '*' for all)
 *   --custom-branding  Enable custom branding
 *
 * Environment:
 *   LICENSE_SECRET     Required - the signing secret
 *
 * Examples:
 *   # Generate a pro license for ACME Corp, expires in 1 year
 *   LICENSE_SECRET=mysecret npx ts-node scripts/generate-license.ts --org "acme-corp" --tier pro --expires 1y
 *
 *   # Generate an enterprise license with all features
 *   LICENSE_SECRET=mysecret npx ts-node scripts/generate-license.ts --org "enterprise-inc" --tier enterprise
 *
 *   # Decode an existing key to see its contents
 *   npx ts-node scripts/generate-license.ts --decode "eyJhbGciOiJIUzI1NiJ9..."
 */

import jwt from 'jsonwebtoken';

// Tier presets
const TIERS = {
  base: {
    multiAgent: false,
    maxAgents: 1,
    multimodal: false,
    mcpHub: false,
    allowedCapabilities: [] as string[],
    customBranding: false,
  },
  pro: {
    multiAgent: true,
    maxAgents: 5,
    multimodal: true,
    mcpHub: true,
    allowedCapabilities: ['*'],
    customBranding: true,
  },
  enterprise: {
    multiAgent: true,
    maxAgents: 999,
    multimodal: true,
    mcpHub: true,
    allowedCapabilities: ['*'],
    customBranding: true,
  },
};

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return result;
}

function decodeKey(key: string): void {
  try {
    const decoded = jwt.decode(key, { complete: true });

    if (!decoded) {
      console.error('Failed to decode license key');
      process.exit(1);
    }

    console.log('\n=== License Key Decoded ===\n');
    console.log('Header:', JSON.stringify(decoded.header, null, 2));
    console.log('\nPayload:', JSON.stringify(decoded.payload, null, 2));

    // Check expiration
    const payload = decoded.payload as { exp?: number };
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      if (expDate < now) {
        console.log('\n⚠️  This license has EXPIRED:', expDate.toISOString());
      } else {
        console.log('\n✓ License expires:', expDate.toISOString());
      }
    } else {
      console.log('\n✓ License does not expire');
    }

    console.log('\n');
  } catch (err) {
    console.error('Error decoding license key:', err);
    process.exit(1);
  }
}

function generateKey(args: Record<string, string | boolean>): void {
  const secret = process.env.LICENSE_SECRET;

  if (!secret) {
    console.error('ERROR: LICENSE_SECRET environment variable is required');
    console.error('Usage: LICENSE_SECRET=your-secret npx ts-node scripts/generate-license.ts ...');
    process.exit(1);
  }

  const org = args.org as string;
  if (!org) {
    console.error('ERROR: --org is required');
    process.exit(1);
  }

  // Start with tier preset
  const tier = (args.tier as string) || 'base';
  if (!TIERS[tier as keyof typeof TIERS]) {
    console.error(`ERROR: Unknown tier "${tier}". Valid tiers: base, pro, enterprise`);
    process.exit(1);
  }

  const features = { ...TIERS[tier as keyof typeof TIERS] };

  // Apply overrides
  if (args['multi-agent']) features.multiAgent = true;
  if (args['max-agents']) features.maxAgents = parseInt(args['max-agents'] as string, 10);
  if (args['multimodal']) features.multimodal = true;
  if (args['mcp-hub']) features.mcpHub = true;
  if (args['capabilities']) {
    const caps = args['capabilities'] as string;
    features.allowedCapabilities = caps === '*' ? ['*'] : caps.split(',').map((s) => s.trim());
  }
  if (args['custom-branding']) features.customBranding = true;

  // Build payload
  const payload = {
    org,
    name: args.name as string | undefined,
    features,
    issuedAt: Date.now(),
  };

  // Sign options
  const signOptions: jwt.SignOptions = {};
  if (args.expires) {
    signOptions.expiresIn = args.expires as string;
  }

  // Generate token
  const token = jwt.sign(payload, secret, signOptions);

  console.log('\n=== License Key Generated ===\n');
  console.log('Organization:', org);
  if (args.name) console.log('Name:', args.name);
  console.log('Tier:', tier);
  console.log('Features:', JSON.stringify(features, null, 2));
  if (args.expires) console.log('Expires in:', args.expires);
  console.log('\n--- LICENSE KEY ---\n');
  console.log(token);
  console.log('\n--- END LICENSE KEY ---\n');
  console.log('Add to .env file:');
  console.log(`AGENTICLEDGER_LICENSE_KEY="${token}"`);
  console.log('\n');
}

// Main
const args = parseArgs(process.argv.slice(2));

if (args.decode) {
  decodeKey(args.decode as string);
} else if (args.help || args.h) {
  console.log(`
License Key Generator

Usage:
  LICENSE_SECRET=xxx npx ts-node scripts/generate-license.ts --org "name" [options]

Options:
  --org <name>           Organization name (required)
  --name <name>          License display name
  --tier <tier>          Preset: base, pro, enterprise (default: base)
  --expires <time>       Expiration: 1y, 6m, 30d, etc
  --decode <key>         Decode an existing license key

Feature overrides:
  --multi-agent          Enable multi-agent
  --max-agents <n>       Max agents allowed
  --multimodal           Enable multimodal
  --mcp-hub              Enable MCP Hub
  --capabilities <list>  Comma-separated IDs or '*' for all
  --custom-branding      Enable custom branding

Examples:
  # Pro license for 1 year
  LICENSE_SECRET=xxx npx ts-node scripts/generate-license.ts --org "acme" --tier pro --expires 1y

  # Enterprise license (never expires)
  LICENSE_SECRET=xxx npx ts-node scripts/generate-license.ts --org "bigcorp" --tier enterprise

  # Custom: base + just MCP Hub with specific capabilities
  LICENSE_SECRET=xxx npx ts-node scripts/generate-license.ts --org "custom" --mcp-hub --capabilities "coingecko,openweather"
`);
} else {
  generateKey(args);
}
