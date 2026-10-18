// Uninstall helper for the MCP Hub plugins.
//
// `plugin_manager remove_bundle` removes the profile dependency and the bundle
// selection, but it leaves two things behind that break or dirty the next boot:
//   1. the `- id: mcp-hub` config row written by the Settings service — an
//      orphan row the loader cannot resolve on the next start;
//   2. the `link:` symlinks under the profile's node_modules.
//
// Run this after removing both bundles:
//   node tools/uninstall-cleanup.mjs [--dry-run]
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const HOME = process.env.HOME ?? homedir()
const PROFILE = process.env.DSH_PROFILE ?? 'web'
const PROFILE_DIR = process.env.DSH_PROFILE_DIR ?? join(HOME, '.dsh', 'profiles', PROFILE)
const PATCH = join(PROFILE_DIR, 'cordis.patch.yml')
const ROW_ID = 'mcp-hub'
const LINKS = ['dsh-mcp-hub']

const dryRun = process.argv.includes('--dry-run')
const log = (...args) => console.log(...args)

let changed = 0

// 1. Drop the config row (and every continuation line that belongs to it).
if (existsSync(PATCH)) {
  const lines = readFileSync(PATCH, 'utf8').split('\n')
  const start = lines.findIndex((line) => line === `- id: ${ROW_ID}`)
  if (start < 0) {
    log(`patch: no ${ROW_ID} row (nothing to do)`)
  } else {
    let end = lines.length
    for (let index = start + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith('- id: ')) {
        end = index
        break
      }
    }
    const removed = end - start
    if (dryRun) {
      log(`patch: would remove ${removed} line(s) starting at ${start + 1}`)
    } else {
      const next = [...lines.slice(0, start), ...lines.slice(end)]
      while (next.length > 0 && next[next.length - 1] === '') next.pop()
      writeFileSync(PATCH, `${next.join('\n')}\n`)
      log(`patch: removed ${removed} line(s) starting at ${start + 1}`)
    }
    changed += 1
  }
} else {
  log(`patch: ${PATCH} does not exist`)
}

// 2. Remove the link: symlinks pnpm leaves behind.
for (const name of LINKS) {
  const target = join(PROFILE_DIR, 'node_modules', name)
  if (!existsSync(target)) {
    log(`link: ${name} already gone`)
    continue
  }
  if (dryRun) {
    log(`link: would remove ${target}`)
  } else {
    rmSync(target, { force: true, recursive: false })
    log(`link: removed ${target}`)
  }
  changed += 1
}

log(changed === 0 ? 'clean: nothing to do' : `done: ${changed} item(s) ${dryRun ? 'would change' : 'changed'}`)
