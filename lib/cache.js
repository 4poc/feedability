var log = new (require('./log.js').Logger)('cache');

/*
var uri = require('url'),
    fs = require('fs');
var func = require('./func.js'),
    cfg = require('./cfg.js');

// returns the name of the cache file for the supplied url
function filename(ext, url)
{
  var domain = uri.parse(url).hostname,
      urlhash = func.sha1(url);
  var cache_path = cfg.get('cache')['path']+'/'+domain;

  if(!func.file_exists(cache_path)) {
    log.info('create non-existing domain directory', domain);
    fs.mkdirSync(cache_path, 0755);
  }

  return cache_path + '/' + urlhash + '.' + ext;
}
exports.filename = filename;

// make sure the caching directory exists, if not create it (sync)
exports.create_path = function() {
  var cache_path = cfg.get('cache')['path'];
  if(!func.file_exists(cache_path)) {
    log.info('create cache directory: '+cache_path);
    fs.mkdirSync(cache_path, 0755);
  }
};
*/




var fs = require('fs'),
    uri = require('url');

var func = require('./func.js'),
    cfg = require('./cfg.js');

var Cache = function(url, extension) {
  this.content = null;
  this.url = url;
  this.extension = extension;
  this.domain = uri.parse(url).hostname;
  
  var cache_path = cfg.get('cache')['path'];
  // make sure settings cache path exists:
  if(!func.file_exists(cache_path)) {
    log.info('create cache directory: '+cache_path);
    fs.mkdirSync(cache_path, 0755);
  }
  // make sure domain cache path exists:
  cache_path += '/' + this.domain;
  if(!func.file_exists(cache_path)) {
    log.info('create non-existing domain directory', this.domain);
    fs.mkdirSync(cache_path, 0755);
  }
  this.filename = cache_path + '/' + func.sha1(url) + '.' + extension;

  log.debug('initialize cache file: '+this.filename);
}

Cache.prototype.exists = function() {
  return func.file_exists(this.filename);
}

Cache.prototype.read = function() {
  if(this.content) {
    return this.content;
  }
  
  log.debug('read cache file: '+this.filename, this.url);
  var content = fs.readFileSync(this.filename, 'utf-8');
  if(this.extension == 'json') {
    content = JSON.parse(content);
  }
  this.content = content;
  
  log.debug('read content type is '+typeof content);
  return content;
}

Cache.prototype.write = function(content) {
  if(!content || (typeof content == 'string' && content == '')) {
    log.warn('ignoring empty content', this.url);
    return;
  }
  this.content = content;
  log.debug('write cache content ('+content.length+') file: '+this.filename, this.url);
  if(this.extension == 'json') {
    content = JSON.stringify(content);
  }
  log.debug('write content type is '+typeof content);
  fs.writeFileSync(this.filename, content);
}

exports.Cache = Cache;

  
  
  
  
  
  
  
  
  
/*







var cache = Cache(url, 'json');

if(cache.exists()) {
  var content = cache.read();
}
else {
  // normal retreival ....
  var content = ...
  
  
  cache.write(content);
}



*/
