// One-command uninstall for the MCP Hub plugin.
//
// `plugin_manager remove_bundle` (or `dsh plugin remove`) clears the profile
// dependency and the bundle selection but leaves two things behind that dirty
// or break the next boot:
//   1. the `- id: mcp-hub` config row the Settings service wrote — an orphan
//      row the loader cannot resolve on the next start;
//   2. the `link:` symlink under the profile's node_modules.
//
// Usage:
//   node tools/uninstall.mjs             # clean up after removing the bundle
//   node tools/uninstall.mjs --dry-run   # show what would change
//   node tools/uninstall.mjs --keep-config  # keep the server list for a reinstall
//   node tools/uninstall.mjs --run-cli   # also run `dsh plugin --profile <p> remove dsh-mcp-hub`
//
// The script refuses to clean config while the plugin is still installed: that
// state is a half-uninstall, and the running Harness would rewrite the row.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'

const HOME = process.env.HOME ?? homedir()
const PROFILE = process.env.DSH_PROFILE ?? 'web'
const PROFILE_DIR = process.env.DSH_PROFILE_DIR ?? join(HOME, '.dsh', 'profiles', PROFILE)
const PATCH = join(PROFILE_DIR, 'cordis.patch.yml')
const MANIFEST = join(PROFILE_DIR, 'package.json')
const NODE_MODULES = join(PROFILE_DIR, 'node_modules')
const ROW_ID = 'mcp-hub'
const PACKAGE = 'dsh-mcp-hub'

const dryRun = process.argv.includes('--dry-run')
const keepConfig = process.argv.includes('--keep-config')
const runCli = process.argv.includes('--run-cli')

const steps = []
const record = (name, status, detail = '') => {
  steps.push({ name, status, detail })
  console.log(`${status.padEnd(6)} ${name}${detail ? `  — ${detail}` : ''}`)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

// ── 1. optional: let the CLI do the package removal ─────────────────────────
if (runCli) {
  const args = ['plugin', '--profile', PROFILE, 'remove', PACKAGE]
  if (dryRun) {
    record('dsh plugin remove', 'would', args.join(' '))
  } else {
    try {
      execFileSync('dsh', args, { stdio: 'inherit' })
      record('dsh plugin remove', 'ok')
    } catch (error) {
      record('dsh plugin remove', 'FAIL', String(error.message).slice(0, 120))
    }
  }
}

// ── 2. pre-flight: is the plugin actually gone? ─────────────────────────────
const manifest = readJson(MANIFEST)
const deps = manifest?.dependencies ?? {}
const bundles = manifest?.dsh?.profile?.bundles ?? []
const stillDependency = Object.hasOwn(deps, PACKAGE)
const stillBundle = bundles.includes(PACKAGE)
const linkPath = join(NODE_MODULES, PACKAGE)
const linkPresent = existsSync(linkPath)

record(
  'dependency removed',
  stillDependency ? 'FAIL' : 'ok',
  stillDependency ? `${PACKAGE} is still in ${MANIFEST}` : '',
)
record(
  'bundle selection removed',
  stillBundle ? 'FAIL' : 'ok',
  stillBundle ? `${PACKAGE} is still in dsh.profile.bundles` : '',
)

const blocking = stillDependency || stillBundle
if (blocking && !dryRun) {
  console.log('\nRefusing to touch the config: the plugin is still installed.')
  console.log('Remove it first, then re-run this script:')
  console.log(`  plugin_manager remove_bundle ${PACKAGE}`)
  console.log(`  # or: dsh plugin --profile ${PROFILE} remove ${PACKAGE}`)
  console.log(`  node tools/uninstall.mjs`)
  process.exitCode = 1
  process.exit(1)
}

// ── 3. config row ───────────────────────────────────────────────────────────
if (keepConfig) {
  record('config row', 'kept', '--keep-config')
} else if (!existsSync(PATCH)) {
  record('config row', 'ok', 'no profile patch')
} else {
  const lines = readFileSync(PATCH, 'utf8').split('\n')
  const start = lines.findIndex((line) => line === `- id: ${ROW_ID}`)
  if (start < 0) {
    record('config row', 'ok', 'already absent')
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
      record('config row', 'would', `remove ${removed} line(s) at ${start + 1}`)
    } else {
      const next = [...lines.slice(0, start), ...lines.slice(end)]
      while (next.length > 0 && next[next.length - 1] === '') next.pop()
      writeFileSync(PATCH, `${next.join('\n')}\n`)
      record('config row', 'ok', `removed ${removed} line(s)`)
    }
  }
}

// ── 4. link symlink ─────────────────────────────────────────────────────────
if (!linkPresent) {
  record('node_modules link', 'ok', 'already absent')
} else if (dryRun) {
  record('node_modules link', 'would', `remove ${linkPath}`)
} else {
  // a leftover may be a symlink (link: dependency) or a materialized directory;
  // recursive removal handles both without following the symlink target
  rmSync(linkPath, { force: true, recursive: true })
  record('node_modules link', 'ok', `removed ${linkPath}`)
}

// ── 5. final verification ──────────────────────────────────────────────────
if (!dryRun) {
  const after = readJson(MANIFEST)
  const rowLeft = existsSync(PATCH)
    ? readFileSync(PATCH, 'utf8').split('\n').some((line) => line === `- id: ${ROW_ID}`)
    : false
  const depLeft = Object.hasOwn(after?.dependencies ?? {}, PACKAGE)
  const bundleLeft = (after?.dsh?.profile?.bundles ?? []).includes(PACKAGE)
  const linkLeft = existsSync(linkPath)
  const clean = !depLeft && !bundleLeft && !linkLeft && (keepConfig ? true : !rowLeft)
  record('verification', clean ? 'ok' : 'FAIL', clean ? 'profile is clean' : 'leftovers remain')
  if (clean) {
    console.log(`\nDone. Restart DSH so the loader drops the ${PACKAGE} row.`)
  } else {
    process.exitCode = 1
  }
}

const failed = steps.filter((step) => step.status === 'FAIL').length
console.log(`\n${steps.length - failed}/${steps.length} checks passed${dryRun ? ' (dry run)' : ''}`)
