const BaseAgent = require("./BaseAgent");

/**
 * GTMStrategistAgent (Go-To-Market Strategist)
 * Generated automatically from the agent contracts definition.
 */
class GTMStrategistAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the GTMStrategistAgent (Go-To-Market Strategist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Establishes persona messaging architecture, channel strategies, budget allocations, and launch timing.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "ICP_segmentation": "Output from MarketIntelligenceAgent"
}
- Outputs expected: {
  "messaging_architecture": "Value proposition per regional persona",
  "demand_generation_plan": "Channel mix, calendar, and budget allocations"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("GTMStrategistAgent", "Go-To-Market Strategist", systemPrompt);
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

module.exports = GTMStrategistAgent;
