const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .tflite pose models ship as bundled assets (fast-tflite loads them by asset id)
config.resolver.assetExts.push('tflite');

module.exports = config;
