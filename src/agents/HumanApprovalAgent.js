const BaseAgent = require("./BaseAgent");

/**
 * HumanApprovalAgent (Human Approval HITL Proxy)
 * Generated automatically from the agent contracts definition.
 */
class HumanApprovalAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the HumanApprovalAgent (Human Approval HITL Proxy) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Simulates executive and compliance sign-off at critical gates.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "risk_register": "Output from RiskAuditAgent",
  "DPA_redline": "Output from LegalOpsAgent",
  "packaging_memo": "Output from PricingStrategyAgent"
}
- Outputs expected: {
  "approval_status": "APPROVED or REJECTED",
  "signoff_comments": "Formal go/no-go signoff and executive feedback"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("HumanApprovalAgent", "Human Approval HITL Proxy", systemPrompt);
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

module.exports = HumanApprovalAgent;
