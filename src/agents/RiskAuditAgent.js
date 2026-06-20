const BaseAgent = require("./BaseAgent");

/**
 * RiskAuditAgent (Risk & Assurance Auditor)
 * Generated automatically from the agent contracts definition.
 */
class RiskAuditAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the RiskAuditAgent (Risk & Assurance Auditor) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Independently stress-tests launch plans, creates the risk register, and monitors mitigation statuses.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "strategy_and_compliance_inputs": "Outputs from MarketIntelligenceAgent and ComplianceAgent"
}
- Outputs expected: {
  "risk_register": "Table of legal, security, operational, and reputational risks with owner, severity, and mitigation plan"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("RiskAuditAgent", "Risk & Assurance Auditor", systemPrompt);
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

module.exports = RiskAuditAgent;
