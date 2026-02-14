const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",
  entry: "./src/client/index.ts",
  output: {
    path: path.resolve(__dirname, "dist/client"),
    filename: "bundle.js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "src/client/tsconfig.json"),
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "dist/client"),
    },
    port: 8087,
    hot: true,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3007",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3007",
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/client/index.html",
    }),
  ],
  devtool: "source-map",
};
