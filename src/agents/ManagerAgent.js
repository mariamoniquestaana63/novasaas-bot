const BaseAgent = require("./BaseAgent");

/**
 * ManagerAgent Orchestrator
 * Implements the control loop and DAG-based task decomposition.
 */
class ManagerAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `
You are the ManagerAgent, the chief orchestrator of the AI Workforce OS.
Your role is to transform complex user requests into structured, executable plans.

CORE RESPONSIBILITIES:
1. DECOMPOSITION: Analyze user requests and break them down into a Directed Acyclic Graph (DAG) of sub-tasks.
2. DELEGATION: Assign tasks to specialized agents (SupportAgent, SalesAgent).
3. MONITORING: Track the progress of tasks on the Blackboard.
4. SYNTHESIS: Aggregate results from specialized agents into a final response for the user.

TASK DAG STRUCTURE:
A plan should be a JSON array of sub-tasks:
{
  "tasks": [
    {
      "id": "task_1",
      "description": "...",
      "assigned_to": "SupportAgent",
      "dependencies": []
    },
    {
      "id": "task_2",
      "description": "...",
      "assigned_to": "SalesAgent",
      "dependencies": ["task_1"]
    }
  ]
}

When responding, always provide the plan in the requested JSON format if the request requires multiple steps.
If the request is simple, you may delegate it to a single agent directly.
`;
    super("ManagerAgent", "Chief Orchestrator", systemPrompt);
    this.activePlans = new Map(); // session_id -> current plan/DAG state
  }

  /**
   * Main control loop for the ManagerAgent.
   */
  async run(kernel, input, context) {
    const { messages } = input;
    const { session_id } = context;
    const lastMessage = messages[messages.length - 1].content;

    console.log(`[ManagerAgent] Analyzing request for session ${session_id}: "${lastMessage.substring(0, 50)}..."`);

    // 1. Check for existing plan on Blackboard
    if (kernel.blackboard) {
      const history = await kernel.blackboard.getHistory(session_id);
      const existingPlan = history.reverse().find(e => e.type === 'plan');
      
      if (existingPlan && existingPlan.status === 'active') {
        console.log(`[ManagerAgent] Found active plan for session ${session_id}`);
        // Handle ongoing plan logic (monitoring results etc.)
        // For now, we'll continue with creating a new plan or updating the current one.
      }
    }

    // 2. Post the user request to the Blackboard (Trigger)
    if (kernel.blackboard) {
      await kernel.blackboard.post({
        session_id,
        agent_id: 'User',
        type: 'user_request',
        layer: 'strategy',
        payload: { text: lastMessage }
      });
    }

    // 2. Ask the LLM to decompose the request
    const response = await kernel.callLLM({
      system: this.systemPrompt,
      messages: [...messages, { role: 'user', content: 'Provide the task DAG in JSON format.' }],
    });

    let plan;
    const content = response.content[0].text;
    try {
      // Attempt to extract JSON if it's wrapped in markdown or has preamble
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      plan = JSON.parse(jsonStr);
    } catch (e) {
      console.warn(`[ManagerAgent] Failed to parse JSON response from LLM: ${e.message}`);
      return {
        reply: content,
        agent: this.name
      };
    }

    // 3. Store and execute the plan
    if (plan && plan.tasks) {
      console.log(`[ManagerAgent] Created plan with ${plan.tasks.length} tasks`);
      
      if (kernel.blackboard) {
        // Post the full plan to the Blackboard
        await kernel.blackboard.post({
          session_id,
          agent_id: this.name,
          type: 'plan',
          layer: 'logic',
          payload: plan
        });

        // Identify and post initial tasks (those with no dependencies)
        const initialTasks = plan.tasks.filter(t => !t.dependencies || t.dependencies.length === 0);
        for (const task of initialTasks) {
          await kernel.blackboard.post({
            session_id,
            agent_id: this.name,
            type: 'task_assignment',
            layer: 'logic',
            payload: task
          });
          console.log(`[ManagerAgent] Delegated task ${task.id} to ${task.assigned_to}`);
        }
      }

      // For the initial POC/blocking response, we might just return the plan or a status message
      return {
        reply: "I've created a plan to handle your request. I'll coordinate with the specialized agents and get back to you with the results.",
        agent: this.name,
        plan: plan
      };
    }

    return {
      reply: response.content[0].text,
      agent: this.name
    };
  }

  /**
   * Monitor the Blackboard for results and errors (called by Kernel or a background process).
   * This is part of the "Supervise" step in the design.
   */
  async handleBlackboardEvent(kernel, entry) {
    const { session_id, type, payload } = entry;

    if (type === 'result') {
      console.log(`[ManagerAgent] Received result for session ${session_id}`);
      // TODO: Logic to update DAG, check dependencies, and post next tasks.
      // This would require persistent state for the DAG, likely in the Blackboard itself or a separate table.
    } else if (type === 'error') {
      console.error(`[ManagerAgent] Received error for session ${session_id}:`, payload);
      // TODO: Logic for retries or plan adjustments.
    }
  }
}

module.exports = ManagerAgent;
