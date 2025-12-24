# Agent-in-a-Box Order Form (Client Template)

## 1. Client & Deployment Info
- **Client name:** __________________________
- **Primary contact:** ______________________
- **Target environment:** (prod / staging / sandbox / other)
- **Hosting model:** (AgenticLedger cloud / client cloud / on-prem)
- **Estimated go-live date:** _______________

---

## 2. Core Agent Definition
- **Agent name (user-facing):** __________________________
- **Short description (1–2 sentences):**
  - ________________________________________________
- **Default tone & persona:** (e.g., friendly, formal, expert, playful)
  - ________________________________________________
- **Primary use cases / responsibilities:**
  - [ ] Customer support
  - [ ] Internal knowledge assistant
  - [ ] Analytics / reporting assistant
  - [ ] Workflow / integration assistant
  - [ ] Other: ______________________________________

- **Default LLM provider & model (foundation):**
  - Provider: `claude` (default; others on request)
  - Model: `claude-3-5-sonnet-latest` (or specify): ____________________

---

## 3. Chat Interface
### 3.1 Embedding & Placement
- **Integration target(s):**
  - [ ] Web app (React / SPA)
  - [ ] Static marketing site
  - [ ] Internal portal
  - [ ] Desktop app / Electron
  - [ ] Other: _______________________

- **Where will the widget appear?**
  - [ ] Floating launcher (bottom-right)
  - [ ] Inline panel
  - [ ] Full-page experience

- **Approximate concurrency / daily active users:** ___________________

### 3.2 Chat Behavior
- **Streaming behavior:**
  - [x] Claude-style streaming (partial tokens as they arrive)
  - [ ] Single-turn responses only (no streaming)

- **Conversation persistence:**
  - [x] Persist conversations in DB (recommended)
  - [ ] Ephemeral (no server-side history)

- **Max conversation history to send to LLM:**
  - [ ] Last 5 messages
  - [ ] Last 10 messages (default)
  - [ ] Custom: ____________

---

## 4. Knowledge Base (Documents)
### 4.1 Data Types
Which content will ground the agent?
- [ ] Internal PDFs / docs
- [ ] Product documentation
- [ ] Policies / compliance
- [ ] FAQs
- [ ] Markdown / knowledge articles
- [ ] CSV / structured files
- [ ] URLs / web pages (optional future extension)

### 4.2 Volume & Limits
- **Initial document count:** ~__________ files
- **Average file size:** ~__________ MB
- **Maximum expected total volume:** ~__________ GB

- **Desired limits (per agent):**
  - Max files: __________
  - Max file size (MB): __________
  - Max total storage (GB): __________

### 4.3 Update Model
- **How often will content change?**
  - [ ] Rarely
  - [ ] Weekly
  - [ ] Daily
  - [ ] High frequency (multiple times per day)

- **Who will manage uploads?** (role/team): ____________________

---

## 5. RAG Configuration
### 5.1 Retrieval Style
- **Retrieval aggressiveness:**
  - [ ] Conservative (only very relevant chunks)
  - [x] Balanced (default)
  - [ ] Aggressive (more context even if loosely related)

- **Maximum tokens for context per answer:**
  - [ ] 1,000
  - [x] 2,000 (default)
  - [ ] 4,000
  - [ ] Custom: __________

### 5.2 Citations
- **Citation display:**
  - [x] Show "Sources" section below answer
  - [ ] Inline citations only
  - [ ] No citations (not recommended)

- **Source label format:**
  - [ ] Document title only
  - [ ] Document title + snippet
  - [ ] Custom: _________________________

---

## 6. Capabilities (Tools)
> Core framework supports MCP-style capabilities. For v1 we recommend enabling **AnyAPI** for HTTP-based integrations.

### 6.1 AnyAPI (HTTP Integrations)
- **Enable AnyAPI capability?**  [ ] Yes   [ ] No

If yes, specify which external APIs you want enabled **now**:
- [ ] CoinGecko (crypto prices)
- [ ] OpenWeatherMap (weather)
- [ ] GitHub (repos/users search)
- [ ] Other HTTP APIs (list endpoints / docs):
  - __________________________________________
  - __________________________________________

For each selected API, provide or confirm:
- Base URL
- Required auth type (API key / bearer token)
- Expected usage patterns (read-only vs write)

### 6.2 Future Capabilities (not in v1 but supported by framework)
- [ ] Slack (messaging)
- [ ] Notion (knowledge/content)
- [ ] Gmail / Calendar
- [ ] QuickBooks / finance
- [ ] Blockchain / CCView / Canton analytics

_Note: These can be enabled later using the same capability framework without refactoring core code._

---

## 7. Theming & Branding
### 7.1 Visual Theme
- **Primary color:** ____________________ (hex or CSS value)
- **Secondary / background color:** ____________________
- **Text color:** ____________________
- **Border radius:** ____________________ (e.g., `0.75rem`, `999px`)
- **Font family:** ____________________ (e.g., system, brand font)

### 7.2 Logos & Assets
- **Widget logo URL:** ____________________
- **Favicon / icon (if applicable):** ____________________

### 7.3 Copy & Labels
- **Launcher label / CTA (if floating widget):** "__________"
- **Default greeting message (first load):**
  - __________________________________________

---

## 8. Authentication & Security
- **Access model for the widget:**
  - [ ] Public (no auth)
  - [ ] Authenticated users only (host app manages auth)

- **How will we receive user identity (if any)?**
  - [ ] `externalUserId` string from host app
  - [ ] JWT / session cookie (future extension)

- **Data residency / storage requirements:**
  - __________________________________________

---

## 9. Environments & URLs
- **Agent-in-a-Box API base URL(s):**
  - Staging: ____________________
  - Production: __________________

- **Embedding hosts / origins (CORS):**
  - __________________________________________

---

## 10. Roadmap & Upgrades
- **Planned future capabilities / integrations:**
  - __________________________________________
- **Planned future data sources (KB expansions):**
  - __________________________________________

- **Upgrade preferences:**
  - [ ] Automatic adoption of core upgrades
  - [ ] Manual review per release
