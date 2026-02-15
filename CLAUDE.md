# eser/tools — Development Guide

## Project Overview

Universal tools platform where each tool is callable via REST API, CLI, and Web UI. All tool inputs/outputs are serializable (base64 for binaries). Tools can be chained via pipelines.

## Architecture

- **Runtime**: Deno (with `nodeModulesDir: "auto"` for npm compat)
- **Web UI**: TanStack Start (Vite plugin, file-based routing, server functions)
- **UI Components**: shadcn with Base UI (`base-vega` style), Tailwind CSS 4
- **Validation**: Zod v4 schemas for all tool I/O
- **Patterns from**: `~/projects/eser/aya.is/apps/webclient`

## Tool Structure

Each tool lives in `src/tools/<tool-name>/` and exports a `ToolDefinition` from `mod.ts`:
- `schema.ts` — Zod input/output schemas
- `execute.ts` — Core execution logic, returns `ToolResult<T>` (ok/fail)
- `mod.ts` — Exports the `ToolDefinition` object

Register new tools in `src/tools/_registry.gen.ts`.

## Current Tools

1. **social-media-post-retriever** — Fetches posts + comments from Twitter/X or Reddit
2. **social-media-post-anonymizer** — Anonymizes user identities, outputs same format as retriever
3. **social-media-post-visualizer** — Generates themed SVG preview of social media posts
4. **convert-to-image** — Converts SVG to PNG/JPG (rasterization)
5. **save-file** — Saves text or base64-encoded binary data to disk
6. **variable-set** — Sets a named variable in pipeline context

## Pipeline System

Pipelines are stateless, serializable JSON definitions:
```json
{"steps": [{"toolId": "...", "input": {...}, "inputMapping": {"field": {"fromStep": 0, "field": "path"}}}]}
```

## Preferred Libraries (use these instead of npm equivalents)

- CLI: `@eser/shell/args` (not commander)
- Crypto: `@eser/crypto/hash`
- Config: `@eser/config`
- Error handling: `@eser/functions/results`
- FP: `@eser/fp`
- Serialization: `@eser/writer`
- Logging: `@eser/logging`
- Testing: `@eser/testing`
- Also: `@std/*` (Deno std lib)

Source: `jsr:@eser/*` (local: `~/projects/eser/stack/`)

## Conventions

- Props as single object: `function Component(props: Props)` (not destructured)
- Explicit null checks: `if (value === null)` not `if (!value)`
- shadcn style: `base-vega`, zinc base, CSS variables
- Vite plugin order: devtools, nitro, tsConfigPaths, tailwindcss, tanstackStart, viteReact

## Commands

```sh
deno task dev       # Dev server on :3000
deno task build     # Production build
deno task cli list  # List all tools
deno task cli run <tool-id> --input '{"url":"..."}'
deno task cli pipeline --file pipeline.json
```
