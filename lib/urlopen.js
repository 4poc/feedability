var log = new (require('./log.js').Logger)('urlopen');

// built in libraries
var http = require('http'),
    https = require('https'),
    uri = require('url'),
    util = require('util');

// internal libraries
var func = require('./func.js'),
    cfg = require('./cfg.js'),
    Cache = require('./cache.js').Cache;

// require compress as an optional feature
var compress = null;
try {
  var compress = require('compress');
} 
catch(e) {
  log.warn('optional compress module not found (no urlopen gzip support)');
}

// require compress as an "optional" feature
var Iconv = null;
try {
  var Iconv = require('iconv').Iconv;
} 
catch(e) {
  log.warn('optional iconv module not found (no urlopen charset encoding)');
}

exports.open = function(url, settings, callback) {
  if(typeof settings === 'function') {
    callback = settings;
    settings = {};
  }

  // settings can easily overwrite all urlopen settings
  settings = func.object_merge(cfg.get('urlopen'), settings);
  
  // add accept-encoding if compression is available
  if(compress) {
    settings.headers['Accept-Encoding'] = 'gzip,none';
  }
  
  if(settings.keep_alive) {
    log.info('using keep-alive connection', url);
    settings.headers['Connection'] = 'Keep-Alive';
  }
  
  if(settings.cache) {
    var response_cache = new Cache(url, 'json');
    var data_cache = new Cache(url, 'raw');
    
    // use the cache files without server interaction, if force_cache true
    if(response_cache.exists() && data_cache.exists() && settings.force_cache) {
      log.debug('use url cache, force_cache is set: '+url, url);
      return callback(null, data_cache.read(), response_cache.read());
    }
    
    // use Last-Modified and Etag caching if response cache is present
    if(response_cache.exists()) {
      var last_modified = response_cache.read().headers['last-modified'];
      if(last_modified) {
        log.debug('caching send last-modified: '+last_modified);
        settings.headers['If-Modified-Since'] = last_modified;
      }
      
      var etag = response_cache.read().headers['etag'];
      if(etag) {
        log.debug('caching send etag: '+etag);
        settings.headers['If-None-Match'] = etag;
      }
    }
  }
  
  // handle to response:
  var handle_response = function(response) {
    // i expand the response object with some additional info for later use
    response.url = url;

    // 301 Moved Permanently / 302 Found / 303 See Other / 305 Use Proxy
    if((response.statusCode >= 301 && response.statusCode <= 303) || response.statusCode == 305) {
      var redirect_url = response.headers['location'];
      log.debug('url redirection: '+redirect_url, url);
      exports.open(redirect_url, settings, callback);
    }
    else if(response.statusCode == 304) { // 304 Not Modified
      if(!response_cache.exists() || !data_cache.exists()) {
        var error = 'received not modified, but no cache availible';
        log.error(error, url);
        return callback(error);
      }
      log.debug('use url cache, retreived 304');
      return callback(null, data_cache.read(), response_cache.read());
    }
    else if(response.statusCode == 200) { // 200 OK
      var content = null, decompressor = null;
      if(response.headers['content-encoding'] == 'gzip') {
        decompressor = new compress.GunzipStream()
      }
      
      var content_chunk = function(chunk) {
        // create a buffer for each new chunk
        if(content === null) {
          content = chunk;
        }
        else {
          var new_buffer = new Buffer(content.length + chunk.length);
          content.copy(new_buffer);
          chunk.copy(new_buffer, content.length);
          delete content;
          delete chunk;
          content = new_buffer;
        }
      }
      
      var content_end = function() {
        // convert the character encoding of the buffer
        if(settings.convert_charset && Iconv) {
          var from_charset = settings.overwrite_charset || null,
              ctype = response.headers['content-type'], ctype_s = null;
          log.debug('content-type: '+response.headers['content-type']);
          
          if(ctype && (ctype_s = ctype.indexOf('charset=')) != -1) {
            from_charset = ctype.substr(ctype_s+8);
          }


          // 'guess' the correct encoding on content level
          if(!from_charset && settings.use_content_charset) {
            var content_string = content.toString('utf8');
            var match = content_string.match(/<\?xml[^>]+encoding="([^"]+)"[^>]*\?>/i);
            match = match ? match : content_string.match(/<meta[^>]+charset=([^'|^"]+)['|"][^>]*>/i);
            match = match ? match : content_string.match(/<meta[^>]+charset=['|"]([^'|^"]+)['|"][^>]>/i);

            if(match) {
              log.debug('use content character encoding: '+match[1]);
              from_charset = match[1];
            }
          }
          
          from_charset = from_charset ? from_charset.toUpperCase() : null;
          if(from_charset && from_charset != 'UTF-8' && from_charset != 'UTF8') {
            log.debug('[iconv] convert from charset: '+from_charset);
            var iconv = new Iconv(from_charset, 'UTF-8');
            content = iconv.convert(content);
          }
        }
        // convert the raw binary buffer into utf-8 string
        content = content.toString('utf8');
        response.data_length = content.length;

        // caching
        if(response_cache && data_cache) {
          response_cache.write({
            data_length: response.data_length,
            url: response.url,
            headers: response.headers
            // ... ?
          });
          data_cache.write(content);
        }

        log.debug('received content, '+response.data_length+' B', url);
        log.debug('content type is '+typeof content);
        callback(null, content, response);
      }
      
      // decompressor events:
      if(decompressor) {
        decompressor.addListener('data', function(chunk) {
          content_chunk(chunk);
        });
        decompressor.addListener('end', function(chunk) {
          content_end();
        });
      }

      response.on('error', callback);
      response.on('data', function(chunk) {
        if(decompressor) {
          decompressor.write(chunk);
        }
        else {
          content_chunk(chunk);
        }
      });
      response.on('end', function() {
        
        if(decompressor) {
          decompressor.close();
        }
        else {
          content_end();
        }
      });
    }
    else {
      callback('response error: ' + response.statusCode + 
        ' - unable to fetch <a href="'+url+'">article</a> - ' + 
        'sent url headers: ' + util.inspect(settings.headers));
    }
  }
  
  // parse url, create options and perform http or https request
  var parsed_url = uri.parse(url);
  var options = {
    host: parsed_url.host,
    port: parsed_url.port || 80,
    path: parsed_url.pathname + (parsed_url.search || ''),
    method: 'GET',
    headers: settings.headers
  };
  if(parsed_url.protocol == 'http:') {
    log.debug('http request url: '+url, url);
    var request = http.request(options, handle_response);
  }
  else if(parsed_url.protocol == 'https:') {
    log.debug('https request url: '+url, url);
    var request = https.request(options, handle_response);
  }
  else {
    var error = 'unsupported protocol scheme: '+parsed_url.protocol;
    log.error(error);
    callback(error);
    return;
  }
  request.end();
  request.on('error', callback);
}



