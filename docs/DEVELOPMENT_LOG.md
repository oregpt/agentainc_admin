# Agent-in-a-Box Development Log

This document tracks the development journey, features added, issues resolved, and architectural decisions made throughout the project.

---

## December 24, 2025

### Multi-Agent Architecture

**Feature Added:** Full multi-agent support across the platform

The system now supports multiple agents that can be managed independently:

- **Database Schema Update:** Added `ai_agents` table with support for multiple agents
  - Each agent has: `id`, `slug`, `name`, `description`, `instructions`, `defaultModel`
  - Added `modelMode` column (`single` | `multi`) for model selection behavior
  - Added `allowedModels` (JSONB) to store array of allowed model IDs when in multi-mode

- **Admin Routes:** Full CRUD for agents
  - `GET /api/admin/agents` - List all agents
  - `POST /api/admin/agents` - Create new agent
  - `GET /api/admin/agents/:agentId` - Get specific agent
  - `PUT /api/admin/agents/:agentId` - Update agent
  - `DELETE /api/admin/agents/:agentId` - Delete agent (prevents deleting last agent)

- **UI Updates:**
  - Agent selector dropdown added to **Chat Preview** page
  - Agent selector dropdown added to **Knowledge Base** page
  - Agent selector dropdown added to **Configuration** page

**Files Modified:**
- `server/src/db/schema.ts` - Added modelMode, allowedModels columns
- `server/src/db/init.ts` - Added ALTER TABLE statements for existing DBs
- `server/src/http/adminRoutes.ts` - Added multi-agent CRUD endpoints
- `web/src/App.tsx` - Added agent selectors to ChatPage and KnowledgePage
- `web/src/pages/AgentConfig.tsx` - Updated to work with multi-agent system

---

### Model Mode Selection (Single vs Multi-Model)

**Feature Added:** Flexible model selection per agent

Agents can now be configured in two modes:

1. **Single Model Mode** (default)
   - Agent uses one fixed model
   - Model dropdown in Configuration page
   - End users see no model selection in chat

2. **Multi-Model Mode**
   - Admin selects allowed models from a checkbox list
   - Sets a default model for new conversations
   - End users see a model dropdown in the chat interface
   - Changing model starts a new conversation

**Implementation Details:**
- Agent Configuration page has toggle buttons: "Single Model" | "Multi-Model"
- When "Multi-Model" selected:
  - Shows multi-select checkboxes for allowed models
  - Shows default model dropdown (filtered to allowed models)
- Chat page checks agent's `modelMode` on load
- If `multi`, displays model selector in chat header
- Model change triggers new conversation (`conversationKey` increments)

**Files Modified:**
- `web/src/pages/AgentConfig.tsx` - Model mode toggle and multi-select UI
- `web/src/App.tsx` - Model selector in ChatPage for multi-model agents

---

### Knowledge Base Improvements

**Feature Changed:** Removed text paste, pure file upload only

- Removed the "Paste Reference Text" section from Knowledge Base Manager
- Knowledge Base is now exclusively file upload (PDF, DOCX, TXT, MD)
- Cleaner UI focused on document management

**Files Modified:**
- `web/src/KnowledgeBaseManager.tsx` - Removed text paste section

---

### Database Initialization Improvements

**Issue Resolved:** `column "category" does not exist` error

**Problem:** The `ai_capabilities` table was created before the `category` column was added to the schema. The `CREATE TABLE IF NOT EXISTS` statement doesn't add new columns.

**Solution:** Added `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in `db/init.ts` to handle schema evolution for existing databases:

```typescript
// Add missing columns to existing tables
await db.execute(sql`
  ALTER TABLE ai_capabilities ADD COLUMN IF NOT EXISTS category VARCHAR(64)
`).catch(() => {});

await db.execute(sql`
  ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS model_mode VARCHAR(16) DEFAULT 'single'
`).catch(() => {});

await db.execute(sql`
  ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS allowed_models JSONB
`).catch(() => {});
```

**Files Modified:**
- `server/src/db/init.ts` - Added ALTER TABLE statements for schema migration

---

### pgvector Support for RAG

**Feature Added:** Native vector similarity search

- Added pgvector extension support for embedding storage
- `ai_document_chunks.embedding` column uses `vector(1536)` type
- Automatic migration from text to vector type for existing data
- IVFFlat index created for fast similarity search

**Database Changes:**
- `CREATE EXTENSION IF NOT EXISTS vector`
- Embedding column type: `vector(1536)` (OpenAI text-embedding-3-small dimension)
- Index: `idx_document_chunks_embedding` using IVFFlat with cosine similarity

**Files Modified:**
- `server/src/db/schema.ts` - Custom pgvector type definition
- `server/src/db/init.ts` - Extension creation and migration logic

---

### Capabilities System (MCP Hub)

**Feature Added:** Extensible capabilities framework

The capabilities system allows agents to use external tools:

- **Capability Types:**
  - `mcp` - Model Context Protocol servers
  - `anyapi` - JSON-configurable API integrations

- **Per-Agent Enablement:**
  - Each capability can be enabled/disabled per agent
  - Secure token storage with AES-256-GCM encryption
  - Support for up to 5 tokens per capability (for complex OAuth flows)

- **Built-in Capabilities:**
  - CoinGecko (crypto prices)
  - OpenWeather (weather data)
  - GitHub (repository search)

**Admin Routes:**
- `GET /api/admin/capabilities` - List capabilities with enablement status
- `POST /api/admin/capabilities/:capabilityId/toggle` - Enable/disable
- `POST /api/admin/capabilities/:capabilityId/tokens` - Set credentials
- `DELETE /api/admin/capabilities/:capabilityId/tokens` - Remove credentials

**Files Modified:**
- `server/src/db/schema.ts` - capabilities, agentCapabilities, capabilityTokens tables
- `server/src/capabilities/` - Capability service and registry
- `server/src/http/adminRoutes.ts` - Capability management endpoints
- `web/src/pages/Capabilities.tsx` - Capabilities management UI

---

## Architecture Decisions

### Why Multi-Agent?
Different use cases need different agent behaviors. A single deployment can now serve:
- Customer support agent (friendly, references FAQs)
- Technical docs assistant (precise, references API docs)
- Internal knowledge agent (access to internal docs)

Each agent can have its own knowledge base, instructions, and model configuration.

### Why Model Mode Selection?
Some deployments need a fixed model (cost control, consistency), while others benefit from letting users choose (power users, testing). The mode toggle makes both use cases easy.

### Why pgvector over in-memory?
In-memory cosine similarity doesn't scale. With pgvector:
- Queries stay fast as document count grows
- Database handles all the heavy lifting
- Proper indexing (IVFFlat/HNSW) for production workloads

---

### Platform API Keys (Encrypted Storage)

**Feature Added:** Configure LLM API keys via the UI with encrypted storage

Previously, API keys (Anthropic, OpenAI) had to be set via environment variables. Now:
- Collapsible "Platform API Keys" section added to Configuration page
- Keys are encrypted with AES-256-GCM before storage in database
- Shows status: "Set via environment variable", "Configured (encrypted)", or "Not configured"
- Environment variables take priority over database values
- Supports: Anthropic, OpenAI, Gemini, Grok

**Database Changes:**
- New table: `ai_platform_settings` (key, encrypted_value, iv, timestamps)

**Backend Routes:**
- `GET /api/admin/platform/settings` - Get all keys with configured/env status
- `POST /api/admin/platform/settings/:key` - Set an API key (encrypted)
- `DELETE /api/admin/platform/settings/:key` - Remove an API key

**Files Modified:**
- `server/src/db/schema.ts` - Added platformSettings table
- `server/src/db/init.ts` - Create table on startup
- `server/src/capabilities/capabilityService.ts` - Platform settings methods + getPlatformApiKey helper
- `server/src/http/adminRoutes.ts` - Platform settings routes
- `web/src/pages/AgentConfig.tsx` - Collapsible Platform API Keys section with modal

---

### Per-Agent Capability Management

**Feature Added:** Each agent can have different capabilities enabled

Previously, capabilities were global. Now:
- Agent selector dropdown added to Capabilities page
- Switching agents shows that agent's enabled/disabled capabilities
- Toggle switch enables/disables capability for the selected agent
- API credentials are stored per-agent (each agent can have different API keys)

**Backend Changes:**
- `GET /api/admin/capabilities?agentId=xxx` - Query param for agent-specific capabilities
- `POST /api/admin/capabilities/:capabilityId/toggle` - Body includes `agentId`
- `POST /api/admin/capabilities/:capabilityId/tokens` - Body includes `agentId`
- `DELETE /api/admin/capabilities/:capabilityId/tokens?agentId=xxx` - Query param for agent

**Files Modified:**
- `server/src/http/adminRoutes.ts` - All capability routes now accept agentId
- `web/src/pages/Capabilities.tsx` - Added agent selector, passes agentId to all API calls

---

### Per-Agent API Keys (Refactored)

**Feature Changed:** API keys are now per-agent instead of global platform settings

Previously, there was a global `ai_platform_settings` table. Now:
- Each agent can have its own API keys (Anthropic, OpenAI, Gemini, Grok)
- Keys are stored encrypted with AES-256-GCM in `ai_agent_api_keys` table
- **Environment variables are FALLBACK**, not primary - agent-specific keys take priority
- When agent has no key configured, the system falls back to environment variables
- UI shows "Configured (encrypted)" for agent keys, "Using environment variable (fallback)" for env vars

**Database Changes:**
- New table: `ai_agent_api_keys` (agent_id, key, encrypted_value, iv, timestamps)
- Unique constraint on (agent_id, key) pair

**Backend Routes:**
- `GET /api/admin/agents/:agentId/api-keys` - Get all keys status for an agent
- `POST /api/admin/agents/:agentId/api-keys/:key` - Set an API key for an agent
- `DELETE /api/admin/agents/:agentId/api-keys/:key` - Remove an API key for an agent

**Helper Function:**
```typescript
// In capabilityService.ts - checks agent DB first, then falls back to env var
export async function getAgentApiKeyWithFallback(agentId: string, key: string): Promise<string | null>
```

**Files Modified:**
- `server/src/db/schema.ts` - Changed platformSettings to agentApiKeys with agentId
- `server/src/db/init.ts` - Updated table creation with new schema
- `server/src/capabilities/capabilityService.ts` - Per-agent API key methods
- `server/src/http/adminRoutes.ts` - Per-agent API key routes
- `web/src/pages/AgentConfig.tsx` - Updated to use per-agent routes, renamed section

---

### Full Branding & Theming System

**Feature Added:** Complete widget customization per agent

Each agent can now have fully customized branding:

**Customizable Properties:**
- **Header**: Title, subtitle, gradient colors
- **Avatar**: Custom image URL or fallback label
- **Welcome Message**: Title and message text
- **Colors**: Primary, background, text, user bubble colors
- **Typography**: Font family selection (Inter, Roboto, Open Sans, Poppins, Georgia)
- **Shape**: Border radius (square to pill-shaped)
- **Input**: Placeholder text customization

**Database Changes:**
- Added `branding` JSONB column to `ai_agents` table
- Stores full theme object per agent

**Backend Routes:**
- `PUT /api/admin/agents/:agentId/branding` - Update branding for an agent
- Agent GET/PUT routes now include branding in response/request

**Frontend Changes:**
- New "Branding & Appearance" collapsible section in Configuration page
- Color pickers with hex input
- Font family and border radius dropdowns
- Live preview when chatting (branding merges with defaults)

**Widget Updates:**
- `AgentChatWidget` now uses CSS variables for all themeable properties
- Header, avatars, message bubbles, input area all respect theme
- Avatar can show custom image or text label

**Files Modified:**
- `web/src/theme.ts` - Expanded to 25+ theme properties
- `server/src/db/schema.ts` - Added branding column
- `server/src/db/init.ts` - ALTER TABLE for existing DBs
- `server/src/http/adminRoutes.ts` - Branding route + agent update
- `web/src/AgentChatWidget.tsx` - Full theme support
- `web/src/pages/AgentConfig.tsx` - Branding section UI

---

### Avatar Image Upload

**Feature Added:** File upload for agent avatars instead of URL input

Previously, the avatar setting required a URL. Now admins can upload images directly:

**Frontend Changes:**
- Avatar section in Branding & Appearance now has a file picker
- Live preview of the uploaded avatar
- "Upload Image" / "Change Image" buttons
- "Remove" button to delete uploaded avatar
- Fallback label field (shown if no image)
- File validation: JPEG, PNG, GIF, WebP, SVG (max 5MB)

**Backend Changes:**
- Added multer for file upload handling
- `POST /api/admin/agents/:agentId/avatar` - Upload avatar image
- `DELETE /api/admin/agents/:agentId/avatar` - Remove avatar image
- Files stored in `/uploads` directory, served statically
- Old avatars automatically deleted when replaced

**Implementation Details:**
- Files named: `avatar-{agentId}-{timestamp}.{ext}`
- Stored as `/uploads/avatar-xxx.png` (relative URL in branding.avatarUrl)
- Widget resolves relative URLs by prepending apiBaseUrl
- Automatic cleanup of old avatars on replacement

**Files Modified:**
- `server/src/http/app.ts` - Static file serving for uploads
- `server/src/http/adminRoutes.ts` - Avatar upload/delete routes with multer
- `web/src/pages/AgentConfig.tsx` - File picker UI with preview
- `web/src/AgentChatWidget.tsx` - Resolve relative avatar URLs

---

### Admin Console Light/Dark Mode

**Feature Added:** Theme toggle for the admin console with AgenticLedger-style light mode

The admin console now supports both light and dark modes:

- **Light Mode** (default): Matches AgenticLedger-Prod styling
  - White backgrounds (`#ffffff`)
  - Primary Blue (`#3b82f6`)
  - Light gray borders (`#e2e8f0`)
  - Near-black text (`#0f172a`)

- **Dark Mode**: Original dark styling preserved
  - Dark backgrounds (`#0f172a`, `#020617`)
  - Same primary blue accent
  - Dark gray borders (`#374151`)
  - Light text (`#e5e7eb`)

**Implementation:**
- New `AdminThemeContext.tsx` with React Context for theme state
- Theme toggle button in header (sun/moon icons)
- localStorage persistence for user preference
- Defaults to light mode

**Files Modified:**
- `web/src/AdminThemeContext.tsx` - New theme context with color palettes
- `web/src/App.tsx` - Wrapped in AdminThemeProvider, added ThemeToggle
- `web/src/pages/AgentConfig.tsx` - Updated to use theme colors
- `web/src/pages/Capabilities.tsx` - Updated to use theme colors
- `web/src/KnowledgeBaseManager.tsx` - Updated to use theme colors
- `web/src/pages/Tools.tsx` - Updated to use theme colors

---

### Knowledge Base Manager Enhancement

**Feature Added:** Full-featured document management system matching AgenticLedger-Prod

The Knowledge Base Manager has been completely rewritten with professional features:

**Database Changes:**
- **New Tables:**
  - `ai_folders` - Hierarchical folder structure with parent_id for nesting
  - `ai_tags` - Tag definitions per agent with custom colors
  - `ai_document_tags` - Many-to-many junction table
- **Modified Tables:**
  - `ai_documents` - Added `folder_id` and `category` columns

**Backend Endpoints (15 new routes):**
| Category | Endpoints |
|----------|-----------|
| Folders | GET/POST/PUT/DELETE `/agents/:agentId/folders` |
| Tags | GET/POST/PUT/DELETE `/agents/:agentId/tags` |
| Documents | PUT `/documents/:docId/move`, `/category`, `/tags` |
| Storage | GET `/agents/:agentId/storage` |

**Frontend Components:**
- `components/FolderTree.tsx` - Collapsible nested folder tree with context menu
- `components/DocumentList.tsx` - Sortable table with category badges and tag pills
- `components/CategoryBadge.tsx` - Color-coded category indicators
- `components/TagManager.tsx` - Full CRUD modal with color picker

**UI Features:**
- Two-column layout (folder tree | document list)
- Category system: Knowledge (green), Code (purple), Data (blue)
- Tag management with custom colors
- Upload modal with folder/category selection
- Move documents between folders
- Category filter buttons
- Storage stats footer (document count, size, folders, tags)

**Files Modified:**
- `server/src/db/schema.ts` - New tables
- `server/src/db/init.ts` - Migrations with indexes
- `server/src/http/adminRoutes.ts` - All folder/tag/document routes
- `web/src/components/` - 4 new component files
- `web/src/KnowledgeBaseManager.tsx` - Complete rewrite

---

### Chat Widget Polish (Intercom/Pylon Style)

**Feature Added:** Professional chat widget with modern UX patterns

The AgentChatWidget has been completely revamped with Intercom-style polish:

**Launcher Mode Features:**
- Circular floating button in bottom-right corner (configurable: bottom-left)
- Smooth slide-up animation when opening chat panel
- Fade-out animation when closing
- Unread message badge with red notification dot
- High z-index (999999) for proper layering on any page
- Hover effect with scale and shadow transitions

**Typing Indicator:**
- Animated bouncing dots (3 dots with staggered timing)
- Shows while waiting for AI response
- Avatar displays next to typing indicator
- Smooth animation using CSS keyframes

**Visual Improvements:**
- Relative timestamps ("Just now", "2m ago", "Yesterday")
- Timestamps shown between messages when gap > 1 minute
- Improved message bubble styling with different corner radii
- Scale-in animation for new messages
- Better gradient header with online status indicator
- Close button in header (X icon)

**File Attachments:**
- Paperclip button to attach files
- Supports: images, PDF, DOC, DOCX, TXT, MD
- Max 5 files per message
- Preview strip shows attached files before sending
- Remove button (×) on each attachment

**Pre-Chat Form (Optional):**
- Configurable via `preChatForm` prop (default: off)
- Collects name and email before first message
- Customizable title and subtitle
- Clean centered layout with avatar display

**New Props:**
```typescript
interface AgentChatWidgetProps {
  apiBaseUrl: string;
  agentId?: string;
  theme?: Partial<AgentTheme>;
  mode?: 'inline' | 'launcher';  // launcher = floating bubble
  position?: 'bottom-right' | 'bottom-left';
  preChatForm?: {
    enabled: boolean;
    fields?: { name?: boolean; email?: boolean };
    title?: string;
    subtitle?: string;
  };
}
```

**CSS Animations Added:**
- `agentinabox-slideUp` - Chat panel entrance
- `agentinabox-slideDown` - Chat panel exit
- `agentinabox-bounce` - Typing indicator dots
- `agentinabox-scaleIn` - Message appearance
- `agentinabox-pulse` - Status indicator

**Embeddability:**
- All styles are inline or injected as scoped keyframes
- No global CSS pollution
- Works on any website without conflicts
- Fixed positioning with configurable placement

**Files Modified:**
- `web/src/AgentChatWidget.tsx` - Complete rewrite with all features
- `web/src/theme.ts` - Added `--agent-text-secondary` CSS variable

---

### Multi-Select Document Management

**Feature Added:** Bulk operations for documents in Knowledge Base

The DocumentList component now supports multi-select functionality:

**UI Features:**
- Checkbox column for selecting individual documents
- Header checkbox for select all (up to 20)
- Maximum selection limit of 20 documents at a time
- Bulk action toolbar appears when documents are selected
- Selected documents are highlighted with primary color

**Bulk Operations:**
- **Apply Tags**: Opens a modal to select tags to apply to all selected documents
- **Delete**: Bulk delete with confirmation prompt
- Selection automatically clears after bulk operation completes

**Backend Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/agents/:agentId/documents/bulk-tags` | Apply tags to multiple documents |
| POST | `/api/admin/agents/:agentId/documents/bulk-delete` | Delete multiple documents |

**Files Modified:**
- `web/src/components/DocumentList.tsx` - Added multi-select state, checkbox column, bulk action toolbar, bulk tag modal
- `web/src/KnowledgeBaseManager.tsx` - Added bulk operation handlers and wired to DocumentList
- `server/src/http/adminRoutes.ts` - Added bulk-tags and bulk-delete endpoints

---

### Capability Command Selector

**Feature Added:** Quick command selector for enabled capabilities in chat widget

A new command button (⚡ lightning bolt) appears in the chat input area when the agent has enabled capabilities. This provides quick access to common actions.

**UI Flow:**
1. Click the ⚡ button to open the command popover
2. See list of enabled capabilities with icons and descriptions
3. Click a capability to see its available commands
4. Each command shows:
   - Shortcut (e.g., `/price`, `/weather`)
   - Natural language query
   - Category badge (query/action/analysis)
5. Two action buttons per command:
   - "Insert & Edit" - puts text in input for modification
   - "Send →" - sends immediately

**Backend Endpoint:**
```
GET /api/capabilities/agent/:agentId
```
Returns only enabled capabilities for a specific agent (used by widget).

**Implementation Details:**
- `CAPABILITY_METADATA` - Maps capability IDs to icons, colors, display names
- `CAPABILITY_COMMANDS` - Predefined commands per capability (shortcut, natural language, category)
- Fallback for unknown capabilities with generic commands
- Click-outside detection to close popover
- Smooth scale-in animation for popover

**Capabilities with Commands:**
| Capability | Commands |
|------------|----------|
| coingecko | /price, /trending, /market |
| openweather | /weather, /forecast |
| anyapi | /api, /list-apis |
| slack | /send-slack, /channels |
| gmail | /inbox, /send-email |
| calendar | /events, /schedule |
| sheets | /read-sheet, /update-sheet |
| docs | /create-doc, /read-doc |

**Files Modified:**
- `server/src/http/capabilityRoutes.ts` - Added `/agent/:agentId` endpoint
- `web/src/AgentChatWidget.tsx` - Added command button, popover, metadata, handlers

---

## Known Issues / TODO

1. ~~**Capabilities tab shows "Failed to load"**~~ - Fixed: Added ALTER TABLE for `category` column
2. **No conversation history per agent** - Conversations table exists but UI doesn't expose agent-specific history
3. **Widget doesn't pass model selection** - Need to wire selected model through to chat API

---

## Changelog Summary

| Date | Feature | Impact |
|------|---------|--------|
| Dec 24, 2025 | Multi-agent architecture | Breaking - agents now have IDs |
| Dec 24, 2025 | Model mode selection | Additive - existing agents default to single |
| Dec 24, 2025 | Knowledge Base file-only | Breaking - text paste removed |
| Dec 24, 2025 | pgvector embeddings | Breaking - requires pgvector extension |
| Dec 24, 2025 | Capabilities system | Additive - new tables and routes |
| Dec 24, 2025 | Per-agent capabilities | Additive - agent selector on capabilities page |
| Dec 24, 2025 | Per-Agent API Keys | Additive - encrypted storage per agent |
| Dec 24, 2025 | Full Branding System | Additive - 25+ customizable theme properties |
| Dec 24, 2025 | Avatar File Upload | Additive - file picker replaces URL input |
| Dec 24, 2025 | Admin Light/Dark Mode | Additive - theme toggle with AgenticLedger-style light mode |
| Dec 24, 2025 | Knowledge Base Enhancement | Major - folders, tags, categories, full rewrite |
| Dec 24, 2025 | Multi-Select Documents | Additive - bulk category assignment, bulk delete (max 20) |
| Dec 24, 2025 | Chat Widget Polish | Major - Intercom-style launcher, typing indicator, file attachments |
| Dec 24, 2025 | Capability Command Selector | Additive - quick command menu in chat widget |
