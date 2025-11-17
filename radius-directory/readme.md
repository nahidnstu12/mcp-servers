{
  "mcpServers": {
    "radius-directory": {
      "command": "node",
      "args": ["F:\\projects\\mcp-servers\\radius-directory\\mcp-server.js"]
    }
  }
}
```

### Step 5: Restart Claude Desktop

1. Completely close Claude Desktop (check system tray)
2. Reopen Claude Desktop
3. Look for 🔌 icon

### Step 6: Test It!

Try these commands:
```
Show me the project structure of radius-directory
```
```
Search for "useRouter" in all TypeScript files
```
```
Read the app/page.tsx file and analyze its imports
```

---

## What This MCP Server Does (Code Understanding Focus)

### 🔍 **1. search_code**
Search across your entire codebase with file type filtering
```
"Find all uses of Zustand store in .tsx files"
"Search for TODO comments"
```

### 🌳 **2. get_project_structure**
Get a visual tree of your project (excludes node_modules, .next, .git)
```
"Show me the project structure"
```

### 📦 **3. read_component_context**
Read a component + its related files (CSS, tests, types) in one go
```
"Read the ListingPostAbility component with all related files"
```

### 🔗 **4. analyze_imports**
Understand dependencies - shows external packages and internal imports
```
"Analyze imports in app/page.tsx"
```

### 📚 **5. read_multiple_files**
Read several files at once for comparison
```
"Compare the auth logic in these 3 files: [...paths]"
```

### ✏️ **6. read_file, write_file, list_files**
Standard file operations

---

## Real Use Cases

### Refactoring
```
You: "Analyze the imports in components/ListingPostAbility.tsx 
      and suggest how to optimize them"

Claude: [Uses analyze_imports + read_file to give precise suggestions]
```

### Understanding Code Flow
```
You: "How does authentication work in my app?"

Claude: [Uses search_code to find auth-related code, 
         then reads relevant files]
```

### Finding Patterns
```
You: "Find all places where I'm directly mutating state 
      instead of using Zustand"

Claude: [Uses search_code with .tsx filter]
```

### Component Refactoring
```
You: "Read the checkout component with all its context 
      and suggest improvements"

Claude: [Uses read_component_context to get full picture]