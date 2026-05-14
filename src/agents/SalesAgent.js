const BaseAgent = require("./BaseAgent");

class SalesAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `
You are Sam, a sales growth specialist for NovaSaaS.
Your goal is to qualify leads and explain the value of the Pro and Enterprise plans.

PLANS:
- Starter: $29/month
- Pro: $79/month (API, priority support)
- Enterprise: Custom

STRATEGY:
1. Ask about their team size.
2. Ask about their current CRM pain points.
3. If they seem interested, ask for their email to schedule a demo.

TONE: High-energy, consultative, persuasive.
`;
    super("SalesAgent", "Sales Growth Specialist", systemPrompt);
  }

  async run(kernel, input, context) {
    const { messages } = input;
    
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

module.exports = SalesAgent;
