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
    http = require('http');

// external libraries
var readability = require('readability');

// internal libraries
var tpl = require('./lib/tpl.js'),
    func = require('./lib/func.js'),
    cfg = require('./lib/cfg.js'),
    cache = require('./lib/cache.js'),
    urlopen = require('./lib/urlopen.js'),
    feed = require('./lib/feed.js'),
    crawler = require('./lib/crawler.js'),
    filter = require('./lib/filter.js');

console.log('use jquery url: '+cfg.get('filter')['jquery_url']);
    
var cache_path = cfg.get('cache')['path'];

if(!func.file_exists(cache_path)) {
  console.log('create cache directory: '+cache_path);
  fs.mkdirSync(cache_path, 0755);
}
    
// some variables used for the http server
var url_pattern = /^\/(http:\/\/.*)$/;
var bind = cfg.get('http_server')['bind'];
var port = cfg.get('http_server')['port'];

// create the http server with the feed proxy
http.createServer(function (client_request, client_response) {
  var host = client_request.headers['host'];
  var request_url = client_request.url;

  var url_match = request_url.match(url_pattern);
  if(url_match) {
    var feed_url = url_match[1];
    console.log('processing new feed url: '+feed_url);
    
    // fetch and process feed
    feed.parse(feed_url, {
      // the feed is successfully retreived and parsed
      finished: function(feedxml, feedxmlmime, articles) {

        // next crawl each article url in the feed:
        var crawl = new crawler.Crawler(articles);
        crawl.fetch({
          // the articles include a structure with url, orig_url, data, etc.
          finished: function(articles) {
            var article_urls = func.array_keys(articles);
            for(var i = 0; i < article_urls.length; i++) {
              var article_url = article_urls[i];
              var article_data = articles[article_url].data;
              if(!article_data || article_data.length <= 0) {
                console.log('[WARNING] article not retreived: '+article_url);
                continue;
              }
              console.log('extract using readability for '+article_url+
                          ' ('+article_data.length+')');
              
              var cache_file = cache.filename('rdby', article_url);
              var article_text = null; // the extracted article text
              // check for readability cache:
              if(func.file_exists(cache_file)) {
                console.log('using readability cache file: '+cache_file);
                article_text = fs.readFileSync(cache_file).toString();
              }
              // use readability to extract the article text
              else {
                try {
                readability.parse(article_data.toString(), article_url, function(info) {
                  console.log('write readability cache file: '+cache_file);
                  
                  // replace relative urls with absolute ones:
                  info.content = func.html_rel2abs(info.content, articles[article_url].domain);
                  // it would be nice to do this directly in the dom, @TODO

                  fs.writeFile(cache_file, info.content, function(error) {
                    if(error) {
                      console.log('[ERROR] unable to write readability cache file: '+error);
                    }
                  });
                  
                  article_text = info.content;
                });
                }
                catch(e) {
                  console.log(e);
                }
              }
              
              // apply the extracted append and prepend rules:
              if(articles[article_url].prepend != null) {
                console.log('rule based prepend: '+articles[article_url].prepend.length);
                article_text = articles[article_url].prepend + article_text;
              }
              if(articles[article_url].append != null) {
                console.log('rule based append: '+articles[article_url].append.length);
                article_text += articles[article_url].append;
              }
              
              // insert article text in feed:
              var replace_entity = '&replaceurl:'+func.sha1(article_url)+';';
              article_text = article_text.replace(/\x08/, '');
              console.log('replace entity: '+replace_entity+' with length: '+article_text.length);
              feedxml = feedxml.replace(replace_entity, article_text);
            }

            console.log('send finished feed xml to client\n');
            var server_headers = {
              'Content-Type': feedxmlmime+'; charset=utf-8',
              'Server': cfg.get('http_server')['banner']
            };
            
            client_response.writeHead(200, server_headers);
            client_response.end(feedxml);
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
    page.assign('host', host);
    page.render(client_response);
  }
}).listen(port, bind);
console.log('http server listening on '+bind+' port '+port);
console.log('open a browser and try: http://127.0.0.1:'+port+'/');

