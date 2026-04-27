/**
 * WebMCP (W3C Model Context Protocol) browser API type declarations.
 *
 * Spec: https://github.com/webmachinelearning/webmcp
 * Bikeshed: https://webmachinelearning.github.io/webmcp/
 */

/** Annotations that describe tool behavior to agents. */
interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
}

/** JSON Schema describing tool input parameters. */
interface ModelContextToolInputSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

/** Agent-side interface passed to tool execute callbacks. */
interface ModelContextClient {
  readonly requestUserInteraction: (callback: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Execute callback for a tool.
 * @param input  — Validated input matching the tool's inputSchema.
 * @param client — Agent interface for requesting user interaction.
 */
type ToolExecuteCallback = (input: unknown, client: ModelContextClient) => Promise<unknown>;

/** MCP-aligned content block returned by tool execute callbacks. */
interface ModelContextContentBlock {
  readonly type: 'text';
  readonly text: string;
}

/** Standard response shape for tool execute callbacks. */
interface ModelContextToolResponse {
  readonly content: readonly ModelContextContentBlock[];
}

/** A tool that can be registered with the ModelContext API. */
interface ModelContextTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ModelContextToolInputSchema;
  readonly execute: ToolExecuteCallback;
  readonly annotations?: ToolAnnotations;
}

/** Options for bulk tool registration via provideContext. */
interface ModelContextOptions {
  readonly tools?: readonly ModelContextTool[];
}

/** The ModelContext interface exposed on navigator. */
interface ModelContext {
  readonly provideContext: (options?: ModelContextOptions) => void;
  readonly clearContext: () => void;
  readonly registerTool: (tool: ModelContextTool) => void;
  readonly unregisterTool: (name: string) => void;
}

interface Navigator {
  readonly modelContext?: ModelContext;
}
