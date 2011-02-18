var log = new (require('./log.js').Logger)('urlopen');

var uri = require('url'),
    http = require('http'),
    util = require('util');
var func = require('./func.js'),
    cfg = require('./cfg.js'),
    cache = require('./cache.js');

var client_headers = cfg.get('http_client')['headers'];

/**
 * Fetches an URL.
 * 
 * callbacks must include data and error. Example:
 * urlopen.fetch('http://example.com/', {
 *   data: function(data) {
 *   },
 *   error: function(message) {
 *   }
 * });
 * 
 * TODO: support for https, etag caching etc./ include port in Host header?
 */
function fetch(url, callbacks)
{
  if(!url) {
    callbacks.error('no url');
    return;
  }
  log.info('fetch url: '+url, url);
  var p = uri.parse(url, true);
  var client = http.createClient(p.port || 80, p.hostname);
  client.on('error', callbacks.error);
  
  var headers = func.object_merge(client_headers, {'Host': p.hostname});
  var request = client.request('GET', p.pathname + (p.search || ''), headers);
  request.on('error', callbacks.error);
  request.on('response', function(response) {
    log.debug('received response code: '+response.statusCode, url);
    
    if(response.statusCode >= 301 && response.statusCode <= 303) {
      var redirect_url = response.headers['location'];
      log.debug('url redirection: '+redirect_url, url);
      fetch(redirect_url, callbacks);
    }
    else if(response.statusCode == 200) {
      var data = null;
      var content_type = response.headers['content-type'].toLowerCase();
      if(content_type.indexOf('utf-8') == -1) {
        response.setEncoding("binary");
      }
      response.on('error', callbacks.error);
      response.on('data', function(chunk) {
        if(data == null) {
          data = chunk;
        }
        else {
          data += chunk;
        }
      });
      response.on('end', function() {
        log.debug('received page, length: '+data.length, url);
        callbacks.data(data, url);
      });
    }
    else {
      callbacks.error('Server Response Error: ' + response.statusCode +
        ' -- Feedability was unable to make an request for an ' +
        '<a href="'+url+'">article</a>. ' + 
        'URLopen sent the following HTTP headers: '+util.inspect(headers));
    }
  });
  request.end();
}
exports.fetch = fetch;
