import path from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import { build } from 'esbuild'
import { sassPlugin } from 'esbuild-sass-plugin'
import postcssPlugin from 'esbuild-postcss-plugin'
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

function createEsbuildPlugin(plugin, options) {
  const created = plugin(options)
  return {
    name: created.name,
    setup(build) {
      created.setup(build)
    },
  }
}

const stylePluginOptions = {
  plugins: [tailwindcss()],
  disableCache: true,
}

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
    sassPlugin({
      filter: /\.module\.scss$/,
      type: 'local-css',
    }),
    sassPlugin({
      filter: /\.scss$/,
      type: 'css',
    }),
    createEsbuildPlugin(postcssPlugin, stylePluginOptions),
  ],
}

const result = await build(buildOptions)

const metafile = result.metafile
const outputs = Object.keys(metafile?.outputs ?? {})

const scripts = outputs
  .filter((file) => file.endsWith('.js') && metafile?.outputs[file]?.entryPoint)
  .map(
    (file) => `./${path.relative(outDir, path.resolve(packageRoot, file)).replaceAll('\\', '/')}`,
  )

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
