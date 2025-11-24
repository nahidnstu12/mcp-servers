#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = "/Users/radiustheme13/project/radius-directory";

const server = new Server(
  {
    name: "radius-directory-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to recursively search files
async function searchInDirectory(dir, query, fileExtensions = []) {
  const results = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(PROJECT_ROOT, fullPath);

      // Skip common ignore folders
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const subResults = await searchInDirectory(fullPath, query, fileExtensions);
        results.push(...subResults);
      } else {
        // Check file extension filter
        if (fileExtensions.length > 0) {
          const ext = path.extname(entry.name);
          if (!fileExtensions.includes(ext)) {
            continue;
          }
        }

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          const matches = [];

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              matches.push({
                line: index + 1,
                content: line.trim(),
              });
            }
          });

          if (matches.length > 0) {
            results.push({
              file: relativePath,
              matchCount: matches.length,
              matches: matches.slice(0, 3), // First 3 matches per file
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return results;
}

// Helper function to get directory tree structure
async function getDirectoryTree(dir, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return null;
  }

  const tree = {
    name: path.basename(dir),
    type: "directory",
    children: [],
  };

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip common ignore folders at root level
      if (
        currentDepth === 0 &&
        (entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === ".git")
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subTree = await getDirectoryTree(fullPath, maxDepth, currentDepth + 1);
        if (subTree) {
          tree.children.push(subTree);
        }
      } else {
        tree.children.push({
          name: entry.name,
          type: "file",
        });
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return tree;
}

// Helper function to read multiple related files
async function readRelatedFiles(basePath, patterns) {
  const results = [];
  const dir = path.dirname(path.join(PROJECT_ROOT, basePath));
  const fileName = path.basename(basePath, path.extname(basePath));

  for (const pattern of patterns) {
    const testPath = path.join(dir, `${fileName}${pattern}`);
    try {
      const content = await fs.readFile(testPath, "utf-8");
      results.push({
        file: path.relative(PROJECT_ROOT, testPath),
        content,
      });
    } catch (error) {
      // File doesn't exist, skip
    }
  }

  return results;
}

// Helper function to analyze imports in a file
async function analyzeImports(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const lines = content.split("\n");

  const imports = {
    external: [],
    internal: [],
    types: [],
  };

  const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"](.*)['"]/g;
  const typeImportRegex = /import\s+type\s+{[^}]+}\s+from\s+['"](.*)['"]/g;

  lines.forEach((line) => {
    let match;

    // Type imports
    while ((match = typeImportRegex.exec(line)) !== null) {
      imports.types.push(match[1]);
    }

    // Regular imports
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith(".") || importPath.startsWith("@/")) {
        imports.internal.push(importPath);
      } else {
        imports.external.push(importPath);
      }
    }
  });

  return imports;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Read a file from the radius-directory project",
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
      {
        name: "search_code",
        description: "Search for text/code across the project with file type filtering",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text or code to search for",
            },
            file_extensions: {
              type: "array",
              items: { type: "string" },
              description: "Filter by file extensions (e.g., ['.tsx', '.ts', '.js'])",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_project_structure",
        description: "Get a tree view of the project structure (max 3 levels deep)",
        inputSchema: {
          type: "object",
          properties: {
            max_depth: {
              type: "number",
              description: "Maximum depth to traverse (default: 3)",
            },
          },
        },
      },
      {
        name: "read_component_context",
        description: "Read a component file along with its related files (styles, tests, types)",
        inputSchema: {
          type: "object",
          properties: {
            component_path: {
              type: "string",
              description: "Path to the main component file",
            },
          },
          required: ["component_path"],
        },
      },
      {
        name: "analyze_imports",
        description: "Analyze imports in a file to understand dependencies",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to the file to analyze",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "read_multiple_files",
        description: "Read multiple files at once for comparison or analysis",
        inputSchema: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: { type: "string" },
              description: "Array of file paths to read",
            },
          },
          required: ["paths"],
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
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, args.content, "utf-8");
      return {
        content: [
          { type: "text", text: `File written successfully: ${args.path}` },
        ],
      };
    }

    if (name === "search_code") {
      const results = await searchInDirectory(
        PROJECT_ROOT,
        args.query,
        args.file_extensions || []
      );
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} files with matches:\n\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }

    if (name === "get_project_structure") {
      const maxDepth = args.max_depth || 3;
      const tree = await getDirectoryTree(PROJECT_ROOT, maxDepth);
      return {
        content: [
          {
            type: "text",
            text: `Project Structure:\n\n${JSON.stringify(tree, null, 2)}`,
          },
        ],
      };
    }

    if (name === "read_component_context") {
      const mainFile = await fs.readFile(
        path.join(PROJECT_ROOT, args.component_path),
        "utf-8"
      );
      
      // Try to find related files
      const relatedPatterns = [
        ".module.css",
        ".module.scss",
        ".css",
        ".test.tsx",
        ".test.ts",
        ".spec.tsx",
        ".spec.ts",
        ".types.ts",
        ".d.ts",
      ];

      const relatedFiles = await readRelatedFiles(
        args.component_path,
        relatedPatterns
      );

      const result = {
        main: {
          file: args.component_path,
          content: mainFile,
        },
        related: relatedFiles,
      };

      return {
        content: [
          {
            type: "text",
            text: `Component Context:\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }

    if (name === "analyze_imports") {
      const imports = await analyzeImports(args.file_path);
      return {
        content: [
          {
            type: "text",
            text: `Import Analysis for ${args.file_path}:\n\n${JSON.stringify(imports, null, 2)}`,
          },
        ],
      };
    }

    if (name === "read_multiple_files") {
      const results = [];
      for (const filePath of args.paths) {
        try {
          const content = await fs.readFile(
            path.join(PROJECT_ROOT, filePath),
            "utf-8"
          );
          results.push({
            file: filePath,
            content,
            success: true,
          });
        } catch (error) {
          results.push({
            file: filePath,
            error: error.message,
            success: false,
          });
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
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
  console.error("Radius Directory MCP Server running on stdio");
}

main().catch(console.error);