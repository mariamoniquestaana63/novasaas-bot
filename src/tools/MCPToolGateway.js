/**
 * MCPToolGateway.js
 * Standardized interface for agents to discover and use tools via MCP.
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

class MCPToolGateway {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
  }

  /**
   * Connect to an MCP server via stdio.
   */
  async connectStdio(serverName, command, args = []) {
    console.log(`[MCP Gateway] Connecting to server: ${serverName}`);
    
    try {
      const transport = new StdioClientTransport({
        command,
        args,
      });

      const client = new Client({
        name: "NexusAIOSGateway",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      this.clients.set(serverName, client);

      // Discover tools
      const toolsResponse = await client.listTools();
      if (toolsResponse && toolsResponse.tools) {
        for (const tool of toolsResponse.tools) {
          this.tools.set(tool.name, {
            serverName,
            ...tool
          });
          console.log(`[MCP Gateway] Discovered tool: ${tool.name} from ${serverName}`);
        }
      }
    } catch (error) {
      console.error(`[MCP Gateway] Failed to connect to server ${serverName}:`, error.message);
      throw error;
    }
  }

  /**
   * List all available tools.
   */
  listAvailableTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Call a tool by name.
   */
  async callTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const client = this.clients.get(tool.serverName);
    if (!client) {
      throw new Error(`Client for server ${tool.serverName} not found`);
    }

    console.log(`[MCP Gateway] Calling tool: ${toolName} with args:`, args);
    try {
      return await client.callTool({
        name: toolName,
        arguments: args
      });
    } catch (error) {
      console.error(`[MCP Gateway] Error calling tool ${toolName}:`, error.message);
      throw error;
    }
  }
}

module.exports = MCPToolGateway;
