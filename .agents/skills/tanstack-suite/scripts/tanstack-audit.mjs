#!/usr/bin/env node
/**
 * TanStack Suite Audit (read-only)
 *
 * - Reads package.json in the nearest parent directory (or --cwd)
 * - Prints which TanStack packages are installed
 * - Highlights common version-mismatch footguns
 *
 * Usage:
 *   node scripts/tanstack-audit.mjs
 *   node scripts/tanstack-audit.mjs --cwd path/to/project
 *   node scripts/tanstack-audit.mjs --json
 */

import fs from 'fs'
import path from 'path'

/** @typedef {{ major?: number, minor?: number, patch?: number, version?: string, raw: string }} Coerced */

function parseArgs(argv) {
  const args = {
    cwd: null,
    json: false,
    help: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--json') args.json = true
    else if (a === '--cwd') {
      const v = argv[i + 1]
      if (!v) throw new Error('Missing value for --cwd')
      args.cwd = v
      i++
    } else {
      throw new Error(`Unknown arg: ${a}`)
    }
  }

  return args
}

function findUpPackageJson(startDir) {
  let dir = startDir
  for (let i = 0; i < 50; i++) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

/**
 * Attempt to coerce a dependency spec into a semver-like object.
 * Handles common prefixes (^, ~, >=, etc) and workspace/file/link specs.
 *
 * @param {string} raw
 * @returns {Coerced}
 */
function coerceSemver(raw) {
  const r = String(raw ?? '').trim()

  // Strip common npm protocol prefixes
  const cleaned = r
    .replace(/^workspace:/, '')
    .replace(/^npm:/, '')
    .replace(/^file:/, '')
    .replace(/^link:/, '')
    .replace(/^portal:/, '')
    .replace(/^patch:/, '')

  // Grab first x.y.z occurrence
  const m = cleaned.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return { raw: r }

  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])
  const version = `${major}.${minor}.${patch}`

  return { raw: r, major, minor, patch, version }
}

function padRight(s, n) {
  const str = String(s)
  if (str.length >= n) return str
  return str + ' '.repeat(n - str.length)
}

function formatPkgLine(name, spec) {
  const coerced = spec ? coerceSemver(spec) : null
  const ver = coerced?.version ?? ''
  const show = spec ? `${spec}${ver && spec !== ver ? ` (→ ${ver})` : ''}` : '(not installed)'
  return `${padRight(name, 32)} ${show}`
}

function uniq(arr) {
  return [...new Set(arr)]
}

function pickDeps(pkgJson) {
  const out = {}
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (pkgJson && typeof pkgJson[field] === 'object') {
      Object.assign(out, pkgJson[field])
    }
  }
  return out
}

function compareExactVersionLine(specsByName) {
  // Return { ok: boolean, expected: string | null, mismatches: Array<{name, version}> }
  const entries = Object.entries(specsByName)
    .filter(([, v]) => typeof v === 'string' && v.length)
    .map(([k, v]) => ({ name: k, coerced: coerceSemver(v) }))
    .filter((x) => x.coerced.version)

  if (entries.length <= 1) {
    return { ok: true, expected: entries[0]?.coerced.version ?? null, mismatches: [] }
  }

  const expected = entries[0].coerced.version
  const mismatches = entries
    .filter((e) => e.coerced.version !== expected)
    .map((e) => ({ name: e.name, version: e.coerced.version }))

  return { ok: mismatches.length === 0, expected, mismatches }
}

function compareMajor(specA, specB) {
  const a = specA ? coerceSemver(specA) : null
  const b = specB ? coerceSemver(specB) : null
  if (!a?.major || !b?.major) return { comparable: false, ok: true, a, b }
  return { comparable: true, ok: a.major === b.major, a, b }
}

function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    process.stdout.write(
      [
        'TanStack Suite Audit (read-only)',
        '',
        'Usage:',
        '  node tanstack-audit.mjs',
        '  node tanstack-audit.mjs --cwd path/to/project',
        '  node tanstack-audit.mjs --json',
        '',
      ].join('\n'),
    )
    return
  }

  const startDir = args.cwd ? path.resolve(process.cwd(), args.cwd) : process.cwd()
  const pkgPath = findUpPackageJson(startDir)

  if (!pkgPath) {
    console.error('❌ Could not find package.json. Use --cwd to point at a project directory.')
    process.exit(1)
  }

  const projectRoot = path.dirname(pkgPath)
  const pkgJson = readJson(pkgPath)
  const deps = pickDeps(pkgJson)

  /** @type {Record<string, {packages: string[], notes?: string[]}>} */
  const groups = {
    Start: {
      packages: ['@tanstack/react-start', '@tanstack/start'],
      notes: [
        'Scaffolding is usually: npm create @tanstack/start@latest',
        'Start apps often also include Router + router-plugin.',
      ],
    },
    Router: {
      packages: ['@tanstack/react-router', '@tanstack/router-plugin', '@tanstack/react-router-devtools'],
    },
    Query: {
      packages: ['@tanstack/react-query', '@tanstack/react-query-devtools'],
    },
    Table: {
      packages: ['@tanstack/react-table'],
    },
    DB: {
      packages: ['@tanstack/db', '@tanstack/react-db', '@tanstack/query-db-collection', '@tanstack/rxdb-db-collection'],
    },
    Store: {
      packages: ['@tanstack/store', '@tanstack/react-store'],
    },
    Virtual: {
      packages: ['@tanstack/react-virtual'],
    },
    Pacer: {
      packages: ['@tanstack/pacer', '@tanstack/react-pacer', '@tanstack/react-pacer-devtools'],
    },
    Form: {
      packages: ['@tanstack/react-form', '@tanstack/react-form-start', '@tanstack/react-form-devtools'],
    },
    AI: {
      packages: [
        '@tanstack/ai',
        '@tanstack/ai-react',
        '@tanstack/ai-openai',
        '@tanstack/ai-anthropic',
        '@tanstack/ai-gemini',
        '@tanstack/ai-ollama',
        '@tanstack/react-ai-devtools',
      ],
    },
    Devtools: {
      packages: ['@tanstack/react-devtools', '@tanstack/devtools-vite'],
    },
  }

  /** @type {Record<string, any>} */
  const report = {
    projectRoot,
    packages: {},
    groups: {},
    warnings: [],
  }

  // Collect package versions
  for (const [groupName, group] of Object.entries(groups)) {
    const installed = {}
    for (const pkg of group.packages) {
      if (deps[pkg]) installed[pkg] = deps[pkg]
    }

    report.groups[groupName] = {
      installed,
      missing: group.packages.filter((p) => !deps[p]),
    }

    for (const [name, spec] of Object.entries(installed)) {
      report.packages[name] = { spec, coerced: coerceSemver(spec) }
    }
  }

  // Version alignment checks
  const routerFamily = {
    '@tanstack/react-start': deps['@tanstack/react-start'],
    '@tanstack/react-router': deps['@tanstack/react-router'],
    '@tanstack/router-plugin': deps['@tanstack/router-plugin'],
    '@tanstack/react-router-devtools': deps['@tanstack/react-router-devtools'],
  }

  const routerAlignment = compareExactVersionLine(routerFamily)
  if (!routerAlignment.ok) {
    report.warnings.push({
      type: 'version-mismatch',
      family: 'Router+Start',
      expected: routerAlignment.expected,
      mismatches: routerAlignment.mismatches,
      message:
        'Router/Start family versions appear mismatched. In many setups these should stay on the same version line.',
    })
  }

  const queryMajor = compareMajor(deps['@tanstack/react-query'], deps['@tanstack/react-query-devtools'])
  if (queryMajor.comparable && !queryMajor.ok) {
    report.warnings.push({
      type: 'version-mismatch',
      family: 'Query+Devtools',
      message: 'React Query and react-query-devtools majors differ; align them to the same major version.',
      details: {
        reactQuery: queryMajor.a?.version,
        reactQueryDevtools: queryMajor.b?.version,
      },
    })
  }

  // Devtools host present when plugins present
  const pluginPkgs = ['@tanstack/react-form-devtools', '@tanstack/react-pacer-devtools', '@tanstack/react-ai-devtools']
  const hasAnyPlugin = pluginPkgs.some((p) => deps[p])
  const hasHost = Boolean(deps['@tanstack/react-devtools'])
  if (hasAnyPlugin && !hasHost) {
    report.warnings.push({
      type: 'missing-host',
      family: 'TanStack Devtools',
      message:
        'Devtools plugin(s) are installed but @tanstack/react-devtools (the host panel) is missing. Install @tanstack/react-devtools.',
    })
  }

  // If --json, print machine-readable
  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    return
  }

  // Human-friendly output
  console.log('TanStack Suite Audit')
  console.log('Project:', projectRoot)
  console.log('')

  for (const [groupName, group] of Object.entries(groups)) {
    const installedPkgs = report.groups[groupName].installed
    const installedNames = Object.keys(installedPkgs)

    const status = installedNames.length ? '✅' : '—'
    console.log(`${status} ${groupName}`)

    // print all packages in the group (installed first)
    const ordered = uniq([...installedNames, ...group.packages.filter((p) => !installedPkgs[p])])
    for (const pkgName of ordered) {
      console.log('  ' + formatPkgLine(pkgName, deps[pkgName]))
    }

    if (group.notes?.length) {
      for (const note of group.notes) console.log('  • ' + note)
    }

    console.log('')
  }

  if (report.warnings.length) {
    console.log('⚠️  Warnings')
    for (const w of report.warnings) {
      console.log(`- ${w.message}`)
      if (w.family) console.log(`  family: ${w.family}`)
      if (w.expected) console.log(`  expected: ${w.expected}`)
      if (Array.isArray(w.mismatches) && w.mismatches.length) {
        console.log('  mismatches:')
        for (const m of w.mismatches) console.log(`    - ${m.name}: ${m.version}`)
      }
      if (w.details) console.log('  details:', w.details)
    }
    console.log('')
  } else {
    console.log('✅ No obvious version/host issues detected.')
  }

  console.log('Next steps:')
  console.log('- Run tanstack-usage-report.mjs to see where TanStack packages are imported.')
  console.log('- Run tanstack-router-plugin-check.mjs to validate file-based routing setup.')
  console.log('- Run tanstack-devtools-snippet.mjs to generate a devtools snippet for this repo.')
}

try {
  main()
} catch (err) {
  console.error('❌', err?.message ?? err)
  process.exit(1)
}
