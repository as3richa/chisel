const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const wasmExtensionRegExp = /\.wasm$/;

module.exports = function override(config) {
  config.resolve.extensions.push(".wasm");

  config.module.rules.forEach(rule => {
    if (!rule.oneOf) {
      return;
    }
      
    rule.oneOf.forEach(oneOf => {
      if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
        oneOf.exclude.push(wasmExtensionRegExp);
      }
    });
  });

  if (!config.plugins) {
    config.plugins = [];
  }

  config.plugins.push(new WasmPackPlugin({
    crateDirectory: path.resolve(__dirname, "src/gouge"),
  }));

  return config;
}