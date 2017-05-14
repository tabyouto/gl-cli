var chalk = require('chalk')
var Metalsmith = require('metalsmith') //An extremely simple, pluggable static site generator.
var Handlebars = require('handlebars')
var async = require('async')
var render = require('consolidate').handlebars.render
var path = require('path')
var multimatch = require('multimatch')
var getOptions = require('./options') //获得默认参数
var ask = require('./ask')
var filter = require('./filter')
var logger = require('./logger')

// register handlebars helper
Handlebars.registerHelper('if_eq', function (a, b, opts) {
  return a === b
    ? opts.fn(this)
    : opts.inverse(this)
})

Handlebars.registerHelper('unless_eq', function (a, b, opts) {
  return a === b
    ? opts.inverse(this)
    : opts.fn(this)
})

/**
 * Generate a template given a `src` and `dest`.
 *
 * @param {String} name
 * @param {String} src
 * @param {String} dest
 * @param {Function} done
 */
//src 临时目录 dest 目标目录
module.exports = function generate (name, src, dest, done) {
  var opts = getOptions(name, src) //返回处理过项目名称 作者等信息的object
  console.log('opts--->',opts);
  var metalsmith = Metalsmith(path.join(src, 'template')) //实例一个Metalsmith
  console.log('metalsmith------------>',metalsmith)
  var data = Object.assign(metalsmith.metadata(), {
    destDirName: name,
    inPlace: dest === process.cwd(),
    noEscape: true
  })
  opts.helpers && Object.keys(opts.helpers).map(function (key) {
    Handlebars.registerHelper(key, opts.helpers[key]) //注册一个helper的 func
    console.log('key---------',opts.helpers[key])
    console.log('key---------',key)
  })
    console.log(opts.helpers)

  var helpers = {chalk, logger}
  console.log('helpers',helpers)
  // if (opts.metalsmith && typeof opts.metalsmith.before === 'function') {
  //   opts.metalsmith.before(metalsmith, opts, helpers)
  // }

  metalsmith.use(askQuestions(opts.prompts)) //提问
    .use(filterFiles(opts.filters)) //过滤文件
    .use(renderTemplateFiles(opts.skipInterpolation)) //生成模板

  if (typeof opts.metalsmith === 'function') {
    opts.metalsmith(metalsmith, opts, helpers)
  } else if (opts.metalsmith && typeof opts.metalsmith.after === 'function') {
    opts.metalsmith.after(metalsmith, opts, helpers)
  }

  metalsmith.clean(false)
    .source('.') // start from template root instead of `./src` which is Metalsmith's default for `source`
    .destination(dest)
    .build(function (err, files) {
      done(err)
      if (typeof opts.complete === 'function') {
        var helpers = {chalk, logger, files}
        opts.complete(data, helpers)
      } else {
        logMessage(opts.completeMessage, data)
      }
    })

  return data
}

/**
 * Create a middleware for asking questions.
 *
 * @param {Object} prompts
 * @return {Function}
 */

function askQuestions (prompts) {
  return function (files, metalsmith, done) {
    console.log('开始提问',metalsmith.metadata())
    // { destDirName: 'testXX', inPlace: false, noEscape: true }
    ask(prompts, metalsmith.metadata(), done)
  }
}

/**
 * Create a middleware for filtering files.
 *
 * @param {Object} filters
 * @return {Function}
 */

function filterFiles (filters) {
  return function (files, metalsmith, done) {
    filter(files, filters, metalsmith.metadata(), done)
  }
}

/**
 * Template in place plugin.
 *
 * @param {Object} files
 * @param {Metalsmith} metalsmith
 * @param {Function} done
 */

function renderTemplateFiles (skipInterpolation) {
  console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  console.log('skipInterpolation',skipInterpolation)
  skipInterpolation = typeof skipInterpolation === 'string'
    ? [skipInterpolation]
    : skipInterpolation
  return function (files, metalsmith, done) {
    console.log('skipInterpolation',skipInterpolation) //undefined
    var keys = Object.keys(files)
    var metalsmithMetadata = metalsmith.metadata()
    console.log('metalsmithMetadata',metalsmithMetadata) //收集到的
    console.log('keys',keys) //template 目录下的文件名 template.html
    async.each(keys, function (file, next) {
      // skipping files with skipInterpolation option
      // if (skipInterpolation && multimatch([file], skipInterpolation, { dot: true }).length) {
      //   return next()
      // }
      var str = files[file].contents.toString()
      // do not attempt to render files that do not have mustaches
      if (!/{{([^{}]+)}}/g.test(str)) {
        return next()
      }
      // 填充到package.json
      render(str, metalsmithMetadata, function (err, res) {
        if (err) {
          err.message = `[${file}] ${err.message}`
          return next(err)
        }
        files[file].contents = new Buffer(res)
        next()
      })
    }, done)
  }
}

/**
 * Display template complete message.
 *
 * @param {String} message
 * @param {Object} data
 */

function logMessage (message, data) {
  if (!message) return
  render(message, data, function (err, res) {
    if (err) {
      console.error('\n   Error when rendering template complete message: ' + err.message.trim())
    } else {
      console.log('\n' + res.split(/\r?\n/g).map(function (line) {
        return '   ' + line
      }).join('\n'))
    }
  })
}
