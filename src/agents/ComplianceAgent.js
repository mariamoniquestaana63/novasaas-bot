const BaseAgent = require("./BaseAgent");

/**
 * ComplianceAgent (Compliance & Regulatory Officer)
 * Generated automatically from the agent contracts definition.
 */
class ComplianceAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the ComplianceAgent (Compliance & Regulatory Officer) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Responsible for legal, regulatory, data residency, and tax constraint identification across target regions.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "regions": [
    "EU",
    "MENA"
  ],
  "regulations": [
    "GDPR",
    "AI Act",
    "local data residency"
  ]
}
- Outputs expected: {
  "compliance_requirements": "Key compliance directives per region",
  "barriers_to_entry": "Legal risks or tax/labor blockers"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("ComplianceAgent", "Compliance & Regulatory Officer", systemPrompt);
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

module.exports = ComplianceAgent;
