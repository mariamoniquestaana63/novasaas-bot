const BaseAgent = require("./BaseAgent");

/**
 * MarketIntelligenceAgent (Market Intelligence Specialist)
 * Generated automatically from the agent contracts definition.
 */
class MarketIntelligenceAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the MarketIntelligenceAgent (Market Intelligence Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Responsible for conducting TAM estimation, competitor intelligence, and ideal customer segment definitions.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "regions": [
    "EU",
    "MENA"
  ],
  "focus": "TAM, growth, competition, customer profile"
}
- Outputs expected: {
  "TAM_estimations": "Numerical TAM range per region",
  "competitor_landscape": "Key local players and their positioning",
  "ICP_definitions": "Enterprise vs mid-market segment breakdown"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("MarketIntelligenceAgent", "Market Intelligence Specialist", systemPrompt);
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

module.exports = MarketIntelligenceAgent;
