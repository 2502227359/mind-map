const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const config = require('../webpack.obsidian')

webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true, errorDetails: true }))
    process.exitCode = 1
    return
  }
  fs.copyFileSync(path.resolve(__dirname, '../../plugin/manifest.json'), path.join(config.output.path, 'manifest.json'))
  fs.copyFileSync(path.resolve(__dirname, '../../LICENSE'), path.join(config.output.path, 'LICENSE'))
  console.log(stats.toString({ all: false, assets: true, warnings: true }))
})
