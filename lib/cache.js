var log = new (require('./log.js').Logger)('cache');
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

