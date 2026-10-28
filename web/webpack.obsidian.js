const path = require('path')
const { createRequire } = require('module')
const webpack = require('webpack')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const root = path.resolve(__dirname, '..')
const engineRequire = createRequire(require.resolve('simple-mind-map/package.json'))
const engine = require('../simple-mind-map/package.json')
const aliases = Object.fromEntries(Object.keys(engine.dependencies).map(name => [name + '$', engineRequire.resolve(name)]))
Object.assign(aliases, {
  '@': path.join(__dirname, 'src'),
  'simple-mind-map$': path.join(root, 'simple-mind-map/index.js'),
  'simple-mind-map': path.join(root, 'simple-mind-map'),
  'vue$': require.resolve('vue/dist/vue.runtime.esm.js')
})

function scopeStyles() {
  return stylesheet => stylesheet.walkRules(rule => {
    if (!rule.selector || rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
    rule.selectors = rule.selectors.map(selector => {
      if (selector.startsWith('.pmind-') || selector.includes('.pmind-view')) return selector
      const local = selector.replace(/^(?:html|body|:root)(?=[\s.#:]|$)/, '.pmind-editor')
      return local.startsWith('.pmind-editor') ? local : '.pmind-editor ' + local
    })
  })
}

const cssLoaders = [MiniCssExtractPlugin.loader, 'css-loader', {
  loader: 'postcss-loader', options: { plugins: [scopeStyles()] }
}]

module.exports = {
  mode: 'production',
  context: __dirname,
  entry: path.join(root, 'plugin/src/main.js'),
  output: { path: path.join(root, 'plugin/dist'), filename: 'main.js', libraryTarget: 'commonjs2', publicPath: '' },
  externals: { obsidian: 'commonjs obsidian' },
  resolve: { alias: aliases, extensions: ['.js', '.mjs', '.vue', '.json'], modules: [path.join(__dirname, 'node_modules'), 'node_modules'] },
  resolveLoader: { modules: [path.join(__dirname, 'node_modules')] },
  module: { rules: [
    { test: /\.vue$/, loader: 'vue-loader' },
    { test: /\.m?js$/, type: 'javascript/auto', use: path.join(__dirname, 'scripts/obsidian-transform.js') },
    { test: /\.css$/, use: cssLoaders },
    { test: /\.less$/, use: [...cssLoaders, 'less-loader'] },
    { test: /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/, loader: 'url-loader', options: { limit: Infinity, esModule: false } }
  ] },
  plugins: [new VueLoaderPlugin(), new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  optimization: { minimize: false, splitChunks: false, runtimeChunk: false },
  performance: { hints: false },
  devtool: false
}
