var uri = require('url'),
    fs = require('fs');
var func = require('./func.js'),
    cfg = require('./cfg.js');

// returns the name of the cache file for the supplied url
function filename(ext, url)
{
  var domain = uri.parse(url).hostname,
      urlhash = func.sha1(url);
  var cache_path = cfg.get('cache_path')+'/'+domain;

  if(!func.file_exists(cache_path)) {
    console.log('create domain directory: '+cache_path);
    fs.mkdirSync(cache_path, 0755);
  }

  return cache_path + '/' + urlhash + '.' + ext;
}
exports.filename = filename;
