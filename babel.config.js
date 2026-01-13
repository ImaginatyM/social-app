module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      'macros',
      [
        'module-resolver',
        {
          alias: {
            '#': './src',
            crypto: './src/platform/crypto.ts',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
