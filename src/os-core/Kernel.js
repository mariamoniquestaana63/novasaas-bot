const Anthropic = require("@anthropic-ai/sdk");

class Kernel {
  constructor(config = {}) {
    this.config = config;
    this.agents = new Map();
    this.blackboard = config.blackboard || null;
    this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.contextBroker = config.contextBroker || null;
    this.toolGateway = config.toolGateway || null;

    // Event-driven execution state
    this.eventLoopStarted = false;
    this.blackboardSubscriptions = [];
    this.processingAssignments = new Set();
    this.processingSupervisionEvents = new Set();
  }

  registerAgent(agent) {
    this.agents.set(agent.name, agent);
    console.log(`[Kernel] Registered agent: ${agent.name} (${agent.role})`);
  }

  setContextBroker(broker) {
    this.contextBroker = broker;
  }

  setBlackboard(blackboard) {
    this.blackboard = blackboard;
  }

  setToolGateway(gateway) {
    this.toolGateway = gateway;
  }

  // LLM Engine Abstraction
  async callLLM(params) {
    const model = params.model || "claude-3-5-sonnet-20240620";
    const maxTokens = params.max_tokens || 1024;
    console.log(`[Kernel] LLM Request -> ${model}`);

    try {
      const startTime = Date.now();
      const response = await this.ai.messages.create({
        ...params,
        model,
        max_tokens: maxTokens
      });
      const duration = Date.now() - startTime;
      console.log(`[Kernel] LLM Response received in ${duration}ms`);
      return response;
    } catch (error) {
      console.error(`[Kernel] LLM Error:`, error);
      throw error;
    }
  }

  startEventLoop() {
    if (this.eventLoopStarted) {
      return;
    }

    if (!this.blackboard) {
      console.warn("[Kernel] Cannot start event loop: blackboard not configured.");
      return;
    }

    console.log("[Kernel] Starting asynchronous event-driven execution loop...");

    const taskSubId = this.blackboard.subscribe({ type: "task_assignment" }, (entry) => {
      if (entry.status && entry.status !== "active") return;
      this.handleTaskAssignmentEvent(entry).catch((err) => {
        console.error("[Kernel] Task assignment event handler failed:", err.message);
      });
    });

    const resultSubId = this.blackboard.subscribe({ type: "result" }, (entry) => {
      if (entry.status && entry.status !== "active") return;
      this.handleSupervisionEvent(entry).catch((err) => {
        console.error("[Kernel] Result supervision handler failed:", err.message);
      });
    });

    const errorSubId = this.blackboard.subscribe({ type: "error" }, (entry) => {
      if (entry.status && entry.status !== "active") return;
      this.handleSupervisionEvent(entry).catch((err) => {
        console.error("[Kernel] Error supervision handler failed:", err.message);
      });
    });

    this.blackboardSubscriptions.push(taskSubId, resultSubId, errorSubId);
    this.eventLoopStarted = true;
  }

  stopEventLoop() {
    if (!this.blackboard || !this.eventLoopStarted) {
      return;
    }

    for (const subId of this.blackboardSubscriptions) {
      this.blackboard.unsubscribe(subId);
    }

    this.blackboardSubscriptions = [];
    this.eventLoopStarted = false;
    console.log("[Kernel] Event loop stopped.");
  }

  async handleTaskAssignmentEvent(entry) {
    const entryId = entry.id;
    if (!entryId || this.processingAssignments.has(entryId)) {
      return;
    }

    this.processingAssignments.add(entryId);

    const payload = entry.payload || {};
    const taskId = payload.id || payload.task_id || `task-${entryId}`;
    const assignedTo = payload.assigned_to;
    const description = payload.description || payload.task || JSON.stringify(payload);

    try {
      if (!assignedTo) {
        throw new Error(`Task ${taskId} has no assigned_to field`);
      }

      const agent = this.agents.get(assignedTo);
      if (!agent) {
        throw new Error(`Assigned agent not found: ${assignedTo}`);
      }

      console.log(`[Kernel] Executing task ${taskId} with ${assignedTo}`);

      const taskInput = {
        text: description,
        messages: [
          {
            role: "user",
            content: `Execute the delegated sub-task and return only the task output.\n\nTask ID: ${taskId}\nTask: ${description}`
          }
        ],
        task: payload
      };

      const taskContext = {
        session_id: entry.session_id,
        mode: "task_execution",
        task_id: taskId,
        assignment_entry_id: entryId,
        delegated_by: entry.agent_id
      };

      const result = await agent.run(this, taskInput, taskContext);
      const output = result?.reply || result?.output || JSON.stringify(result);

      if (this.blackboard) {
        await this.blackboard.post({
          session_id: entry.session_id,
          agent_id: agent.name,
          type: "result",
          layer: "action",
          parent_id: entryId,
          payload: {
            task_id: taskId,
            assignment_id: entryId,
            assigned_to: agent.name,
            output,
            metadata: result
          }
        });
      }

      console.log(`[Kernel] Task ${taskId} completed by ${assignedTo}`);
    } catch (error) {
      console.error(`[Kernel] Task ${taskId} failed:`, error.message);

      if (this.blackboard) {
        await this.blackboard.post({
          session_id: entry.session_id,
          agent_id: assignedTo || "Kernel",
          type: "error",
          layer: "action",
          parent_id: entryId,
          payload: {
            task_id: taskId,
            assignment_id: entryId,
            assigned_to: assignedTo || null,
            message: error.message
          }
        });
      }
    } finally {
      if (this.blackboard && entryId && entry.status === "active") {
        try {
          await this.blackboard.updateStatus(entryId, "processed");
        } catch (err) {
          console.warn(`[Kernel] Failed to update task assignment ${entryId} status: ${err.message}`);
        }
      }

      this.processingAssignments.delete(entryId);
    }
  }

  async handleSupervisionEvent(entry) {
    const manager = this.agents.get("ManagerAgent");
    if (!manager || typeof manager.handleBlackboardEvent !== "function") {
      return;
    }

    const key = entry.id || `${entry.session_id}:${entry.type}:${entry.created_at}`;
    if (this.processingSupervisionEvents.has(key)) {
      return;
    }

    this.processingSupervisionEvents.add(key);

    try {
      await manager.handleBlackboardEvent(this, entry);
    } finally {
      if (this.blackboard && entry.id && entry.status === "active") {
        try {
          await this.blackboard.updateStatus(entry.id, "processed");
        } catch (err) {
          console.warn(`[Kernel] Failed to update supervision event ${entry.id} status: ${err.message}`);
        }
      }

      this.processingSupervisionEvents.delete(key);
    }
  }

  // Orchestration: Dispatch intent to the right agent
  async dispatch(input, sessionContext = {}) {
    const lastMessage = input?.messages?.[input.messages.length - 1]?.content;
    const rawText = input.text || lastMessage || "";
    const text = typeof rawText === "string" ? rawText : JSON.stringify(rawText);

    console.log(`[Kernel] Dispatching input: "${text.substring(0, 50)}..."`);

    if (this.blackboard && !this.eventLoopStarted) {
      this.startEventLoop();
    }

    // Enrich with context if broker and session_id exist
    if (this.contextBroker && sessionContext.session_id) {
      console.log(`[Kernel] Enriching input with context for session ${sessionContext.session_id}`);
      const history = await this.contextBroker.getContext(sessionContext.session_id, text);

      if (input.messages) {
        const currentMessages = input.messages;
        input.messages = [
          ...history,
          ...currentMessages.filter(
            (m) => !history.some((h) => h.content === m.content && h.role === m.role)
          )
        ];
      } else {
        input.messages = [...history, { role: "user", content: text }];
      }
    }

    const agentName = this.route(input, sessionContext);
    const agent = this.agents.get(agentName);

    if (!agent) {
      console.error(`[Kernel] Agent ${agentName} not found. Available agents:`, Array.from(this.agents.keys()));
      throw new Error(`Agent ${agentName} not found`);
    }

    return await agent.run(this, input, sessionContext);
  }

  route(input, context) {
    // If ManagerAgent is registered, it handles the orchestration
    if (this.agents.has("ManagerAgent")) {
      return "ManagerAgent";
    }

    const rawText = input.text || (input.messages && input.messages[input.messages.length - 1].content) || "";
    const text = String(rawText).toLowerCase();

    if (
      this.agents.has("SalesAgent") &&
      (text.includes("demo") || text.includes("sales") || text.includes("contact"))
    ) {
      return "SalesAgent";
    }

    return "SupportAgent"; // Default
  }
}

module.exports = Kernel;
