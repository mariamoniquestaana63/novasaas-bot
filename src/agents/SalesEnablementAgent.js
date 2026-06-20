const BaseAgent = require("./BaseAgent");

/**
 * SalesEnablementAgent (Sales Enablement Specialist)
 * Generated automatically from the agent contracts definition.
 */
class SalesEnablementAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the SalesEnablementAgent (Sales Enablement Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Produces region-specific playbooks, battlecards, and script templates for local sales teams.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "messaging_architecture": "Output from GTMStrategistAgent"
}
- Outputs expected: {
  "sales_battlecards": "Competitor-specific battlecards",
  "discovery_scripts": "Region-specific discovery call scripts"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("SalesEnablementAgent", "Sales Enablement Specialist", systemPrompt);
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

module.exports = SalesEnablementAgent;
