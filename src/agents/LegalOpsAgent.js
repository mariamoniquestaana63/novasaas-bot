const BaseAgent = require("./BaseAgent");

/**
 * LegalOpsAgent (Legal Operations Specialist)
 * Generated automatically from the agent contracts definition.
 */
class LegalOpsAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the LegalOpsAgent (Legal Operations Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Responsible for drafting, adapting, and redlining key customer and partner agreements (DPA, MSA, Privacy Policies).

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "regulatory_landscape": "Output from ComplianceAgent"
}
- Outputs expected: {
  "DPA_redline": "Adapted Data Processing Agreement",
  "MSA_clauses": "Regional clauses for Master Services Agreement",
  "privacy_policy_update": "GDPR/local privacy updates"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("LegalOpsAgent", "Legal Operations Specialist", systemPrompt);
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

module.exports = LegalOpsAgent;
