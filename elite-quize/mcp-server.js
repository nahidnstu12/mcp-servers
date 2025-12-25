#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = "/Users/radiustheme13/project/eliite-quize-admin";

const server = new McpServer(
  {
    name: "elite-quize-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Read a file from the elite-quiz-admin project",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file from project root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "list_files",
        description: "List files in a directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Relative directory path from project root",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "write_file",
        description: "Write content to a file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file from project root",
            },
            content: {
              type: "string",
              description: "Content to write to the file",
            },
          },
          required: ["path", "content"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_file") {
      const filePath = path.join(PROJECT_ROOT, args.path);
      const content = await fs.readFile(filePath, "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    }

    if (name === "list_files") {
      const dirPath = path.join(PROJECT_ROOT, args.directory);
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      const fileList = files.map((file) => ({
        name: file.name,
        type: file.isDirectory() ? "directory" : "file",
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(fileList, null, 2) }],
      };
    }

    if (name === "write_file") {
      const filePath = path.join(PROJECT_ROOT, args.path);
      await fs.writeFile(filePath, args.content, "utf-8");
      return {
        content: [{ type: "text", text: `File written successfully: ${args.path}` }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Elite Quiz Admin MCP Server running on stdio");
}

main().catch(console.error);