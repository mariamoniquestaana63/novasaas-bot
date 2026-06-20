const BaseAgent = require("./BaseAgent");

/**
 * ContentOpsAgent (Content Operations Specialist)
 * Generated automatically from the agent contracts definition.
 */
class ContentOpsAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the ContentOpsAgent (Content Operations Specialist) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Creates region-specific, localized GTM copywriting and campaign assets.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "messaging_architecture": "Output from GTMStrategistAgent"
}
- Outputs expected: {
  "localized_assets": "Copywriting templates, email sequences, and social assets"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("ContentOpsAgent", "Content Operations Specialist", systemPrompt);
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

module.exports = ContentOpsAgent;
