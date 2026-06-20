const BaseAgent = require("./BaseAgent");

/**
 * PartnershipsAgent (Strategic Partnerships Manager)
 * Generated automatically from the agent contracts definition.
 */
class PartnershipsAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the PartnershipsAgent (Strategic Partnerships Manager) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Sources, ranks, and coordinates outreach plans for local channel/distributor partners.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "entry_mode": "Output from MarketIntelligenceAgent"
}
- Outputs expected: {
  "partner_shortlist": "Ranked local partner options",
  "outreach_plan": "Partner-specific outreach template and approach"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("PartnershipsAgent", "Strategic Partnerships Manager", systemPrompt);
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

module.exports = PartnershipsAgent;
