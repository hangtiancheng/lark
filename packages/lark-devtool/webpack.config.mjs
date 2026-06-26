// @ts-check

import path from "path";
import { fileURLToPath } from "url";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import webpack from 'webpack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {Record<string, unknown>} env
 * @param {{ mode: "development" | "production" }} argv
 *
 */
export default (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: "./src/remote-entry.tsx",

    output: {
      clean: true,
      filename: "js/[name].[contenthash:8].js",
      path: path.resolve(__dirname, "dist"),
      publicPath: "auto",
    },

    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                noEmit: false,
              },
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: ["@tailwindcss/postcss"],
                },
              },
            },
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: "asset/resource",
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: "./webpack-index.html",
        inject: "body",
        minify: false,
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: "public", to: "." }],
      }),

      // ── Module Federation (Host) ──
      // Consumes remote Lark views from lark-demo running on port 3000.
      // At runtime: import('lark-demo/counter-view') loads the remote module.
      new webpack.container.ModuleFederationPlugin({
        name: "lark_devtool",
        filename: "remoteEntry.js",
        remotes: {
          "lark-demo": "lark_demo@http://localhost:3000/remoteEntry.js",
        },
        shared: {
          "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
          react: { singleton: true, eager: true },
          "react-dom": { singleton: true, eager: true },
        },
      }),
    ],

    devServer: {
      port: 5173,
      open: true,
      hot: true,
      compress: true,
      historyApiFallback: true,
      // CORS headers — allow CDN (lark-cdn:3300) and other origins to load remoteEntry.js
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },

    optimization: isProd
      ? {
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendor",
              chunks: "all",
            },
          },
        },
      }
      : undefined,

    devtool: isProd ? "hidden-source-map" : "source-map",
  };
};
