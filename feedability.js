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
    urllib = require('url');

// external libraries
var readability = require('readability');

// internal libraries
var tpl = require('./lib/tpl.js'),
    utils2 = require('./lib/utils2.js'),
    urlopen = require('./lib/urlopen.js'),
    feed = require('./lib/feed.js'),
    crawler = require('./lib/crawler.js'),
    filter = require('./lib/filter.js');

    
var cache_path = utils2.settings['cache_path'];

if(utils2.filestats(cache_path) == null) {
  console.log('create cache directory: '+cache_path);
  fs.mkdirSync(cache_path, 0755);
}
    
// some variables used for the http server
var url_pattern = /^\/(http:\/\/.*)$/;
var bind = utils2.settings['http_server']['bind'];
var port = utils2.settings['http_server']['port'];

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
            var article_urls = utils2.hashkeys(articles);
            for(var i = 0; i < article_urls.length; i++) {
              var article_url = article_urls[i];
              var article_data = articles[article_url].data;
              if(!article_data || article_data.length <= 0) {
                console.log('[WARNING] article not retreived: '+article_url+' ('+utils2.cache_file(article_url)+')');
                continue;
              }
              console.log('extract using readability for '+article_url+
                          ' ('+article_data.length+')');
              
              var cache_file = utils2.cache_file(article_url) + '.rdby';
              var article_text = null; // the extracted article text
              // check for readability cache:
              if(utils2.filestats(cache_file) !== null) {
                console.log('using readability cache file: '+cache_file);
                article_text = fs.readFileSync(cache_file).toString();
              }
              // use readability to extract the article text
              else {
                readability.parse(article_data, article_url, function(info) {
                  console.log('write readability cache file: '+cache_file);
                  
                  // replace relative urls with absolute ones:
                  info.content = utils2.rel2abs(info.content, articles[article_url].domain);
                  // it would be nice to do this directly in the dom, @TODO

                  fs.writeFile(cache_file, info.content, function(error) {
                    if(error) {
                      console.log('[ERROR] unable to write readability cache file: '+error);
                    }
                  });
                  
                  article_text = info.content;
                });
              }
              
              // insert article text in feed:
              var replace_entity = '&replaceurl:'+utils2.sha1(article_url)+';';
              article_text = article_text.replace(/\x08/, '');
              feedxml = feedxml.replace(replace_entity, article_text);
            }

            console.log('send finished feed xml to client\n');
            var server_headers = {
              'Content-Type': feedxmlmime+'; charset=utf-8',
              'Server': utils2.settings['http_server']['banner']
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
if(bind == '0.0.0.0') {
  bind = '127.0.0.1';
}
console.log('http server started: http://'+bind+':'+port+'/');
console.log('  just append your feed url, for instance:');
console.log('    http://'+bind+':'+port+'/http://example.com/feed.rss');

