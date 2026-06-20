const BaseAgent = require("./BaseAgent");

/**
 * PricingStrategyAgent (Pricing & Packaging Strategist)
 * Generated automatically from the agent contracts definition.
 */
class PricingStrategyAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the PricingStrategyAgent (Pricing & Packaging Strategist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Formulates willingness-to-pay models, pricing tiers, and packaging options per region.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "TAM_estimations": "Output from MarketIntelligenceAgent",
  "competitor_landscape": "Output from MarketIntelligenceAgent"
}
- Outputs expected: {
  "pricing_model": "Multi-region pricing tiers and currency rules",
  "packaging_memo": "Packaging tiers, add-ons, and discount policies"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("PricingStrategyAgent", "Pricing & Packaging Strategist", systemPrompt);
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

module.exports = PricingStrategyAgent;
