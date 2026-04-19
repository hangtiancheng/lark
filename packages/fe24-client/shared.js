// @ts-check

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkbox } from '@inquirer/prompts'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Shared env keys consumed by the client-side bundle.
 *
 * @typedef {Object} ClientEnv
 * @property {string} NODE_ENV
 * @property {string} SERVER_URL
 * @property {string} AMAP_JS_KEY
 * @property {string} AMAP_WEB_KEY
 * @property {string} MY_ENV
 * @property {string} app
 * @property {string} SELECTED_ROUTES
 */

/**
 * @typedef {{ mode?: string; interactive?: boolean }} ResolveSelectedRoutesOptions
 */

/**
 * @typedef {{ scripts?: string[]; styles?: string[] }} HtmlAssetsOptions
 */

/**
 * @typedef {{ outDir: string; scripts?: string[]; styles?: string[] }} WriteHtmlFileOptions
 */

export const packageRoot = path.resolve(__dirname, '..')
export const srcRoot = path.resolve(packageRoot, 'src')
export const publicRoot = path.resolve(packageRoot, 'public')
export const htmlTemplatePath = path.resolve(packageRoot, 'index.html')

/** @typedef {{ name: string; value: string; checked?: boolean }} RouteChoice */

/** @type {RouteChoice[]} */
export const routeChoices = [
  { name: 'All Routes', value: '*' },
  { name: 'Dashboard', value: 'dashboard', checked: true },
  { name: 'Main (fe24)', value: 'main' },
  { name: 'Robot Grid', value: 'main/grid' },
  { name: 'Map', value: 'map' },
  { name: 'Order', value: 'order' },
  { name: 'Order Detail', value: 'order/detail' },
]

/** @type {string[]} */
export const allRoutes = routeChoices.filter((item) => item.value !== '*').map((item) => item.value)

/** @type {string[]} */
export const defaultDevRoutes = ['dashboard', 'main', 'main/grid', 'map', 'order', 'order/detail']

/**
 * @param {string} [mode]
 */
export function loadProjectEnv(mode = 'development') {
  const files = ['.env', `.env.${mode}`]

  for (const file of files) {
    const envPath = path.resolve(packageRoot, file)
    if (fs.existsSync(envPath)) {
      dotenv.config({
        path: envPath,
        override: false,
      })
    }
  }
}

/**
 * @typedef {{
 *   isAllRoutes: boolean
 *   selectedRoutes: string[]
 *   routeFlags: Record<string, boolean>
 * }} RouteSelectionContext
 */

/**
 * @param {ResolveSelectedRoutesOptions} [options]
 * @returns {Promise<RouteSelectionContext>}
 */
export async function resolveSelectedRoutes({ mode = 'development', interactive = false } = {}) {
  loadProjectEnv(mode)

  const fromEnv = parseSelectedRoutes(process.env.SELECTED_ROUTES)
  if (fromEnv.length > 0) {
    return createRouteSelectionContext(fromEnv)
  }

  if (interactive) {
    try {
      const answers = await checkbox({
        message: 'Select routes to compile:',
        choices: routeChoices,
        required: true,
      })

      return createRouteSelectionContext(answers)
    } catch {
      return createRouteSelectionContext(defaultDevRoutes)
    }
  }

  return createRouteSelectionContext(allRoutes)
}

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
export function parseSelectedRoutes(value) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * @param {string[]} selectedRoutes
 * @returns {RouteSelectionContext}
 */
export function createRouteSelectionContext(selectedRoutes) {
  const isAllRoutes = selectedRoutes.includes('*')
  const normalizedRoutes = isAllRoutes
    ? allRoutes
    : unique(selectedRoutes.filter((item) => allRoutes.includes(item)))
  const routeFlags = Object.fromEntries(
    allRoutes.map((route) => [toRouteFlag(route), normalizedRoutes.includes(route)]),
  )

  return {
    isAllRoutes,
    selectedRoutes: normalizedRoutes,
    routeFlags,
  }
}

/**
 * @param {Record<string, boolean>} routeFlags
 * @returns {Record<string, string | boolean>}
 */
export function createConditionalVars(routeFlags) {
  return {
    MY_ENV: process.env.MY_ENV || 'prod',
    app: process.env.app || '1',
    ...routeFlags,
  }
}

/**
 * @param {string} mode
 * @param {Record<string, boolean>} routeFlags
 * @returns {ClientEnv}
 */
export function createClientEnv(mode, routeFlags) {
  return {
    NODE_ENV: mode,
    SERVER_URL: process.env.SERVER_URL || 'http://localhost:3000',
    AMAP_JS_KEY: process.env.AMAP_JS_KEY || '',
    AMAP_WEB_KEY: process.env.AMAP_WEB_KEY || '',
    MY_ENV: process.env.MY_ENV || 'prod',
    app: process.env.app || '1',
    SELECTED_ROUTES: Object.entries(routeFlags)
      .filter(([, enabled]) => enabled)
      .map(([key]) =>
        key
          .replace(/^ROUTE_/, '')
          .toLowerCase()
          .replaceAll('_', '/'),
      )
      .join(','),
  }
}

/**
 * @param {Record<string, unknown>} envObject
 * @returns {Record<string, string>}
 */
export function toProcessEnvDefineMap(envObject) {
  return Object.fromEntries(
    Object.entries(envObject).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  )
}

/**
 * @param {string} outDir
 */
export async function copyPublicAssets(outDir) {
  if (!fs.existsSync(publicRoot)) {
    return
  }

  await fsp.mkdir(outDir, { recursive: true })
  await fsp.cp(publicRoot, outDir, { recursive: true })
}

/**
 * @param {HtmlAssetsOptions} [options]
 * @returns {Promise<string>}
 */
export async function createHtmlDocument(options = {}) {
  const { scripts = [], styles = [] } = options
  let template = await fsp.readFile(htmlTemplatePath, 'utf8')
  template = template.replace('/vite.svg', '/favicon.ico')

  const styleTags = styles
    .map((href /** @type {string} */) => `    <link rel="stylesheet" href="${href}" />`)
    .join('\n')
  const scriptTags = scripts
    .map((src /** @type {string} */) => `    <script type="module" src="${src}"></script>`)
    .join('\n')

  if (styleTags) {
    template = template.replace('</head>', `${styleTags}\n  </head>`)
  }

  if (scriptTags) {
    template = template.replace('</body>', `${scriptTags}\n  </body>`)
  }

  return template
}

/**
 * @param {WriteHtmlFileOptions} options
 * @returns {Promise<void>}
 */
export async function writeHtmlFile({ outDir, scripts = [], styles = [] }) {
  const html = await createHtmlDocument({ scripts, styles })
  await fsp.mkdir(outDir, { recursive: true })
  await fsp.writeFile(path.resolve(outDir, 'index.html'), html, 'utf8')
}

/**
 * @param {string} route
 */
export function toRouteFlag(route) {
  return `ROUTE_${route.toUpperCase().replaceAll('/', '_')}`
}

/**
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
function unique(items) {
  return [...new Set(items)]
}
