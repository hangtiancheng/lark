/* eslint-disable @typescript-eslint/ban-ts-comment */
import { fileURLToPath } from 'url'
import path from 'path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import Dotenv from 'dotenv-webpack'
import type { Configuration } from 'webpack'
import 'webpack-dev-server'
import { setupMockMiddlewares } from './plugins/webpack-server.js'
import createJsonFiles from './plugins/create-json.js'
import WebpackConditionalBundlePlugin from '@lark/conditional-bundle-plugin/webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { createConditionalVars, resolveSelectedRoutes } from './shared.js'
// import type { Application } from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'
const envFile = isProduction ? '.env.production' : '.env.development'

export default async () => {
  const { routeFlags } = await resolveSelectedRoutes({
    mode: isProduction ? 'production' : 'development',
    interactive: !isProduction,
  })

  const config: Configuration = {
    entry: './src/main.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
          ],
        },
        {
          test: /\.module\.(scss|sass)$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: '[name]__[local]__[hash:base64:5]',
                  namedExport: false,
                  exportLocalsConvention: 'as-is',
                },
              },
            },
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(scss|sass)$/,
          exclude: /\.module\.(scss|sass)$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new WebpackConditionalBundlePlugin({
        includes: ['**/*.ts', '**/*.tsx'],
        vars: createConditionalVars(routeFlags),
      }),
      new HtmlWebpackPlugin({
        template: './index.html',
      }),
      new Dotenv({
        path: path.resolve(__dirname, envFile),
        systemvars: true,
      }),
      {
        apply: (compiler) => {
          compiler.hooks.beforeRun.tap('CreateJsonFiles', () => {
            // ./plugins/assets/robot-list.json
            // ./plugins/assets/order-list.json
            createJsonFiles()
          })
        },
      },
      ...(isProduction ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        // ./dist/stats.html
        reportFilename: 'stats.html',
        openAnalyzer: false,
      }),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      compress: true,
      port: 8080,
      historyApiFallback: true,
      // proxy: [
      //   {
      //     context: ['/api/v1'],
      //     target: 'http://localhost:3000',
      //     changeOrigin: true,
      //   },
      // ],
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer || !devServer.app) {
          throw new Error('webpack-dev-server is not defined')
        }
        // @ts-ignore
        setupMockMiddlewares(devServer.app).catch(console.error)
        return middlewares
      },
    },
  }

  return config
}
