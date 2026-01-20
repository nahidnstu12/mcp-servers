#!/usr/bin/env node

/**
 * Elite Quiz Admin MCP Server
 * 
 * A Model Context Protocol server for CodeIgniter project file operations.
 * Provides tools for reading, writing, searching, and analyzing files.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

/**
 * Project root path for Elite Quiz Admin.
 */
const PROJECT_ROOT = "/Users/radiustheme13/project/eliite-quize-admin";

/**
 * Directories to exclude from searches and listings.
 */
const EXCLUDE_DIRS = [
  "node_modules",
  "vendor",
  ".git",
  ".idea",
  "application/logs",
  "application/cache",
  "system",
];

/**
 * Default file extensions for code search.
 */
const DEFAULT_EXTENSIONS = [".php", ".js", ".css", ".html", ".json"];

/**
 * Resolve and validate a path within the project root.
 * Prevents directory traversal attacks.
 *
 * @param {string} relativePath - Relative path from project root
 * @returns {string} Absolute path
 * @throws {Error} If path escapes project root
 */
function resolvePath(relativePath) {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    throw new Error("Path escapes project root - access denied");
  }
  return absolutePath;
}

/**
 * Format file size in human-readable format.
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a path should be excluded from search/listing.
 *
 * @param {string} filePath - Path to check
 * @returns {boolean} True if should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_DIRS.some((dir) => filePath.includes(dir));
}

/**
 * Recursively get all files matching extensions.
 *
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to match
 * @returns {Promise<string[]>} Array of file paths
 */
async function getFilesRecursively(dir, extensions) {
  const files = [];

  async function walk(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(PROJECT_ROOT, fullPath);

        if (entry.name.startsWith(".") || shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(relativePath);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  await walk(dir);
  return files;
}

/**
 * Build a tree structure of the project.
 *
 * @param {string} dirPath - Directory path
 * @param {string} prefix - Line prefix for formatting
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum depth
 * @returns {Promise<string>} Tree string
 */
async function buildTree(dirPath, prefix, depth, maxDepth) {
  if (depth >= maxDepth) return "";

  let result = "";
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const filtered = entries
      .filter((e) => !e.name.startsWith("."))
      .filter((e) => !EXCLUDE_DIRS.includes(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const extension = isLast ? "    " : "│   ";

      if (entry.isDirectory()) {
        result += `${prefix}${connector}${entry.name}/\n`;
        result += await buildTree(
          path.join(dirPath, entry.name),
          prefix + extension,
          depth + 1,
          maxDepth
        );
      } else {
        result += `${prefix}${connector}${entry.name}\n`;
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return result;
}

const server = new Server(
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

/**
 * Handler for listing available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Read a file with optional line range. Returns content with line numbers.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file from project root",
            },
            start_line: {
              type: "number",
              description: "Start line number (1-indexed, optional)",
            },
            end_line: {
              type: "number",
              description: "End line number (1-indexed, -1 for end of file, optional)",
            },
          },
          required: ["path"],
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
              description: "Array of relative file paths to read",
            },
          },
          required: ["paths"],
        },
      },
      {
        name: "write_file",
        description: "Write or overwrite content to an existing file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file",
            },
            content: {
              type: "string",
              description: "Content to write",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "create_file",
        description: "Create a new file with content. Creates parent directories if needed.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path for the new file",
            },
            content: {
              type: "string",
              description: "Initial content",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "delete_file",
        description: "Delete a file from the project",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file to delete",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "list_files",
        description: "List files and directories with optional pattern filtering",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Relative directory path (default: root)",
            },
            recursive: {
              type: "boolean",
              description: "List recursively (default: false)",
            },
            pattern: {
              type: "string",
              description: "Filter by extension pattern (e.g., '.php')",
            },
          },
          required: [],
        },
      },
      {
        name: "search_code",
        description: "Search for text/patterns across the codebase with context",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text or pattern to search for",
            },
            file_extensions: {
              type: "array",
              items: { type: "string" },
              description: "Filter by extensions (e.g., ['.php', '.js'])",
            },
            case_sensitive: {
              type: "boolean",
              description: "Case-sensitive search (default: false)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_and_replace",
        description: "Search and replace text in a specific file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the file",
            },
            search: {
              type: "string",
              description: "Text to search for",
            },
            replace: {
              type: "string",
              description: "Replacement text",
            },
          },
          required: ["path", "search", "replace"],
        },
      },
      {
        name: "get_project_structure",
        description: "Get a tree view of the project structure",
        inputSchema: {
          type: "object",
          properties: {
            max_depth: {
              type: "number",
              description: "Maximum depth to traverse (default: 3)",
            },
          },
          required: [],
        },
      },
      {
        name: "analyze_php_file",
        description: "Analyze a PHP file to extract class, methods, properties, and imports",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path to the PHP file",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "find_class_usages",
        description: "Find all usages of a PHP class across the project",
        inputSchema: {
          type: "object",
          properties: {
            class_name: {
              type: "string",
              description: "Class name to search for",
            },
          },
          required: ["class_name"],
        },
      },
    ],
  };
});

/**
 * Handler for tool execution requests.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // READ FILE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "read_file") {
      const filePath = resolvePath(args.path);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      let selectedLines = lines;
      let startLine = 1;
      let endLine = lines.length;

      if (args.start_line !== undefined) {
        startLine = Math.max(1, args.start_line);
        endLine = args.end_line === -1 ? lines.length : Math.min(lines.length, args.end_line || lines.length);
        selectedLines = lines.slice(startLine - 1, endLine);
      }

      const numberedLines = selectedLines.map((line, index) => {
        const lineNum = startLine + index;
        return `${String(lineNum).padStart(4, " ")} | ${line}`;
      });

      const header = `File: ${args.path} (lines ${startLine}-${endLine} of ${lines.length})\n${"─".repeat(60)}`;
      return {
        content: [{ type: "text", text: `${header}\n${numberedLines.join("\n")}` }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ MULTIPLE FILES
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "read_multiple_files") {
      const results = {};
      await Promise.all(
        args.paths.map(async (filePath) => {
          try {
            const absolutePath = resolvePath(filePath);
            const content = await fs.readFile(absolutePath, "utf-8");
            results[filePath] = { success: true, content };
          } catch (error) {
            results[filePath] = { success: false, error: error.message };
          }
        })
      );
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WRITE FILE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "write_file") {
      const filePath = resolvePath(args.path);
      await fs.access(filePath); // Verify file exists
      await fs.writeFile(filePath, args.content, "utf-8");
      const lines = args.content.split("\n").length;
      return {
        content: [{ type: "text", text: `Successfully wrote ${lines} lines to ${args.path}` }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE FILE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "create_file") {
      const filePath = resolvePath(args.path);
      
      try {
        await fs.access(filePath);
        throw new Error(`File already exists: ${args.path}. Use write_file to overwrite.`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, args.content, "utf-8");
      
      const lines = args.content.split("\n").length;
      return {
        content: [{ type: "text", text: `Successfully created ${args.path} with ${lines} lines` }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE FILE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "delete_file") {
      const filePath = resolvePath(args.path);
      await fs.unlink(filePath);
      return {
        content: [{ type: "text", text: `Successfully deleted ${args.path}` }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LIST FILES
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "list_files") {
      const directory = args.directory || ".";
      const dirPath = resolvePath(directory);

      if (args.recursive && args.pattern) {
        const files = await getFilesRecursively(dirPath, [args.pattern]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ directory, pattern: args.pattern, files, count: files.length }, null, 2),
            },
          ],
        };
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith("."))
          .filter((e) => !EXCLUDE_DIRS.includes(e.name))
          .filter((e) => !args.pattern || e.name.endsWith(args.pattern))
          .map(async (entry) => {
            const stats = await fs.stat(path.join(dirPath, entry.name));
            return {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
              size: entry.isDirectory() ? null : formatSize(stats.size),
            };
          })
      );

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ directory, items, count: items.length }, null, 2) }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEARCH CODE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "search_code") {
      const extensions = args.file_extensions || DEFAULT_EXTENSIONS;
      const files = await getFilesRecursively(PROJECT_ROOT, extensions);
      const flags = args.case_sensitive ? "g" : "gi";
      const regex = new RegExp(escapeRegex(args.query), flags);

      const results = [];
      let totalMatches = 0;

      await Promise.all(
        files.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(PROJECT_ROOT, file), "utf-8");
            const lines = content.split("\n");
            const fileMatches = [];

            lines.forEach((line, index) => {
              if (regex.test(line)) {
                regex.lastIndex = 0;
                fileMatches.push({
                  line: index + 1,
                  content: line.trim().substring(0, 200),
                });
                totalMatches++;
              }
            });

            if (fileMatches.length > 0) {
              results.push({ file, matches: fileMatches, matchCount: fileMatches.length });
            }
          } catch {
            // Skip unreadable files
          }
        })
      );

      results.sort((a, b) => b.matchCount - a.matchCount);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { query: args.query, totalMatches, fileCount: results.length, results: results.slice(0, 50) },
              null,
              2
            ),
          },
        ],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEARCH AND REPLACE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "search_and_replace") {
      const filePath = resolvePath(args.path);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      const changes = [];
      const newLines = lines.map((line, index) => {
        if (line.includes(args.search)) {
          const newLine = line.replaceAll(args.search, args.replace);
          changes.push({ line: index + 1, before: line.trim(), after: newLine.trim() });
          return newLine;
        }
        return line;
      });

      if (changes.length === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ file: args.path, message: "No matches found", changes: [] }, null, 2) }],
        };
      }

      await fs.writeFile(filePath, newLines.join("\n"), "utf-8");

      return {
        content: [
          { type: "text", text: JSON.stringify({ file: args.path, message: `Replaced ${changes.length} occurrence(s)`, changes }, null, 2) },
        ],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET PROJECT STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "get_project_structure") {
      const maxDepth = args.max_depth || 3;
      const tree = await buildTree(PROJECT_ROOT, "", 0, maxDepth);
      const projectName = path.basename(PROJECT_ROOT);
      return {
        content: [{ type: "text", text: `${projectName}/\n${tree}` }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANALYZE PHP FILE
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "analyze_php_file") {
      const filePath = resolvePath(args.path);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      const analysis = {
        file: args.path,
        className: null,
        extends: null,
        properties: [],
        methods: [],
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Class declaration
        const classMatch = line.match(/^\s*(class)\s+(\w+)/);
        if (classMatch && !analysis.className) {
          analysis.className = classMatch[2];

          const extendsMatch = line.match(/extends\s+(\w+)/);
          if (extendsMatch) analysis.extends = extendsMatch[1];
        }

        // Properties
        const propMatch = line.match(/^\s*(public|protected|private)\s+\$(\w+)/);
        if (propMatch) {
          analysis.properties.push({
            name: propMatch[2],
            visibility: propMatch[1],
            line: lineNum,
          });
        }

        // Methods
        const methodMatch = line.match(/^\s*(public|protected|private)\s+function\s+(\w+)\s*\(/);
        if (methodMatch) {
          analysis.methods.push({
            name: methodMatch[2],
            visibility: methodMatch[1],
            line: lineNum,
          });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIND CLASS USAGES
    // ─────────────────────────────────────────────────────────────────────────
    if (name === "find_class_usages") {
      const className = args.class_name;
      const files = await getFilesRecursively(PROJECT_ROOT, [".php"]);
      const results = { extends: [], loads: [], references: [] };

      await Promise.all(
        files.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(PROJECT_ROOT, file), "utf-8");
            const lines = content.split("\n");

            lines.forEach((line, index) => {
              const lineNum = index + 1;

              if (new RegExp(`extends\\s+${className}\\b`, "i").test(line)) {
                results.extends.push({ file, line: lineNum, content: line.trim() });
              }
              if (new RegExp(`\\$this->load->(model|library)\\s*\\(\\s*['"].*${className}`, "i").test(line)) {
                results.loads.push({ file, line: lineNum, content: line.trim() });
              }
              if (new RegExp(`(new\\s+${className}|${className}::)`, "i").test(line)) {
                results.references.push({ file, line: lineNum, content: line.trim() });
              }
            });
          } catch {
            // Skip unreadable files
          }
        })
      );

      const totalUsages = results.extends.length + results.loads.length + results.references.length;

      return {
        content: [
          { type: "text", text: JSON.stringify({ className, totalUsages, ...results }, null, 2) },
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

/**
 * Main entry point.
 * Initializes the server and connects via stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Elite Quiz Admin MCP Server running for: ${PROJECT_ROOT}`);
}

main().catch(console.error);