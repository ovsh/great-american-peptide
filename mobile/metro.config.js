const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];
config.transformer.assetPlugins = [
  ...(config.transformer.assetPlugins ?? []),
  'expo-asset/tools/hashAssetFiles',
];

module.exports = config;
