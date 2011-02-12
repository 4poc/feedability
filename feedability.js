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

// built in libraries
var sys = require('sys'), 
    fs = require('fs'),
    events = require('events'),
    jsdom = require('jsdom'),
    http = require('http'),
    util = require('util'),
    jsdom = require('jsdom'),
    urllib = require('url'),
    crypto = require('crypto');

// external libraries
var expat = require('node-expat'),
    readability = require('readability');

// internal libraries
var tpl = require('./lib/tpl.js'),
    utils2 = require('./lib/utils2.js'),
    urlopen = require('./lib/urlopen.js'),
    feed = require('./lib/feed.js'),
    crawler = require('./lib/crawler.js');

// some variables used for the http server
var url_pattern = /^\/(http:\/\/.*)$/;
var bind = utils2.settings['http_server']['bind'];
var port = utils2.settings['http_server']['port'];

// create the http server with the feed proxy
http.createServer(function (client_request, client_response) {
  var request_url = client_request.url;
  console.log('');

  var match = request_url.match(url_pattern);
  if(match) {
    var feed_url = match[1];
    console.log('--[ feed url: '+feed_url);
    
    // fetch and process feed
    feed.parse(feed_url, {
      // the feed is successfully retreived and parsed
      finished: function(content, articles) {

        // next crawl each article url in the feed:
        var crawl = new crawler.Crawler(articles);
        crawl.fetch({
          finished: function(contents) {
            // TODO: make this part within another lib
            utils2.foreach(contents, function(article_url) {
              if (contents[article_url]) {
                console.log('start readability for '+article_url+' '+contents[article_url].length);
                
                var cache_file = './cache/'+utils2.sha1(article_url)+'.rdby';
                
                var article_content = null;
                
                if(utils2.filestats(cache_file) !== null) {
                  console.log('--[ load cache file: '+cache_file);
                  article_content = fs.readFileSync(cache_file).toString();

                }
                else { // no cache...
                  readability.parse(contents[article_url], article_url, function(info) {
                    fs.writeFileSync(cache_file, info.content, encoding='utf8')
                    article_content = info.content;
                  });
                }
                content = content.replace('&replaceurl:'+utils2.sha1(article_url)+';', article_content);
                        
              } else {
                console.log('ERROR: url '+article_url+' not read!');
              }
            });
            
      
            console.log('--[ finished readability.');
            client_response.writeHead(200, {'Content-Type': 'text/html'});
            client_response.end(content);
          },
          error: function(message) {
            tpl.error(client_response, message);
          }
        });
      },
      
      // and error occured during the retreival or parsing of the feed
      error: function(message) {
        tpl.error(client_response, message);
      }
    });
  }
  else {
    var page = new tpl.Template('./html/index.html');
    page.assign('host', bind);
    page.assign('port', port);
    page.render(client_response);
  }
}).listen(port, bind);
console.log('--[ http server started http://'+bind+':'+port+'/');

