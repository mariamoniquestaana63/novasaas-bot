const BaseAgent = require("./BaseAgent");

/**
 * ProductLocalizationAgent (Product Localization Specialist)
 * Generated automatically from the agent contracts definition.
 */
class ProductLocalizationAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the ProductLocalizationAgent (Product Localization Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Defines localization scope across UI translation, UX flows, and help documentation.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "ICP_segmentation": "Output from MarketIntelligenceAgent"
}
- Outputs expected: {
  "localization_spec": "Language, UX localizations, and onboarding adaptation list"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("ProductLocalizationAgent", "Product Localization Specialist", systemPrompt);
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

module.exports = ProductLocalizationAgent;
