const fs = require('fs');
const path = require('path');

const contractsPath = path.join(__dirname, '../src/tasks/benchmark-contracts.json');
const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

const agentsDir = path.join(__dirname, '../src/agents');

// Ensure output directory exists
if (!fs.existsSync(agentsDir)) {
  fs.mkdirSync(agentsDir, { recursive: true });
}

Object.entries(contracts.agent_contracts).forEach(([agentName, contract]) => {
  const filePath = path.join(agentsDir, `${agentName}.js`);
  
  const systemPrompt = `You are the ${agentName} (${contract.role}) of the Nexus AI Operating System.
ROLE DESCRIPTION:
${contract.description}

CAPABILITIES & CONTRACTS:
- Inputs expected: ${JSON.stringify(contract.input_schema, null, 2)}
- Outputs expected: ${JSON.stringify(contract.expected_outputs, null, 2)}

Ensure your outputs are structured, detailed, decision-grade, and meet compliance and analytical requirements.`;

  const code = `const BaseAgent = require("./BaseAgent");

/**
 * ${agentName} (${contract.role})
 * Generated automatically from the agent contracts definition.
 */
class ${agentName} extends BaseAgent {
  constructor() {
    const systemPrompt = \`${systemPrompt.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
    super("${agentName}", "${contract.role}", systemPrompt);
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

module.exports = ${agentName};
`;

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Generated agent class: ${agentName} at src/agents/${agentName}.js`);
});
