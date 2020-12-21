import { resolve } from "path";

const wasmExtensionRegExp = /\.wasm$/;

export default function override(config) {
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

  config.module.rules.push({
    test: wasmExtensionRegExp,
    include: resolve(__dirname, "src"),
    use: [{
      loader: require.resolve("wasm-loader"),
      options: {}
    }]
  });

  return config;
}