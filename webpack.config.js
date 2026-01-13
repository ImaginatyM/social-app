const createExpoWebpackConfigAsync = require('@expo/webpack-config')
const {withAlias} = require('@expo/webpack-config/addons')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer')
const {sentryWebpackPlugin} = require('@sentry/webpack-plugin')
const path = require('path')
const {version} = require('./package.json')

const GENERATE_STATS = process.env.EXPO_PUBLIC_GENERATE_STATS === '1'
const OPEN_ANALYZER = process.env.EXPO_PUBLIC_OPEN_ANALYZER === '1'

const reactNativeWebWebviewConfiguration = {
  test: /postMock.html$/,
  use: {
    loader: 'file-loader',
    options: {
      name: '[name].[ext]',
    },
  },
}

module.exports = async function (env, argv) {
  let config = await createExpoWebpackConfigAsync(env, argv)
  config = withAlias(config, {
    'react-native$': 'react-native-web',
    'react-native-webview': 'react-native-web-webview',
  })
  config.module.rules = [
    ...(config.module.rules || []),
    reactNativeWebWebviewConfiguration,
  ]
  if (env.mode === 'development') {
    config.plugins.push(new ReactRefreshWebpackPlugin())
  } else {
    // Support static CDN for chunks
    config.output.publicPath = 'auto'
  }

  if (GENERATE_STATS || OPEN_ANALYZER) {
    config.plugins.push(
      new BundleAnalyzerPlugin({
        openAnalyzer: OPEN_ANALYZER,
        generateStatsFile: true,
        statsFilename: '../stats.json',
        analyzerMode: OPEN_ANALYZER ? 'server' : 'json',
        defaultSizes: 'parsed',
      }),
    )
  }
  if (process.env.SENTRY_AUTH_TOKEN) {
    config.plugins.push(
      sentryWebpackPlugin({
        org: 'blueskyweb',
        project: 'app',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          // fallback needed for Render.com deployments
          name: process.env.SENTRY_RELEASE || version,
          dist: process.env.SENTRY_DIST,
        },
      }),
    )
  }

  const ensurePostCssLoader = rule => {
    if (!rule || !Array.isArray(rule.use)) return
    const hasPostCss = rule.use.some(entry => {
      const loader = typeof entry === 'string' ? entry : entry?.loader
      return typeof loader === 'string' && loader.includes('postcss-loader')
    })
    if (hasPostCss) return
    const cssLoaderIndex = rule.use.findIndex(entry => {
      const loader = typeof entry === 'string' ? entry : entry?.loader
      return typeof loader === 'string' && loader.includes('css-loader')
    })
    if (cssLoaderIndex === -1) return
    rule.use.splice(cssLoaderIndex + 1, 0, {
      loader: require.resolve('postcss-loader'),
      options: {
        postcssOptions: {
          config: path.join(__dirname, 'postcss.config.js'),
        },
      },
    })
  }

  const visitRules = rules => {
    if (!Array.isArray(rules)) return
    for (const rule of rules) {
      if (rule.oneOf) {
        visitRules(rule.oneOf)
        continue
      }
      if (rule.test && rule.test.toString().includes('css')) {
        ensurePostCssLoader(rule)
      }
    }
  }

  visitRules(config.module?.rules)

  return config
}
