var urllib = require('url'),
    http = require('http');
var utils2 = require('./utils2.js');

var client_headers = utils2.settings['http_client']['headers'];

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
 */
function fetch(url, callbacks)
{
  if(!url) {
    callbacks.error('no url');
    return;
  }
  console.log('urlopen fetch: '+url);
  var p = urllib.parse(url, true);
  var client = http.createClient(p.port || 80, p.hostname);
  client.on('error', callbacks.error);
  
  var headers = utils2.extend(client_headers, {'Host': p.hostname});
  var request = client.request('GET', p.pathname + (p.search || ''), headers);
  request.on('error', callbacks.error);
  request.on('response', function(response) {
    console.log('received response code: '+response.statusCode);
    
    if(response.statusCode == 301 || response.statusCode == 302) {
      var redirect_url = response.headers['location'];
      console.log('url redirection');
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
        console.log('urlopen received '+data.length);
        callbacks.data(data);
      });
    }
    else {
      callbacks.error('unable to handle response code '+response.statusCode);
    }
  });
  request.end();
}
exports.fetch = fetch;
