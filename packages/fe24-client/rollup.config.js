// @ts-check

/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').OutputBundle} OutputBundle */
/** @typedef {import('rollup').Plugin} RollupPlugin */
/** @typedef {import('rollup').RollupOptions} RollupOptions */

import path from 'node:path'
import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript'
import url from '@rollup/plugin-url'
import { defineConfig } from 'rollup'
import postcss from 'rollup-plugin-postcss'
import RollupConditionalBundlePlugin from '@lark/conditional-bundle-plugin/rollup'
import {
  copyPublicAssets,
  createClientEnv,
  createConditionalVars,
  createHtmlDocument,
  packageRoot,
  resolveSelectedRoutes,
  toProcessEnvDefineMap,
} from './shared.js'

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production'
const isProduction = mode === 'production'
const outDir = path.resolve(packageRoot, 'dist-rollup')
const { routeFlags } = await resolveSelectedRoutes({
  mode,
  interactive: false,
})

/**
 * Emits `index.html` and copies public assets after Rollup writes bundles.
 *
 * @returns {RollupPlugin}
 */
function emitHtmlAndPublicAssets() {
  /** @type {RollupPlugin} */
  return {
    name: 'emit-html-and-public-assets',
    /**
     * @this {import('rollup').PluginContext}
     * @param {OutputOptions} _outputOptions
     * @param {OutputBundle} bundle
     */
    async generateBundle(_outputOptions, bundle) {
      const scripts = []
      const styles = []

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          scripts.push(`./${fileName}`)
        }

        if (item.type === 'asset' && fileName.endsWith('.css')) {
          styles.push(`./${fileName}`)
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: await createHtmlDocument({ scripts, styles }),
      })
    },
    async writeBundle() {
      await copyPublicAssets(outDir)
    },
  }
}

/** @type {RollupOptions} */
const rollupOptions = {
  input: path.resolve(packageRoot, 'src/main.tsx'),
  output: {
    dir: outDir,
    format: 'esm',
    sourcemap: true,
    entryFileNames: 'assets/[name]-[hash].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name]-[hash][extname]',
  },
  plugins: [
    RollupConditionalBundlePlugin({
      includes: ['**/*.ts', '**/*.tsx'],
      vars: createConditionalVars(routeFlags),
    }),
    replace({
      preventAssignment: true,
      values: toProcessEnvDefineMap(createClientEnv(mode, routeFlags)),
    }),
    alias({
      entries: [{ find: '@', replacement: path.resolve(packageRoot, 'src') }],
    }),
    resolve({
      browser: true,
      extensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx'],
    }),
    commonjs(),
    url({
      include: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif'],
      fileName: 'assets/[name]-[hash][extname]',
      limit: 0,
    }),
    postcss({
      extract: 'assets/main.css',
      minimize: isProduction,
      sourceMap: true,
      config: {
        path: path.resolve(packageRoot, 'postcss.config.mjs'),
        ctx: {},
      },
      extensions: ['.css', '.scss'],
      use: /** @type {any} */ ({
        sass: {},
      }),
    }),
    typescript({
      tsconfig: path.resolve(packageRoot, 'tsconfig.json'),
      compilerOptions: {
        noEmit: false,
        outDir: path.resolve(outDir, '.ts-temp'),
      },
    }),
    emitHtmlAndPublicAssets(),
  ],
}

export default defineConfig(rollupOptions)
