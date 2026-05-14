class BaseAgent {
  constructor(name, role, systemPrompt) {
    this.name = name;
    this.role = role;
    this.systemPrompt = systemPrompt;
  }

  async run(kernel, input, context) {
    throw new Error("run() must be implemented");
  }
}

module.exports = BaseAgent;
