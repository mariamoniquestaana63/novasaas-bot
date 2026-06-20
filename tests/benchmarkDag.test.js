'use strict';

const fs = require('fs');
const path = require('path');

describe('Multi-Region Market Entry Benchmark DAG', () => {
  let dag;
  let schema;

  beforeAll(() => {
    const dagPath = path.join(__dirname, '../src/tasks/benchmark-dag.json');
    const schemaPath = path.join(__dirname, '../src/tasks/dag-schema.json');
    
    dag = JSON.parse(fs.readFileSync(dagPath, 'utf8'));
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  });

  it('conforms to the task DAG JSON schema structure', () => {
    expect(dag).toHaveProperty('tasks');
    expect(Array.isArray(dag.tasks)).toBe(true);
    expect(dag.tasks.length).toBe(23); // 22 tasks from original + 1 approval gate

    dag.tasks.forEach(task => {
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('assigned_to');
      expect(task).toHaveProperty('dependencies');
      
      expect(typeof task.id).toBe('string');
      expect(typeof task.description).toBe('string');
      expect(typeof task.assigned_to).toBe('string');
      expect(Array.isArray(task.dependencies)).toBe(true);
    });
  });

  it('ensures all assigned specialized agents are implementable in the system', () => {
    const agentsDir = path.join(__dirname, '../src/agents');
    
    dag.tasks.forEach(task => {
      const agentFilename = `${task.assigned_to}.js`;
      const agentPath = path.join(agentsDir, agentFilename);
      
      expect(fs.existsSync(agentPath)).toBe(true);
      
      const AgentClass = require(agentPath);
      const agentInstance = new AgentClass();
      
      expect(agentInstance.name).toBe(task.assigned_to);
      expect(typeof agentInstance.run).toBe('function');
    });
  });

  it('verifies the DAG contains no circular dependencies', () => {
    const adjList = new Map();
    const allTaskIds = new Set();

    dag.tasks.forEach(task => {
      allTaskIds.add(task.id);
      adjList.set(task.id, task.dependencies);
    });

    // Cycle detection using DFS (with states: 0 = unvisited, 1 = visiting, 2 = visited)
    const visited = new Map();
    allTaskIds.forEach(id => visited.set(id, 0));

    function hasCycle(node) {
      visited.set(node, 1);

      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        // If a dependency is not part of the defined tasks, it is an invalid reference
        expect(allTaskIds.has(neighbor)).toBe(true);

        const neighborState = visited.get(neighbor);
        if (neighborState === 1) {
          return true; // Cycle detected
        }
        if (neighborState === 0) {
          if (hasCycle(neighbor)) {
            return true;
          }
        }
      }

      visited.set(node, 2);
      return false;
    }

    let cycleFound = false;
    for (const taskId of allTaskIds) {
      if (visited.get(taskId) === 0) {
        if (hasCycle(taskId)) {
          cycleFound = true;
          break;
        }
      }
    }

    expect(cycleFound).toBe(false);
  });
});
