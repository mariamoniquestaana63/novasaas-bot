const BaseAgent = require("./BaseAgent");

/**
 * IntegrationAgent (Technical Integration Engineer)
 * Generated automatically from the agent contracts definition.
 */
class IntegrationAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the IntegrationAgent (Technical Integration Engineer) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Verifies technical dependencies including regional payments, SMS gateways, identity providers, and SLAs.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "localization_spec": "Output from ProductLocalizationAgent"
}
- Outputs expected: {
  "payment_compatibility": "Payment processor recommendation (Adyen, local cards, etc.)",
  "SLA_validation": "Latency and uptime projections per region"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("IntegrationAgent", "Technical Integration Engineer", systemPrompt);
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

module.exports = IntegrationAgent;
