const Anthropic = require("@anthropic-ai/sdk");

class Kernel {
  constructor(config = {}) {
    this.config = config;
    this.agents = new Map();
    this.blackboard = new Map(); 
    this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  registerAgent(agent) {
    this.agents.set(agent.name, agent);
    console.log(`[Kernel] Registered agent: ${agent.name} (${agent.role})`);
  }

  // LLM Engine Abstraction
  async callLLM(params) {
    const model = params.model || "claude-3-5-sonnet-20240620";
    console.log(`[Kernel] LLM Request -> ${model}`);
    
    try {
      const startTime = Date.now();
      const response = await this.ai.messages.create({
        ...params,
        model: model
      });
      const duration = Date.now() - startTime;
      console.log(`[Kernel] LLM Response received in ${duration}ms`);
      return response;
    } catch (error) {
      console.error(`[Kernel] LLM Error:`, error);
      throw error;
    }
  }

  // Orchestration: Dispatch intent to the right agent
  async dispatch(input, sessionContext) {
    const text = input.text || (input.messages && input.messages[input.messages.length-1].content) || "";
    console.log(`[Kernel] Dispatching input: "${text.substring(0, 50)}..."`);
    
    const agentName = this.route(input, sessionContext);
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      console.error(`[Kernel] Agent ${agentName} not found. Available agents:`, Array.from(this.agents.keys()));
      throw new Error(`Agent ${agentName} not found`);
    }

    return await agent.run(this, input, sessionContext);
  }

  route(input, context) {
    const text = (input.text || (input.messages && input.messages[input.messages.length - 1].content) || "").toLowerCase();
    
    if (this.agents.has("SalesAgent") && (text.includes("demo") || text.includes("sales") || text.includes("contact"))) {
      return "SalesAgent";
    }

    return "SupportAgent"; // Default
  }
}

module.exports = Kernel;
