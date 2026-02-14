#!/usr/bin/env node
/**
 * TanStack Router plugin check (read-only)
 *
 * Validates common file-based routing setup:
 * - @tanstack/react-router installed
 * - @tanstack/router-plugin installed
 * - Vite config references the router plugin
 * - A generated routeTree.gen.* file exists
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function pickDeps(pkgJson) {
  const out = {}
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (pkgJson && typeof pkgJson[field] === 'object') Object.assign(out, pkgJson[field])
  }
  return out
}

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

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue
      walk(full, out)
    } else if (ent.isFile()) {
      out.push(full)
    }
  }
  return out
}

function existsAny(root, names) {
  for (const n of names) {
    const p = path.join(root, n)
    if (fs.existsSync(p)) return p
  }
  return null
}

function main() {
  const args = parseArgs(process.argv)

  if (args.help) {
    process.stdout.write(
      [
        'TanStack Router plugin check (read-only)',
        '',
        'Usage:',
        '  node tanstack-router-plugin-check.mjs',
        '  node tanstack-router-plugin-check.mjs --cwd path/to/project',
        '  node tanstack-router-plugin-check.mjs --json',
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
  const pkgJson = readJson(pkgPath)
  const deps = pickDeps(pkgJson)

  const hasRouter = Boolean(deps['@tanstack/react-router'])
  const hasRouterPlugin = Boolean(deps['@tanstack/router-plugin'])

  const viteConfig = existsAny(root, [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ])

  let viteMentionsRouterPlugin = false
  let viteMentions = []
  if (viteConfig) {
    const c = fs.readFileSync(viteConfig, 'utf8')
    const hits = []
    if (c.includes('@tanstack/router-plugin')) hits.push('@tanstack/router-plugin')
    if (c.includes('routerPlugin')) hits.push('routerPlugin')
    if (c.includes('TanStackRouter')) hits.push('TanStackRouter')
    viteMentions = hits
    viteMentionsRouterPlugin = hits.length > 0
  }

  // Find routeTree.gen.* files
  const files = walk(root)
  const routeTreeFiles = files
    .filter((f) => /routeTree\.gen\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path.basename(f)))
    .map((f) => path.relative(root, f))

  // Find a routes directory (best-effort)
  const routesDirs = files
    .filter((f) => /\/(routes)\//.test(f.replace(/\\/g, '/')))
    .map((f) => {
      const norm = f.replace(/\\/g, '/')
      const idx = norm.lastIndexOf('/routes/')
      return idx >= 0 ? norm.slice(0, idx + '/routes'.length) : null
    })
    .filter(Boolean)
  const uniqueRoutesDirs = [...new Set(routesDirs)].map((d) => path.relative(root, d))

  const report = {
    projectRoot: root,
    hasRouter,
    hasRouterPlugin,
    viteConfig: viteConfig ? path.relative(root, viteConfig) : null,
    viteMentionsRouterPlugin,
    viteMentions,
    routeTreeFiles,
    routesDirs: uniqueRoutesDirs,
    recommendations: [],
  }

  if (!hasRouter) {
    report.recommendations.push('Install @tanstack/react-router (or use TanStack Start).')
  }
  if (hasRouter && !hasRouterPlugin) {
    report.recommendations.push('For file-based routing, install @tanstack/router-plugin (Vite plugin).')
  }
  if (hasRouterPlugin && !viteMentionsRouterPlugin) {
    report.recommendations.push('Router plugin is installed but not detected in vite.config.*. Add it to Vite plugins.')
  }
  if (hasRouter && hasRouterPlugin && routeTreeFiles.length === 0) {
    report.recommendations.push(
      'No routeTree.gen.* file found. Ensure the Router plugin is configured and run the dev server/build to generate it.',
    )
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    return
  }

  console.log('TanStack Router plugin check')
  console.log('Project:', root)
  console.log('')

  console.log(hasRouter ? '✅ @tanstack/react-router installed' : '— @tanstack/react-router not detected')
  console.log(hasRouterPlugin ? '✅ @tanstack/router-plugin installed' : '— @tanstack/router-plugin not detected')
  console.log('')

  console.log('Vite config:', report.viteConfig ?? '(not found)')
  if (viteConfig) {
    console.log('Mentions router plugin:', viteMentionsRouterPlugin ? `✅ (${viteMentions.join(', ')})` : '—')
  }
  console.log('')

  console.log('Generated route tree files:', routeTreeFiles.length ? '' : '(none found)')
  for (const f of routeTreeFiles) console.log('- ' + f)
  console.log('')

  console.log('Detected routes directories:', uniqueRoutesDirs.length ? '' : '(none detected)')
  for (const d of uniqueRoutesDirs) console.log('- ' + d)
  console.log('')

  if (report.recommendations.length) {
    console.log('Recommendations')
    for (const r of report.recommendations) console.log('- ' + r)
  } else {
    console.log('✅ No obvious file-based routing setup issues detected.')
  }
}

try {
  main()
} catch (err) {
  console.error('❌', err?.message ?? err)
  process.exit(1)
}
