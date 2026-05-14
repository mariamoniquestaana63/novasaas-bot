# Proposal: Nexus AI Operating System Architecture

Based on the audit of the existing `novasaas-bot` and research into AI Workforce Operating Systems, we propose the following modular architecture.

## 1. Directory Structure

```text
/src
  /os-core
    - Kernel.js          # Main orchestrator, LLM abstraction, scheduling
    - ContextBroker.js   # Manages short-term and long-term (RAG) context
    - AgentRuntime.js    # Manages agent lifecycle and roles
    - Blackboard.js      # Shared state/IPC for agent collaboration
  /agents
    - BaseAgent.js       # Abstract base class for all agents
    - RouterAgent.js     # Orchestrator agent that decomposes tasks
    - SupportAgent.js    # Customer support specialist (migrated from Aria)
    - SalesAgent.js      # Lead generation and qualification specialist
  /tools
    - mcp/               # Model Context Protocol implementations
    - ToolRegistry.js    # Catalog of available tools for agents
  /tasks
    - TaskManager.js     # Manages Task DAGs and state
  /api
    - routes.js          # Express API routes
  server.js              # Entry point
```

## 2. Kernel Design (The "Nexus Kernel")

The Kernel acts as the central nervous system, decoupling the high-level agent logic from low-level resource management.

### Key Components:
- **LLM Engine**: Unified interface for LLM providers. Handles token usage tracking and provider failover.
- **Scheduler**: Manages a queue of LLM requests, prioritizing critical tasks (e.g., real-time chat) over background tasks (e.g., data indexing).
- **Context Pager**: Automatically handles context window overflows by summarizing past interactions or moving them to a Vector DB (Paging).
- **Blackboard**: A shared memory space where agents can publish findings and subscribe to events (Inter-Process Communication).

## 3. Migration Plan

1.  **Phase 1: Refactor**: Move current "Aria" logic into `SupportAgent.js` and wrap the AI call in a basic `Kernel` class.
2.  **Phase 2: Multi-Agent**: Introduce the `RouterAgent` to distinguish between support requests and sales leads.
3.  **Phase 3: Tooling**: Implement `ToolRegistry` and convert current database inserts into "Tools" that agents can call.
4.  **Phase 4: Persistence**: Implement `ContextBroker` to persist session state in Supabase more robustly.

## 4. Kernel Interface Example

```javascript
const kernel = new Kernel();
kernel.registerAgent(new SupportAgent());
kernel.registerAgent(new SalesAgent());

// Dispatching a user request
const response = await kernel.dispatch({
  text: "I want to upgrade to the Pro plan",
  sessionId: "123"
});
```
