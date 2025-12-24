# Product Overview – Agent‑in‑a‑Box (Engineer/AI‑Agent Focus)

## 1. Purpose and Positioning

Agent‑in‑a‑Box is a **reusable, single‑agent AI platform** extracted from the AgenticLedger ecosystem.

It is designed so that **you, as an AI agent with tool access**, can:

- Stand up a fully functional **AI assistant** (chat + RAG + tools) for a new client or project.
- Reuse the same foundation each time (same schema, same HTTP surface, same widget), and then:
  - Plug in new **knowledge** (documents).
  - Plug in new **capabilities** ("tools").
  - Adjust the **agents behavior** via system prompt + LLM model.

Primary audience:

- **Backend/frontend engineers** and **infra agents** who will deploy, extend, and operate the system.
- Higher‑level product owners are secondary; this doc assumes you understand HTTP, Postgres, and TypeScript.

---

## 2. Core Product Surfaces

### 2.1 End‑User Chat Widget

A React component `AgentChatWidget` (packaged as a library) that renders a **polished, Intercom‑style assistant**:

- **Modes**
  - `mode="launcher"`: Floating button at bottom‑right, opens a chat panel.
  - `mode="inline"`: Chat panel directly rendered in a layout area.
- **Behavior**
  - On mount, it calls `POST /api/chat/start` to create a conversation.
  - On user message, it streams from `POST /api/chat/:conversationId/stream`.
  - It shows a **"Working MM:SS"** indicator while streaming.
- **Branding & Theming**
  - Uses `AgentTheme` and `applyTheme` to set:
    - Primary/secondary colors
    - Background, text color
    - Border radius
    - Font family
  - Includes a **"Powered by AgenticLedger"** footer (white‑labeling can be added later).

This widget is what gets embedded into the customers app or website. Your job as an AI engineer is to ensure:

- The widget can be **imported from the built library**.
- The embed code examples stay in sync with the actual props and theme options.
- Styling and behavior remain Intercom‑quality by default.

---

### 2.2 Admin App (Operator Console)

The **AdminApp** is a React SPA that gives non‑engineers control of the agent:

- **Widget Preview**
  - Renders `AgentChatWidget` inline so operators can see exactly what end‑users see.
- **Knowledge Base Management**
  - Uploads:
    - **Text documents** via `POST /api/kb/text`.
    - **Files** (PDF, DOCX, etc.) via `POST /api/kb/files`.
  - Lists documents via `GET /api/kb`.
  - Deletes via `DELETE /api/kb/:documentId`.
  - Shows minimal metadata (title, type, size, created date).
- **Agent Configuration**
  - Fetches agent config via `GET /api/admin/agent`.
  - Saves changes via `POST /api/admin/agent`:
    - `name`
    - `description`
    - `instructions` (system prompt)
    - `defaultModel` (LLM model ID, e.g., `claude-3-5-sonnet-latest`).
  - Changes are persisted to Postgres (`ai_agents`) and used immediately by chat.
- **Embed Code Panel**
  - Shows example code to embed the widget in a third‑party app, including:
    - `apiBaseUrl`
    - `mode="launcher"`
    - A sample `theme` object.

Future operator views:

- **Tools/Capabilities Management:** enable/disable and configure tools.
- **Conversation Logs & Analytics:** inspect conversations, tool calls, latency, and usage.

As an AI agent, you can think of AdminApp as the **source of truth for runtime configuration** that must be honored by the backend and widget.

---

### 2.3 Backend Capabilities (Tools)

The backend exposes a **capabilities framework**; the first concrete implementation is **AnyAPI**:

- Describes external API calls as **capabilities**:
  - Example capability IDs:
    - `coingecko.simple_price`
    - `openweather.current_weather`
    - `github.search_repositories`
- Each capability definition includes:
  - Parameter schema (e.g., `symbol`, `vs_currency`).
  - HTTP method, URL template, and optional headers.
- Execution:
  - An HTTP call to `/api/capabilities/anyapi/execute` triggers the capability.
  - The service calls the upstream API and returns both data and a human‑readable summary.

Your role as an AI engineer is to:

- Treat AnyAPI and other capabilities as **tool endpoints** you can call programmatically.
- Add new capabilities for each client by extending the capability definitions and wiring their secrets.

---

### 2.4 Knowledge Base & RAG

The Knowledge Base is the **primary grounding mechanism**:

- Operators upload:
  - Plain text content.
  - Files (PDF, DOCX, etc.).
- The backend:
  - Extracts text.
  - Splits into chunks.
  - Generates embeddings using OpenAI.
  - Stores them in Postgres for similarity search.

During chat:

- The chat service calls RAG:
  - `getRelevantContext(conversation)` runs a similarity search.
  - Returns a `Context:` string plus metadata for sources.
- The LLMs system prompt includes:
  - Agent instructions from DB.
  - A `Context:` section with top‑N chunks.

As an AI agent, you can rely on this to **inject domain knowledge** into responses without hard‑coding any customer‑specific content.

---

### 2.5 Deployment Targets & Integration Surface

- **Backend**
  - Node.js service (Express + Drizzle).
  - Requires Postgres + secrets for Anthropic and OpenAI.
- **Frontend**
  - Admin SPA served by Vite (or any static host).
  - Widget bundled as a library (UMD/ESM).

From an AI engineers perspective:

- Your primary "external integration surface" is:
  - The **HTTP API** under `/api/*`.
  - The **React component** interface for the widget and AdminApp.
- Everything else is implementation detail you can reason about but dont expose directly to clients.
