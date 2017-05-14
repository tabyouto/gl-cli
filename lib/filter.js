var match = require('minimatch')
var evaluate = require('./eval')
/**
 * 过滤删除无用的文件
 * @param files
 * @param filters
 * @param data
 * @param done
 * @returns {*}
 */
module.exports = function (files, filters, data, done) {
  console.log('files',files)
  console.log('filters',filters)
  console.log('data',data)
  if (!filters) {
    return done()
  }
  var fileNames = Object.keys(files)
  Object.keys(filters).forEach(function (glob) {
    fileNames.forEach(function (file) {
      if (match(file, glob, { dot: true })) {
        var condition = filters[glob]
        if (!evaluate(condition, data)) {
          delete files[file]
        }
      }
    })
  })
  done()
}
