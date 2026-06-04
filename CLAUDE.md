# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Start the server:**
```bash
npm start          # runs: node server.js
```

**Install dependencies:**
```bash
npm install
```

There is no test suite or linter configured in this project.

**Database setup** (run once in Supabase SQL Editor):
```bash
# Open scripts/setup_db.sql and paste its contents into the Supabase SQL Editor
```

## Environment Variables

Create a `.env` file with:
```
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
FRONTEND_URL=...        # optional, defaults to * (all origins)
PORT=3001               # optional, defaults to 3001
```

## Architecture

This is a **Node.js/Express AI chatbot backend** (the "Nexus AI Operating System") running on port 3001. It exposes a chat API consumed by an embeddable frontend widget (`public/widget.js`). The system is designed as a multi-agent OS, though the DAG execution loop is currently a POC/incomplete.

### Request Flow

```
Client widget → POST /api/chat
  → Kernel.dispatch()
    → ContextBroker.getContext()   (loads last 10 messages from Supabase)
    → Kernel.route()               (always returns ManagerAgent if registered)
      → ManagerAgent.run()
        → Blackboard.post()        (records user_request entry)
        → Kernel.callLLM()         (asks LLM to produce a task DAG as JSON)
        → Blackboard.post()        (records plan + initial task assignments)
        → returns generic "plan created" reply
  → ContextBroker.saveMessage()   (persists user msg + reply to chat_logs)
  → res.json({ reply, agent })
```

### Core Modules

**`src/os-core/Kernel.js`** — Central orchestrator. Wraps `@anthropic-ai/sdk`. Holds the agent registry (`Map`), references to ContextBroker, Blackboard, and MCPToolGateway. `dispatch()` enriches context, routes to an agent, and calls `agent.run(kernel, input, context)`. The default model is `claude-3-5-sonnet-20240620`.

**`src/os-core/ContextBroker.js`** — Two-tier memory. Short-term: fetches the last `maxContextMessages` (default 10) rows from `chat_logs` in Supabase. Long-term: pages older messages to `agent_memory` (pgvector), queries via `match_memories` RPC. **Note:** `generateEmbedding()` is currently a placeholder returning random vectors — long-term memory does not work meaningfully until a real embedding API is wired in.

**`src/os-core/Blackboard.js`** — IPC/shared state between agents. Persists entries to the `blackboard_entries` Supabase table. Supports real-time subscriptions via Supabase channels. Entries have `type` (observation, plan, task_assignment, result, error) and `layer` (strategy, logic, perception, action).

**`src/tools/MCPToolGateway.js`** — Connects to external MCP servers via stdio transport. Currently instantiated but no servers are registered at startup — tools must be wired in by calling `gateway.connectStdio(name, command, args)`.

### Agents

All agents extend `BaseAgent` (name, role, systemPrompt, abstract `run(kernel, input, context)`).

| Agent | Persona | Behavior |
|---|---|---|
| `ManagerAgent` | Chief Orchestrator | Always receives requests first (because it's registered). Calls LLM to decompose into a task DAG (JSON), posts plan to Blackboard, returns a "plan created" status message. The DAG execution loop (`handleBlackboardEvent`) is **not yet wired** — specialized agents never run during a normal chat request. |
| `SupportAgent` | "Aria" — NovaSaaS customer support | Answers questions about plans, billing, and features. Appends `[COLLECT_EMAIL]` to trigger lead capture in the widget. |
| `SalesAgent` | "Sam" — sales specialist | Qualifies leads, explains Pro/Enterprise value, collects email for demos. |

### Supabase Schema

Tables created by `scripts/setup_db.sql`:
- `chat_logs` — per-session message history (session_id, role, content)
- `agent_memory` — pgvector long-term memory, `vector(1536)` embeddings
- `blackboard_entries` — agent IPC entries, JSONB payload, UUID primary key with self-referential `parent_id`

The `match_memories` SQL function performs cosine similarity search over `agent_memory`.

### Frontend Widget (`public/widget.js`)

Self-contained IIFE — no framework, no build step. Injects a floating chat bubble into any webpage via `<script src="...">`. Generates a random `session_id` per page load. The API base URL is hardcoded to the Railway production URL (`https://novasaas-bot-production.up.railway.app`). The widget detects `[COLLECT_EMAIL]` in bot replies to display a name/email capture form, then POSTs to `/api/leads`.

### API Endpoints

- `POST /api/chat` — `{ messages: [{role, content}], session_id }` → `{ reply, agent }`
- `POST /api/leads` — `{ name, email, session_id }` → `{ success: true }`
- `GET /api/leads` — returns all leads ordered by `created_at` descending

## Known Incomplete Areas

- **DAG execution**: `ManagerAgent.handleBlackboardEvent()` is defined but never invoked. Specialized agents (SupportAgent, SalesAgent) currently never run in production — all responses come from ManagerAgent's LLM call.
- **Embeddings**: `ContextBroker.generateEmbedding()` returns random vectors. Long-term memory retrieval is non-functional until replaced with a real embedding call.
- **MCP tools**: `MCPToolGateway` is wired into the Kernel but no MCP server connections are established at startup.
