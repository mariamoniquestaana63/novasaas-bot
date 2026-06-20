const BaseAgent = require("./BaseAgent");

/**
 * LaunchOpsAgent (Launch Operations Specialist)
 * Generated automatically from the agent contracts definition.
 */
class LaunchOpsAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the LaunchOpsAgent (Launch Operations Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Orchestrates launch runbooks, cross-functional timelines, and customer support readiness checklists.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "approval_status": "APPROVED from HumanApprovalAgent"
}
- Outputs expected: {
  "launch_runbook": "Consolidated launch steps, owners, and timelines",
  "support_readiness": "Knowledge base, SLA mappings, and escalation flows"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("LaunchOpsAgent", "Launch Operations Specialist", systemPrompt);
  }

  async run(kernel, input, context) {
    const { messages = [] } = input;
    
    const response = await kernel.callLLM({
      system: this.systemPrompt,
      messages: messages,
    });

    return {
      reply: response.content[0].text,
      agent: this.name
    };
  }
}

module.exports = LaunchOpsAgent;
