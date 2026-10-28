const esbuild = require('esbuild')

module.exports = function transform(source) {
  return esbuild.transformSync(source, {
    loader: 'js', target: 'es2018',
    sourcefile: this.resourcePath
  }).code
}
