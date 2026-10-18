// Resolve `@modelcontextprotocol/sdk/*` for standalone tests, without a
// node_modules tree next to the sources.
//
// Order: DSH_MCP_SDK_BASE (explicit) → the SDK's own exports (when the caller has
// a resolvable install) → the DeepSeek Harness installation on this device.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const FALLBACK =
  '/data/data/com.dsharnessmobile.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@modelcontextprotocol/sdk/dist/esm/'

const PREFIX = '@modelcontextprotocol/sdk/'

const SDK_BASE = (() => {
  const explicit = process.env.DSH_MCP_SDK_BASE
  if (explicit !== undefined && explicit !== '') {
    const dir = explicit.endsWith('/') ? explicit : `${explicit}/`
    return dir.startsWith('file:') ? dir : pathToFileURL(dir).href
  }
  try {
    const require = createRequire(import.meta.url)
    const entry = require.resolve(PREFIX + 'client/index.js')
    const root = entry.slice(0, entry.indexOf('/client/index.js') + 1)
    return pathToFileURL(root).href
  } catch {
    return pathToFileURL(FALLBACK).href
  }
})()

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(PREFIX)) {
    return {
      url: new URL(specifier.slice(PREFIX.length), SDK_BASE).href,
      shortCircuit: true,
    }
  }
  return next(specifier, context)
}
