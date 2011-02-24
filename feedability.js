/**
 * Feedability: NodeJS Feed Proxy With Readability
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
console.log('Starting Feedability: NodeJS Feed Proxy With Readability\n');

// built in libraries
var fs = require('fs'),
    http = require('http'),
    util = require('util');

// internal libraries
var cfg = require('./lib/cfg.js'),
    func = require('./lib/func.js'),
    urlopen = require('./lib/urlopen.js'),
    Feed = require('./lib/feed.js').Feed,
    Template = require('./lib/tpl.js').Template,
    ContentExtraction = require('./lib/ce.js').ContentExtraction;

// create local logging object
var log = new (require('./lib/log.js').Logger)('core');

// some variables used for the http server
var url_pattern = /^\/(http:\/\/.*)|\?[^=]+=(http:\/\/.*)$/;
var bind = cfg.get('server')['bind'];
var port = cfg.get('server')['port'];

// create the http server with the feed proxy
http.createServer(function (cli_req, cli_resp) {
  var req_url_match = null,
      resp_time = func.ms();

  // serve the client the default index page
  if(!(req_url_match = unescape(cli_req.url).match(url_pattern))) {
    var page = new Template('./html/index.html');
    page.assign('host', cli_req.headers['host']);
    page.render(cli_resp);
    return;
  }
  var feed_url = req_url_match[1] || req_url_match[2];
  
  // fetch feed:
  urlopen.open(feed_url, function(error, feed_content, feed_resp) {
    if(error) {
      Template.error(cli_resp, error);
      return;
    }

    resp_time = func.ms() - resp_time;
    var feed = new Feed(feed_content, feed_url);
    feed.parse(function(error, feed) {
      if(error) {
        Template.error(cli_resp, error);
        return;
      }
    
      var x_feed_resp = resp_time+'ms,'+feed_resp.data_length+'/'+feed_content.length;
      log.debug('feed response info: '+x_feed_resp)

      // write the server headers
      cli_resp.writeHead(200, {
        'Content-Type': feed.mime+'; charset=utf-8',
        'Server': cfg.get('server')['banner'],
        'X-Feed-Response': x_feed_resp
      });
      
      // write the head section of the feed
      cli_resp.write(feed.getHeader());
      cli_resp.write('<!-- X-Feed-Response: '+x_feed_resp+' -->\n');
      cli_resp.write(feed.getOuterPre());

      // execute after finishing an item
      var preserve_order = cfg.get('server').preserve_order; // entity_encode
      var send_items = 0; // feed.getItems().length;
      var item_queue = [];
      function send_finished(item, i) {
        var item_content = feed.createItem(item);
        
        if(preserve_order) {
          item_queue[i] = item_content;
        }
        else {
          // just append the finished item as the next in queue
          item_queue.push(item_content);
        }
        
        for(var n = send_items; n < feed.getItems().length; n++) {
          if(item_queue[n]) {
            cli_resp.write(item_queue[n]);
            delete item_queue[n];
            send_items++;
          }
          else {
            break; // makes sure not to skip any items
          }
        }
        
        if(send_items >= feed.getItems().length) {
          // write tail section of the feed
          cli_resp.write(feed.getOuterPost());
          cli_resp.write('\n');
          cli_resp.end();
        }
      }
      
      // extract each feed item
      var ce = new ContentExtraction();
      feed.eachItem(function(item, i) {
        (function(){
          var s_item = item,
              s_i = i;

          ce.extractByUrl(s_item.url, function(error, item_content, item_url) {
            if(error) {
              log.error('can not extract: '+error);
              item.content = error;
            }
            else {
              log.info('content extracted: '+item_content.length, item_url);
              item.content = item_content;
            }
            send_finished(s_item, s_i);
          });
        })();
      }); // each feed item
    }); // feed parse
  }); // urlopen
}).listen(port, bind);
console.log('http server listening on '+bind+' port '+port);
console.log('open a browser and try: http://127.0.0.1:'+port+'/\n');

