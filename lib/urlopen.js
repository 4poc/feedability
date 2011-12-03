/**
 * Feedability: Node.js Feed Proxy With Readability
 * Copyright (c) 2011, Matthias -apoc- Hecker <http://apoc.cc/>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Methods for requesting HTTP pages, supports the GET method, gzip
 * compression, automatic charset recoding to UTF-8 (using iconv),
 * caching using Etag or Last-modified headers, HTTP redirection, etc.
 * 
 * @fileOverview
 */

// built in libraries
var http = require('http'),
    https = require('https'),
    uri = require('url'),
    util = require('util'),
    zlib = require('zlib');

// internal libraries
var log = new (require('./log.js').Logger)('urlopen'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    Cache = require('./cache.js').Cache,
    cookie = require('./cookie.js');

// external libraries
var Iconv = require('iconv').Iconv;


/**
 * Detect Content-Type on various factors
 * 
 * In most cases the web server already returns a content-type,
 * but that value may not be accurate. This method detects the
 * xml formats atom and rss and the xml and html charset 
 * attributes. The returned object looks like:
 * <pre>
 * {
 *   header: "text/html; charset=ISO-8859-4",
 *   mime: "text/html",
 *   charset: "ISO-8859-4",
 *   binary: false // assume binary content
 * }
 * </pre>
 * 
 * @param buffer or string with file contents
 * @param headers of request may include content-type
 * @return object with content type string, mime and charset
 */
function detectContentType(content, content_type) {
  var mime = null, charset = null, binary = false;

  // parse the supplied content_type, it may include mime and charset
  if(content_type) {
    var match = content_type.match(/^([^;]+)[;]?[ ]?(charset=(.*))?$/i);
    if(match) {
      mime = match[1] || null;
      charset = match[3] || null;
      mime = (mime) ? mime.toLowerCase() : null;
      charset = (charset) ? charset.toLowerCase() : null;
    }
  }
  log.debug('content type: '+content_type+' ('+mime+')('+charset+')');
  
  // detect the mime(media type) and if binary content(based on mime)
  if(mime) {
    if(mime.match(/(application|xml|text|html|plain)/)) {
      // detect the feed type by searching for rss or atom root elements:
      if(mime != 'application/rss+xml' && mime != 'application/atom+xml') {
        content = (typeof content != 'string') ? content.toString() : content;
        if(content.indexOf('<rss') != -1 || content.indexOf('<rdf') != -1) {
          mime = 'application/rss+xml';
        }
        else if(content.indexOf('<feed') != -1) {
          mime = 'application/atom+xml';
        }
      } // detect feed type
    } // match for non-binary mime types
    else {
      binary = true;
    }
  }// if no mime type specified assume binary content
  else {
    log.warn('mime type not found, assume binary content');
  }

  // detect the original charset of xml and html documents
  if((!charset || cfg.get('urlopen').ignore_http_charset) && !binary) {
    content = (typeof content != 'string') ? content.toString() : content;

    var match = content.match(/<\?xml[^>]+encoding="([^"]+)"[^>]*\?>/i);
    match = match ? match : content.match(/<meta[^>]+charset=([^'|^"]+)['|"][^>]*>/i);
    match = match ? match : content.match(/<meta[^>]+charset=['|"]([^'|^"]+)['|"][^>]*>/i);

    if(match) {
      log.debug('found charset declaration on content-level: '+match[1]);
      charset = match[1];
    }
  }

  // force lower case (content-type is case-insensitive but this makes it easier)
  // set fallbacks for empty values
  mime = (mime) ? mime.toLowerCase() : 'text/plain';
  charset = (charset) ? charset.toLowerCase() : 'utf-8';

  log.debug('detected mime type: '+mime+' detected charset: '+charset);
  
  return {header: mime+'; charset='+charset,
          mime: mime, charset: charset, binary: binary};
}
exports.detectContentType = detectContentType;




exports.open = function(url, settings, callback) {
  if(typeof settings === 'function') {
    callback = settings;
    settings = {};
  }

  log.debug(util.inspect(settings));
  // settings can easily overwrite all urlopen settings
  settings = func.object_merge(cfg.get('urlopen'), settings);
  log.debug(util.inspect(settings));
  
  // add accept-encoding for supported gzip or deflate compression
  settings.headers['Accept-Encoding'] = 'gzip,deflate,none';
  
  if(settings.keep_alive) {
    log.info('using keep-alive connection', url);
    settings.headers['Connection'] = 'Keep-Alive';
  }
  
  if(settings.cache === true) {
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

      switch (response.headers['content-encoding']) {
        case 'gzip':
          decompressor = zlib.createGunzip();
          break;
        case 'deflate':
          decompressor = zlib.createInflate();
          break;
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
        response.type = detectContentType(content, response.headers['content-type']);
        
        // convert the character encoding of the buffer
        if(settings.convert_charset && Iconv && response.type.charset != 'utf-8') {
          log.debug('[iconv] convert charset('+response.type.charset+') to utf-8');
          var iconv = new Iconv(response.type.charset, 'UTF-8');
          try {
            var new_content = iconv.convert(content);
            content = new_content;
          }
          catch(e) {
            log.error('unable to convert charset: '+e);
          }
        }
        // convert the raw binary buffer into utf-8 string
        content = content.toString('utf8');
        response.data_length = content.length;
        
        // if the content charset changed, make sure to change
        // content-type in document:
        if(response.type.charset != 'utf-8' && !response.binary) {
          log.debug('replace original charset in document with utf-8');
          content = content.replace(/(charset|encoding)=(['|"])?([^'|^"]+)(['|"])/gi, '$1=$2utf-8$4');
        }

        // caching
        if(response_cache && data_cache) {
          response_cache.write({
            data_length: response.data_length,
            url: response.url,
            headers: response.headers,
            type: response.type
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
          decompressor.end();
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

  // set cookie header(s) if activated
  if(cookie.loaded) {
    var cookie_header = cookie.get(url);
    if(cookie_header) {
      options.headers['Cookie'] = cookie_header;
    }
  }

  try {
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
  }
  catch(exception) {
    var error = 'http request exception: '+exception;
    callback(error);
  }

  request.end();
  request.on('error', callback);
}



