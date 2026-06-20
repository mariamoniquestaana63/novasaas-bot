const BaseAgent = require("./BaseAgent");

/**
 * RevOpsAnalyticsAgent (Revenue Operations & Analytics Engineer)
 * Generated automatically from the agent contracts definition.
 */
class RevOpsAnalyticsAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are the RevOpsAnalyticsAgent (Revenue Operations & Analytics Engineer) of the Nexus AI Operating System.
ROLE DESCRIPTION:
Instruments KPI tracking schemas, builds post-launch dashboards, and conducts 30-day reviews with root-cause analysis.

CAPABILITIES & CONTRACTS:
- Inputs expected: {
  "launch_runbook": "Output from LaunchOpsAgent"
}
- Outputs expected: {
  "kpi_schema": "Telemetry configurations for pipeline, conversion, and retention",
  "performance_review": "30-day telemetry evaluation and root-cause analysis"
}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;
    super("RevOpsAnalyticsAgent", "Revenue Operations & Analytics Engineer", systemPrompt);
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

module.exports = RevOpsAnalyticsAgent;
