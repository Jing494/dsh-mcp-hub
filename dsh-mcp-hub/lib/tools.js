/**
 * MCP tools projected into Harness tool definitions.
 *
 * Naming is `mcp__<serverName>__<toolName>`, matching the upstream
 * `@deepseek-ai/dsh-mcp-client` convention so both can coexist in one profile.
 */
import { contentToText, errorText } from './connect.js'

/** Tool namespace for one server. */
export function toolName(serverName, rawName) {
  return `mcp__${serverName}__${rawName}`
}

/**
 * Build one Harness tool definition bound to a live MCP client.
 * @param entry - the connected server state.
 * @param tool - the MCP tool description from `tools/list`.
 * @param nameOverride - registered name when the natural name is already taken.
 */
export function createToolDefinition(entry, tool, nameOverride) {
  const serverName = entry.server?.name ?? entry.name
  if (typeof serverName !== 'string' || serverName === '') {
    throw new Error('mcp-hub: refusing to register a tool without a server name')
  }
  return {
    name: nameOverride ?? toolName(serverName, tool.name),
    description: tool.description || `MCP tool "${tool.name}" from server "${serverName}"`,
    parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    // A hung server must not hold the model's turn open: the registry enforces
    // this bound and reports the overrun as a tool failure.
    timeoutMs: entry.server?.toolCallTimeoutMs,
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
      ],
    },
    async execute(args) {
      try {
        const result = await entry.client.callTool({
          name: tool.name,
          arguments: args ?? {},
        })
        return {
          isError: result?.isError === true,
          text: contentToText(result?.content),
          structured: result?.structuredContent ?? null,
        }
      } catch (error) {
        // Let the owning connection record the failure so the panel can show it.
        try {
          entry.onCallError?.(error)
        } catch {
          // reporting a failure must never mask the failure itself
        }
        throw new Error(`MCP call ${serverName}.${tool.name} failed: ${errorText(error)}`)
      }
    },
  }
}

/** Failure text for a tool call that the connection could not complete. */
export function callFailure(error) {
  return `MCP call failed: ${errorText(error)}`
}

/**
 * Pick a free tool name: the natural one when nothing owns it, otherwise the
 * first free `_2`, `_3`, … suffix. A name that cannot be freed within `limit`
 * attempts returns undefined so the caller reports it instead of silently
 * dropping a tool.
 * @param base - the natural name, e.g. `mcp__weather__get`.
 * @param isTaken - whether the registry already exposes that name.
 * @param limit - highest suffix to try.
 */
export function uniqueToolName(base, isTaken, limit = 20) {
  if (!isTaken(base)) return base
  for (let suffix = 2; suffix <= limit; suffix += 1) {
    const candidate = `${base}_${suffix}`
    if (!isTaken(candidate)) return candidate
  }
  return undefined
}
