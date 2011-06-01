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
 * Contains class for processing proxy requests.
 * 
 * @fileOverview
 */

// built in libraries
var uri = require('url'),
    util = require('util'),
    fs = require('fs');

// internal libraries
var log = new (require('./log.js').Logger)('proxy'),
    urlopen = require('./urlopen.js'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    Feed = require('./feed.js').Feed,
    ContentExtraction = require('./ce.js').ContentExtraction;

/**
 * Class for serving proxy request.
 * 
 * @param request http client request
 * @param response http server response
 * @class
 */
var ProxyRequest = function(request, response) {
  var match = null,
      parsed = uri.parse(request.url, true);
  this.url = null;
  this.request = request;
  this.response = response;
  this.settings = cfg.get('proxy');
  this.mime = 'text/html';
  this.code = 200; // per default serve 200 OK
  this.wroteHead = false;
  this.static = null; // static file serving?
  this.headers = {};
  
  // GET /http://example.com/ HTTP/1.*
  // GET http://example.com/ HTTP/1.* (real HTTP proxy)
  if(match = parsed.href.match(/^\/?(http[s]?:\/\/.*)$/)) {
    this.url = match[1];
  }
  // GET /?u=http://example.com/&...
  else if(parsed.query.u || parsed.query.url) {
    this.url = parsed.query.u || parsed.query.url;
    this.settings = func.object_merge(this.settings, parsed.query);
    log.debug('merged proxy settings: '+util.inspect(this.settings));
  }
  // GET /index.html (static file serving)
  if(match = parsed.href.match(/^\/(.*)?$/)) {
    var static_file = match[1] || 'index.html';
    
    if(static_file.indexOf('..') == -1 && func.file_exists('./static/'+static_file)) {
      this.static = static_file;
    }
  }
  
  log.info('CLIENT REQUEST: '+request.socket.remoteAddress+':'+request.socket.remotePort+' - '+(this.url||this.static));
  if(this.url) {
    this.parsed = uri.parse(this.url);
  }
}

/**
 * Write content to server response. if not already this writes
 * the http header too.
 * 
 * @param content the http body content to write
 * @param headers additional headers to write (on first write)
 */
ProxyRequest.prototype.write = function(content, headers) {
  if(!this.wroteHead) {
    this.response.writeHead(this.code,
      func.object_merge(
        {
          'Server': this.settings.banner,
          'Content-Type': this.mime+'; charset=utf-8',
          'X-Feed-Request': this.xresp || 'unavailable'
        }, 
        this.headers
      )
    );
    this.wroteHead = true;
  }

  this.response.write(content);
}

/**
 * Finishes the writing of data to the server response.
 */
ProxyRequest.prototype.end = function() {
  this.response.end();
}

/**
 * Loads a static file from disk, replaces variables within and
 * writes the contents to the server response.
 * 
 * @param filename name of the static file (within the static folder)
 * @param vars variables to replace within the static file (replace {key})
 */
ProxyRequest.prototype.renderStatic = function(filename, vars) {
  log.info('render static file: '+filename)
  var content = fs.readFileSync('./static/' + filename, 'utf-8');
  
  // detect mime type based on extension (currently only supported: html, css)
  var ext = filename.substr(filename.lastIndexOf('.')+1);
  switch(ext) {
    case 'html':
      this.mime = 'text/html';
      break;
    case 'css':
      this.mime = 'text/css';
  }
  
  // replace template variables in html documents:
  if(this.mime == 'text/html') {
    vars = vars || {};
    vars = func.object_merge(vars, {host: this.request.headers.host});
    
    for(var key in vars) {
      content = content.replace(new RegExp('{'+key+'}', 'g'), vars[key]);
    }
  }
  
  this.write(content);
  this.end();
}

/**
 * Serve an error message to the client.
 * 
 * @param message the error message
 * @param code optional http response 
 *                 code (default: 500 Internal Server Error)
 */
ProxyRequest.prototype.error = function(message, code) {
  this.code = code || 500; // Default: Internal Server Error
  this.renderStatic('error.html', {message: message});
}

/**
 * Checks if the user is authenticated and if the settings require
 * an authentication.
 * 
 * @returns true in case of successfull auth or no authentication 
 * is required
 */
ProxyRequest.prototype.authenticated = function() {
  if(this.settings.use_auth) {
          log.debug('start');
    var auth_header = this.request.headers['authorization'],
        auth = null;

    if(!auth_header || auth_header.indexOf('Basic ') == -1) {
      log.error('client sent invalid authorization request', this.url);
    }
    else {
      auth = func.base64_decode(auth_header.substr(6));
    }

    if(auth == this.settings.auth) {
      log.info('client supplied correct authentication');
      return true;
    }
    else {
      log.info('client needs to authenticate');
      this.headers['WWW-Authenticate'] = 'Basic realm="Feedability"';
      this.error('This feedability server needs authentication', 401);
      return false;
    }
  }
  return true;
}

/**
 * Just renders the static page, default template variables are
 * replaced.
 * @see renderStatic
 */
ProxyRequest.prototype.processStaticRequest = function() {
  this.renderStatic(this.static);
}

/**
 * Process external proxy request, for feed or other external page.
 * This tries to extract the main content from the received pages.
 */
ProxyRequest.prototype.processProxyRequest = function() {
  var proxy = this,
      start_request = func.ms();

  // process the proxy request:
  urlopen.open(proxy.url, function(error, url_content, url_response) {
    if(error) {
      proxy.error(error);
      return;
    }
    // the basic mime type detection code is in the urlopen module
    proxy.mime = url_response.type.mime;
    
    proxy.xresp = (func.ms() - start_request)+'ms,'+url_response.data_length+'/'+url_content.length;
    
    // process based on mime type
    
    // feed mime types (the mime types are correctly detected by looking
    // into the content (this happens in the urlopen module))
    if(proxy.mime == 'application/rss+xml' || 
       proxy.mime == 'application/atom+xml') {

      var feed = new Feed(url_content, proxy.url, proxy.mime);
      feed.parse(function(error){ 
        if(error) {
          proxy.error('feed parse error: '+error);
          return;
        }

        // write the head section of the feed
        proxy.write(feed.getHeader());
        proxy.write('<!-- X-Feed-Response: '+proxy.xresp+' -->\n');
        if(proxy.settings.preserve_order) {
          proxy.write('<!-- PRESERVE_ORDER -->\n');
        }
        proxy.write(feed.getOuterPre());

        // Function queries finished extracted article items, finished
        // articles are written to the response or queried for later
        // if the preserve_order option is turned on. (the preserve_order
        // option can be selected by including the preserve_order
        // argument in the url.
        var send_items = 0;
        var item_queue = [];
        function send_finished(item, i) {
          var item_content = feed.createItemContents(item);
          
          if(proxy.settings.preserve_order) {
            // query at the correct position (original position/order)
            item_queue[i] = item_content;
          }
          else {
            // just append the finished item as the next in queue
            item_queue.push(item_content);
          }
          
          // iterate over queue, write conjoined items to response
          for(var n = send_items; n < feed.getItems().length; n++) {
            if(item_queue[n]) {
              proxy.write(item_queue[n]);
              delete item_queue[n];
              send_items++;
            }
            else {
              break; // makes sure not to skip any items
            }
          }
          
          // write feed footer and end response writing
          if(send_items >= feed.getItems().length) {
            // write tail section of the feed
            proxy.write(feed.getOuterPost());
            proxy.write('\n');
            proxy.end();
          }
        }

        
        // extract each feed item
        var ce = new ContentExtraction(),
            items = feed.getItems();

        for(var i = 0; i < items.length; ++i) { (function() {
          var index = i, // important for order preserving
              item = items[i];

          try {
            ce.extractByUrl(item.url, function(error, item_content, item_url) {
              if(error) {
                log.error('can not extract: '+error, item_url);
                item.content = error;
              }
              else {
                log.info('content extracted: '+item_content.length, item_url);
                item.content = item_content;
              }
              send_finished(item, index);
            }); // end extractByUrl
          } catch(exception) {
            log.error('error extractByUrl: '+exception, item.url);
            item.content = 'error extractByUrl: '+exception;
            send_finished(item, index);
          }

        })();} // end each item
        

      }); // end of feed parse method callback

    }
    
    else if (proxy.mime.indexOf('html') != -1) {
      // instantiate ce with the single settings (default is ce)
      var ce = new ContentExtraction(cfg.get('ce_single'));
      ce.extractByUrl(proxy.url, function(error, content, url, title) {
        if(error) {
          error = 'unable to extract content from url' + error;
          log.error(error, url);
          proxy.error(error);
        }
        else {
          log.info('content extracted: '+content.length, url);
          proxy.renderStatic('single.html', {content: content, title: title || 'unkown title'});
        }
      });
    }
    
    else {
      proxy.error('Unable to process content other then http, ' + 
                  'rss or atom feeds');

    }
  });
}

/**
 * Process the request, check for authentication and serve
 * proxy request or static request.
 */
ProxyRequest.prototype.process = function() {
  // all pages need authentication, the stylesheet is used
  // to style the error message (-.-)
  if(this.static != 'style.css' && !this.authenticated()) {
    return;
  }

  // the request is processed in the constructor, this processes
  // the proxy request (request for another external page or feed)
  if(this.url && (this.parsed.protocol == 'http:' || 
                  this.parsed.protocol == 'https:') && this.host != '') {

    this.processProxyRequest();
  }

  // static page found (all files under /static can be served this way
  // the / url is served as a static request to /static/index.html
  else if(this.static) {
    this.processStaticRequest();
  }

  // no url or static file requested
  else {
    this.error('unable to process request', 404);
  }
}

exports.ProxyRequest = ProxyRequest;
