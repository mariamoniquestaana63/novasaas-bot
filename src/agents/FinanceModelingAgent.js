const BaseAgent = require("./BaseAgent");

/**
 * FinanceModelingAgent (Financial Modeler & Analyst)
 * Generated automatically from the agent contracts definition.
 */
class FinanceModelingAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the FinanceModelingAgent (Financial Modeler & Analyst) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Simulates financial unit economics, gross margins, CAC/LTV, and payback periods.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "pricing_model": "Output from PricingStrategyAgent"
}
- Outputs expected: {
  "unit_economics": "Projected gross margins and CAC payback periods",
  "sensitivity_analysis": "Scenario outputs for low/med/high adoption"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("FinanceModelingAgent", "Financial Modeler & Analyst", systemPrompt);
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

module.exports = FinanceModelingAgent;
