const BaseAgent = require("./BaseAgent");

/**
 * ManagerAgent Orchestrator
 * Implements control-loop supervision with DAG-based task decomposition.
 */
class ManagerAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `
You are the ManagerAgent, the chief orchestrator of the AI Workforce OS.
Your role is to transform complex user requests into structured, executable plans.

CORE RESPONSIBILITIES:
1. DECOMPOSITION: Analyze user requests and break them into a Directed Acyclic Graph (DAG) of sub-tasks.
2. DELEGATION: Assign each sub-task to the best specialized agent.
3. MONITORING: Observe result/error events and advance the plan.
4. SYNTHESIS: Merge sub-task outputs into the final response.

REQUIRED OUTPUT FORMAT:
Return ONLY valid JSON in this shape:
{
  "tasks": [
    {
      "id": "task_1",
      "description": "clear imperative instruction",
      "assigned_to": "SupportAgent",
      "dependencies": []
    }
  ]
}

Rules:
- dependencies must reference earlier task IDs.
- Use SupportAgent for support/troubleshooting tasks.
- Use SalesAgent for demo/pricing/lead-qualification tasks.
- Keep task descriptions concise and actionable.
`;

    super("ManagerAgent", "Chief Orchestrator", systemPrompt);
    this.activePlans = new Map(); // session_id -> plan state
  }

  async run(kernel, input, context) {
    const { messages = [] } = input;
    const { session_id } = context;
    const lastRaw = messages[messages.length - 1]?.content || input.text || "";
    const userRequest = typeof lastRaw === "string" ? lastRaw : JSON.stringify(lastRaw);

    console.log(`[ManagerAgent] Analyzing request for session ${session_id}: "${userRequest.substring(0, 80)}..."`);

    if (kernel.blackboard) {
      await kernel.blackboard.post({
        session_id,
        agent_id: "User",
        type: "user_request",
        layer: "strategy",
        payload: { text: userRequest }
      });
    }

    const response = await kernel.callLLM({
      system: this.systemPrompt,
      messages: [
        ...messages,
        {
          role: "user",
          content: `Create a task DAG for this user request:\n\n${userRequest}\n\nReturn JSON only.`
        }
      ]
    });

    const llmText = response?.content?.[0]?.text || "";
    const parsedPlan = this.parsePlan(llmText);
    const normalizedPlan = this.normalizePlan(parsedPlan, userRequest);

    if (!normalizedPlan.tasks.length) {
      return {
        reply: "I couldn't generate a valid multi-step plan. Please rephrase your request.",
        agent: this.name
      };
    }

    let planEntryId = null;
    if (kernel.blackboard) {
      const planEntry = await kernel.blackboard.post({
        session_id,
        agent_id: this.name,
        type: "plan",
        layer: "logic",
        payload: normalizedPlan
      });
      planEntryId = planEntry.id;
    }

    const state = this.buildPlanState(session_id, userRequest, normalizedPlan, planEntryId);
    this.activePlans.set(session_id, state);

    await this.dispatchReadyTasks(kernel, state);

    return {
      reply: "I've created a task plan and started execution. I'll supervise progress and synthesize the final result.",
      agent: this.name,
      plan: normalizedPlan
    };
  }

  async handleBlackboardEvent(kernel, entry) {
    const { session_id, type, payload = {} } = entry;
    const state = this.activePlans.get(session_id);

    if (!state || state.status !== "active") {
      return;
    }

    const taskId = payload.task_id || payload.id;
    if (!taskId || !state.tasks.has(taskId)) {
      return;
    }

    const task = state.tasks.get(taskId);

    if (type === "result") {
      if (task.status === "completed") return;

      task.status = "completed";
      task.completed_at = new Date().toISOString();
      state.results.set(taskId, payload.output || payload);

      console.log(`[ManagerAgent] Task ${taskId} completed for session ${session_id}`);

      if (this.isPlanComplete(state)) {
        await this.finalizePlan(kernel, state, false);
        return;
      }

      await this.dispatchReadyTasks(kernel, state);
      return;
    }

    if (type === "error") {
      task.retries = (task.retries || 0) + 1;
      state.errors.set(taskId, payload);

      console.warn(
        `[ManagerAgent] Task ${taskId} failed for session ${session_id} (attempt ${task.retries}/${task.maxRetries})`
      );

      if (task.retries < task.maxRetries) {
        task.status = "pending";
        task.last_error = payload.message || "Unknown task failure";
        await this.dispatchReadyTasks(kernel, state);
      } else {
        task.status = "failed";
        await this.finalizePlan(kernel, state, true);
      }
    }
  }

  parsePlan(rawText) {
    if (!rawText) return { tasks: [] };

    const fenced = rawText.match(/```json\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] || rawText.match(/\{[\s\S]*\}/)?.[0] || rawText;

    try {
      return JSON.parse(candidate);
    } catch (error) {
      console.warn(`[ManagerAgent] Failed to parse plan JSON: ${error.message}`);
      return { tasks: [] };
    }
  }

  normalizePlan(plan, userRequest) {
    const rawTasks = Array.isArray(plan?.tasks) ? plan.tasks : [];

    if (!rawTasks.length) {
      return {
        tasks: [
          {
            id: "task_1",
            description: userRequest,
            assigned_to: this.inferAgent(userRequest),
            dependencies: []
          }
        ]
      };
    }

    const ids = new Set();
    const normalized = rawTasks.map((task, index) => {
      let id = task?.id ? String(task.id) : `task_${index + 1}`;
      while (ids.has(id)) {
        id = `${id}_${index + 1}`;
      }
      ids.add(id);

      const description =
        typeof task?.description === "string" && task.description.trim()
          ? task.description.trim()
          : `Execute sub-task ${index + 1}`;

      const assigned_to = ["SupportAgent", "SalesAgent"].includes(task?.assigned_to)
        ? task.assigned_to
        : this.inferAgent(description);

      return {
        id,
        description,
        assigned_to,
        dependencies: Array.isArray(task?.dependencies) ? task.dependencies.map(String) : []
      };
    });

    const validIds = new Set(normalized.map((task) => task.id));
    for (const task of normalized) {
      task.dependencies = task.dependencies.filter((dep) => validIds.has(dep) && dep !== task.id);
    }

    return { tasks: normalized };
  }

  inferAgent(text = "") {
    const sample = text.toLowerCase();
    const salesSignals = ["pricing", "demo", "quote", "enterprise", "sales", "lead"];
    return salesSignals.some((token) => sample.includes(token)) ? "SalesAgent" : "SupportAgent";
  }

  buildPlanState(sessionId, userRequest, plan, planEntryId) {
    const tasks = new Map();

    for (const task of plan.tasks) {
      tasks.set(task.id, {
        ...task,
        status: "pending",
        retries: 0,
        maxRetries: 2,
        last_error: null
      });
    }

    return {
      sessionId,
      userRequest,
      plan,
      planEntryId,
      status: "active",
      tasks,
      results: new Map(),
      errors: new Map(),
      createdAt: new Date().toISOString()
    };
  }

  async dispatchReadyTasks(kernel, state) {
    if (!kernel.blackboard) return;

    for (const task of state.tasks.values()) {
      if (task.status !== "pending") continue;

      const isUnlocked = (task.dependencies || []).every((depId) => {
        const dep = state.tasks.get(depId);
        return dep && dep.status === "completed";
      });

      if (!isUnlocked) continue;

      task.status = "assigned";

      try {
        await kernel.blackboard.post({
          session_id: state.sessionId,
          agent_id: this.name,
          type: "task_assignment",
          layer: "logic",
          parent_id: state.planEntryId,
          payload: {
            id: task.id,
            description: task.description,
            assigned_to: task.assigned_to,
            dependencies: task.dependencies,
            attempt: task.retries + 1
          }
        });

        console.log(`[ManagerAgent] Delegated task ${task.id} to ${task.assigned_to}`);
      } catch (error) {
        task.status = "pending";
        throw error;
      }
    }
  }

  isPlanComplete(state) {
    return Array.from(state.tasks.values()).every((task) => task.status === "completed");
  }

  async finalizePlan(kernel, state, failed) {
    if (state.status !== "active") {
      return;
    }

    state.status = failed ? "failed" : "completed";

    const finalSummary = failed
      ? this.buildFailureSummary(state)
      : await this.synthesizeResults(kernel, state);

    if (kernel.blackboard) {
      await kernel.blackboard.post({
        session_id: state.sessionId,
        agent_id: this.name,
        type: "final_result",
        layer: "strategy",
        parent_id: state.planEntryId,
        payload: {
          status: state.status,
          summary: finalSummary,
          task_results: Object.fromEntries(state.results),
          task_errors: Object.fromEntries(state.errors)
        }
      });
    }

    this.activePlans.delete(state.sessionId);

    console.log(`[ManagerAgent] Finalized plan for session ${state.sessionId} with status ${state.status}`);
  }

  buildFailureSummary(state) {
    const failedTasks = Array.from(state.tasks.values())
      .filter((task) => task.status === "failed")
      .map((task) => `- ${task.id}: ${task.last_error || "Unknown failure"}`)
      .join("\n");

    return `Plan execution failed before completion. Failed tasks:\n${failedTasks}`;
  }

  async synthesizeResults(kernel, state) {
    const orderedResults = state.plan.tasks
      .map((task) => {
        const output = state.results.get(task.id) || "No output captured.";
        return `${task.id} (${task.assigned_to}): ${output}`;
      })
      .join("\n");

    try {
      const response = await kernel.callLLM({
        system:
          "You are an orchestration summarizer. Combine task outputs into a final user-facing response. Be concise and practical.",
        messages: [
          {
            role: "user",
            content: `User request:\n${state.userRequest}\n\nTask outputs:\n${orderedResults}\n\nProvide the final response.`
          }
        ]
      });

      return response?.content?.[0]?.text || orderedResults;
    } catch (error) {
      console.warn(`[ManagerAgent] Synthesis failed, falling back to raw outputs: ${error.message}`);
      return orderedResults;
    }
  }
}

module.exports = ManagerAgent;
