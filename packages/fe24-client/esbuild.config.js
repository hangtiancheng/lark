// @ts-check

/** @typedef {import('esbuild').BuildOptions} BuildOptions */
/** @typedef {import('esbuild').Metafile} Metafile */
/** @typedef {{ extract?: boolean; postcss?: { plugins?: unknown[] } }} StylePluginOptions */

import path from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import { build } from 'esbuild'
import stylePlugin from '@apivm/esbuild-style-plugin'
import EsbuildConditionalBundlePlugin from '@lark/conditional-bundle-plugin/esbuild'
import {
  copyPublicAssets,
  createClientEnv,
  createConditionalVars,
  packageRoot,
  resolveSelectedRoutes,
  toProcessEnvDefineMap,
  writeHtmlFile,
} from './shared.js'

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production'
const outDir = path.resolve(packageRoot, 'dist-esbuild')
const { routeFlags } = await resolveSelectedRoutes({
  mode,
  interactive: false,
})

/** @type {StylePluginOptions} */
const stylePluginOptions = /** @type {any} */ ({
  extract: true,
  postcss: {
    plugins: [tailwindcss()],
  },
})

/** @type {BuildOptions} */
const buildOptions = {
  absWorkingDir: packageRoot,
  entryPoints: [path.resolve(packageRoot, 'src/main.tsx')],
  outdir: outDir,
  bundle: true,
  format: 'esm',
  splitting: true,
  sourcemap: true,
  minify: mode === 'production',
  metafile: true,
  jsx: 'automatic',
  alias: {
    '@': path.resolve(packageRoot, 'src'),
  },
  entryNames: 'assets/[name]-[hash]',
  chunkNames: 'assets/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  conditions: ['style'],
  loader: {
    '.gif': 'file',
    '.jpeg': 'file',
    '.jpg': 'file',
    '.png': 'file',
    '.svg': 'file',
  },
  define: toProcessEnvDefineMap(createClientEnv(mode, routeFlags)),
  plugins: [
    EsbuildConditionalBundlePlugin({
      includes: ['**/*.ts', '**/*.tsx'],
      vars: createConditionalVars(routeFlags),
    }),
    stylePlugin(/** @type {any} */ (stylePluginOptions)),
  ],
}

const result = await build(buildOptions)

/** @type {Metafile | undefined} */
const metafile = result.metafile
const outputs = Object.keys(metafile?.outputs ?? {})

/** @type {string[]} */
const scripts = outputs
  .filter((file) => file.endsWith('.js') && metafile?.outputs[file]?.entryPoint)
  .map(
    (file) => `./${path.relative(outDir, path.resolve(packageRoot, file)).replaceAll('\\', '/')}`,
  )

/** @type {string[]} */
const styles = outputs
  .filter((file) => file.endsWith('.css'))
  .map(
    (file) => `./${path.relative(outDir, path.resolve(packageRoot, file)).replaceAll('\\', '/')}`,
  )

await copyPublicAssets(outDir)
await writeHtmlFile({
  outDir,
  scripts,
  styles,
})
