/**
 * Logging for Node.js
 * 
 * Class for logging to console and file with loglevels. Example:
 * 
 *   var log = new require('./log.js').Logger('filters');
 *   log.warn('no need to mention warning here its prefixed', domain);
 *
 * TODO: cool would be a sprintf implementation for logformat and loggers
 */

var fs = require('fs'),
    uri = require('url');
var func = require('./func.js');

var Logger = function(module) {
  this.module = module;

  if(!func.file_exists(Logger.options.path)) {
    fs.mkdirSync(Logger.options.path, 0750);
  }
  //this.info(' -- start logger for '+module+' -- ');
}

Logger.levels = {
  'error': 1,
  'warn': 2,
  'info': 3,
  'debug': 4
}

Logger.options = {
  console: true, // wherever the log messages may be logged to console
  stderr: true, // log messages are logged to stderr (blocking!)
  file: true, // activates file logging
  file_seperate: true, // seperate logfiles per loglevel
  syncronized: false, // using sync methods for writing to logfiles
  use_domain: true, // write seperate logfile for each domain
  path: './logs', // write logfiles in this directory
  console_level: 3, // 0: no logging 1: error 2: warn 3: info 4: debug
  file_level: 4
};

Logger.merge_options = function(new_options) {
  Logger.options = func.object_merge(Logger.options, new_options);
}

Logger.openfds = {};
Logger.close = function() {
  func.array_foreach(Logger.openfds, function(filename, fd) {
    fs.closeSync(fd);
  })
}

Logger.prototype.log = function(level, message, domain) {
  lnum = Logger.levels[level];

  // domain maybe a url?
  var logtype;
  if(domain && Logger.options.use_domain) {
    if(domain.substr(0, 7) == 'http://') {
      domain = uri.parse(domain).hostname;
    }
    
    logtype = domain + '] [' + level.toUpperCase();
  }
  else {
    logtype = level.toUpperCase();
  }
 
  // formatting of log message
  var time =  (new Date()).toLocaleString();
  message = time + ' [' + this.module + '] [' + logtype + '] '+message+'\n';

  // console logging:
  if(Logger.options.console && Logger.options.console_level >= lnum) {
    var console_stream = (Logger.options.stderr) ? process.stderr
                                               : process.stdin;
    console_stream.write(message);
  }
  
  // file logging
  if(Logger.options.file && Logger.options.file_level >= lnum) {
    var path = Logger.options.path;
    path += (path.substr(path.length-2) != '/') ? '/' : '';
    var filename = path + (domain || 'feedability');
    
    if(Logger.options.file_seperate) {
      filename += '-' + level.toLowerCase();
    }
    filename += '.log';

    if(!Logger.openfds[filename]) {
      Logger.openfds[filename] = fs.openSync(filename, 'a+', 0600);
    }
    
    if(Logger.options.syncronized) {
      fs.writeSync(Logger.openfds[filename], message, null, 'utf8');
    }
    else {
      fs.write(Logger.openfds[filename], message, null, 'utf8', function() {});
    }
  } // if file logging
}

Logger.prototype.error = function(message, domain) {
  this.log('error', message, domain);
}
Logger.prototype.warn = function(message, domain) {
  this.log('warn', message, domain);
}
Logger.prototype.info = function(message, domain) {
  this.log('info', message, domain);
}
Logger.prototype.debug = function(message, domain) {
  this.log('debug', message, domain);
}

exports.Logger = Logger;
