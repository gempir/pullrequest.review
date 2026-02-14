#!/usr/bin/env node
/**
 * TanStack usage report (read-only)
 *
 * Scans a project for imports/usages of @tanstack/* packages.
 * Useful for quickly understanding how a repo uses the TanStack suite.
 *
 * Usage:
 *   node scripts/tanstack-usage-report.mjs
 *   node scripts/tanstack-usage-report.mjs --cwd path/to/project
 *   node scripts/tanstack-usage-report.mjs --json
 */

import fs from 'fs'
import path from 'path'

function parseArgs(argv) {
  const args = { cwd: null, json: false, help: false }
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

const DEFAULT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.output',
  '.turbo',
  '.cache',
  '.vercel',
  '.netlify',
  'coverage',
])

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.claude' && ent.name !== '.codex') {
      // skip most dotfolders; collect skills folders if present
      // (still useful to see skill usage)
    }
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue
      walk(full, files)
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name)
      if (!DEFAULT_EXTS.has(ext)) continue
      files.push(full)
    }
  }
  return files
}

function addCount(map, key, inc = 1) {
  map[key] = (map[key] ?? 0) + inc
}

function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    process.stdout.write(
      [
        'TanStack usage report (read-only)',
        '',
        'Usage:',
        '  node tanstack-usage-report.mjs',
        '  node tanstack-usage-report.mjs --cwd path/to/project',
        '  node tanstack-usage-report.mjs --json',
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

  const root = path.dirname(pkgPath)
  const allFiles = walk(root)

  /** @type {Record<string, number>} */
  const pkgCounts = {}
  /** @type {Record<string, string[]>} */
  const pkgFiles = {}
  /** @type {Record<string, number>} */
  const featureHits = {}
  /** @type {Record<string, string[]>} */
  const featureFiles = {}

  const tanstackImportRe = /from\s+['"](@tanstack\/[^'"]+)['"]/g
  const tanstackRequireRe = /require\(\s*['"](@tanstack\/[^'"]+)['"]\s*\)/g

  const featureRegexes = {
    TanStackDevtools: /\bTanStackDevtools\b/g,
    ReactQueryDevtools: /\bReactQueryDevtools\b/g,
    TanStackRouterDevtools: /\bTanStackRouterDevtools\b/g,
    formDevtoolsPlugin: /\bformDevtoolsPlugin\b/g,
    pacerDevtoolsPlugin: /\bpacerDevtoolsPlugin\b/g,
    aiDevtoolsPlugin: /\baiDevtoolsPlugin\b/g,
    createServerFn: /\bcreateServerFn\b/g,
    createFileRoute: /\bcreateFileRoute\b/g,
    createRootRoute: /\bcreateRootRoute\b/g,
    createRootRouteWithContext: /\bcreateRootRouteWithContext\b/g,
    useQuery: /\buseQuery\b/g,
    useMutation: /\buseMutation\b/g,
    useReactTable: /\buseReactTable\b/g,
    useVirtualizer: /\buseVirtualizer\b/g,
    useDebouncedValue: /\buseDebouncedValue\b/g,
    useForm: /\buseForm\b/g,
    toolDefinition: /\btoolDefinition\b/g,
  }

  for (const file of allFiles) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }

    // package imports
    const pkgs = new Set()

    for (const re of [tanstackImportRe, tanstackRequireRe]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(content))) {
        pkgs.add(m[1])
      }
    }

    for (const p of pkgs) {
      addCount(pkgCounts, p)
      ;(pkgFiles[p] ??= []).push(path.relative(root, file))
    }

    // feature hits
    for (const [name, re] of Object.entries(featureRegexes)) {
      re.lastIndex = 0
      if (re.test(content)) {
        addCount(featureHits, name)
        ;(featureFiles[name] ??= []).push(path.relative(root, file))
      }
    }
  }

  // Sort packages by usage count
  const sortedPkgs = Object.entries(pkgCounts).sort((a, b) => b[1] - a[1])

  const report = {
    projectRoot: root,
    scannedFiles: allFiles.length,
    tanstackPackages: Object.fromEntries(sortedPkgs),
    packageFiles: pkgFiles,
    featureHits,
    featureFiles,
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    return
  }

  console.log('TanStack usage report')
  console.log('Project:', root)
  console.log('Scanned files:', allFiles.length)
  console.log('')

  if (!sortedPkgs.length) {
    console.log('— No @tanstack/* imports found in scanned source files.')
  } else {
    console.log('Top @tanstack/* imports')
    for (const [pkg, count] of sortedPkgs.slice(0, 25)) {
      console.log(`- ${pkg}  (${count} file${count === 1 ? '' : 's'})`)
    }
  }

  console.log('')
  console.log('Feature signals')
  for (const [k, v] of Object.entries(featureHits).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${k}: ${v} file${v === 1 ? '' : 's'}`)
  }

  console.log('')
  console.log('Tip: run with --json to get file lists for each package/feature.')
}

try {
  main()
} catch (err) {
  console.error('❌', err?.message ?? err)
  process.exit(1)
}
