// Resolve `@modelcontextprotocol/sdk/*` against the Harness installation for
// standalone tests. The device's shared storage cannot hold symlinks, so the
// mapping happens in a module resolve hook instead of node_modules.
import { register } from 'node:module'

register('./sdk-resolve.mjs', import.meta.url)
