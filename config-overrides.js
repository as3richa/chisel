const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const wasmExtensionRegex = /\.wasm$/;
const workerExtensionRegex = /\.worker\.ts$/;

module.exports = function override(config) {
  config.resolve.extensions.push(".wasm");

  config.module.rules.forEach(rule => {
    if (!rule.oneOf) {
      return;
    }
      
    rule.oneOf.forEach(oneOf => {
      if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
        oneOf.exclude.push(wasmExtensionRegex);
      }
    });
  });

  config.module.rules.push({
    test: workerExtensionRegex,
    loader: "worker-loader"
  });

  if (!config.plugins) {
    config.plugins = [];
  }

  config.plugins.push(new WasmPackPlugin({
    crateDirectory: path.resolve(__dirname, "src/rs"),
  }));

  config.plugins.push()

  return config;
}