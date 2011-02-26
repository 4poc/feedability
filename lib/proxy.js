var log = new (require('./log.js').Logger)('proxy');

var uri = require('url'),
    util = require('util'),
    fs = require('fs');
    
var urlopen = require('./urlopen.js'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    Feed = require('./feed.js').Feed,
    ContentExtraction = require('./ce.js').ContentExtraction;

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

ProxyRequest.prototype.end = function() {
  this.response.end();
}

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
      content = content.replace('{'+key+'}', vars[key]);
    }
  }
  
  this.write(content);
  this.end();
}

ProxyRequest.prototype.error = function(message, code) {
  this.code = code || 500; // Default: Internal Server Error
  this.renderStatic('error.html', {message: message});
}

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

ProxyRequest.prototype.processStaticRequest = function() {
  this.renderStatic(this.static);
}

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
    if(proxy.mime == 'application/rss+xml' || proxy.mime == 'application/atom+xml') {
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

        // execute after finishing an item
        var send_items = 0;
        var item_queue = [];
        function send_finished(item, i) {
          var item_content = feed.createItemContents(item);
          
          if(proxy.settings.preserve_order) {
            item_queue[i] = item_content;
          }
          else {
            // just append the finished item as the next in queue
            item_queue.push(item_content);
          }
          
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

        for(var i in items) { (function() {
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
            log.error('error extractByUrl: '+exception, item_url);
            item.content = 'error extractByUrl: '+exception;
            send_finished(item, index);
          }

        })();} // end each item
        

      }); // end of feed parse method callback

    }
    else {
      proxy.error('Unable to process content other then rss or atom feeds');
    }
  });
}

ProxyRequest.prototype.process = function() {
  if(this.static != 'style.css' && !this.authenticated()) {
    return;
  }

  if(this.url && (this.parsed.protocol == 'http:' || this.parsed.protocol == 'https:') && this.host != '') {
    this.processProxyRequest();
  }
  else if(this.static) {
    this.processStaticRequest();
  }
  else {
    this.error('unable to process request');
  }
}

exports.ProxyRequest = ProxyRequest;
