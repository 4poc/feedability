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

// external libraries
var readability = require('readability'),
    jsdom = require('jsdom');

// internal libraries
var cfg = require('./lib/cfg.js'),
    tpl = require('./lib/tpl.js'),
    func = require('./lib/func.js'),
    cache = require('./lib/cache.js'),
    urlopen = require('./lib/urlopen.js'),
    feed = require('./lib/feed.js'),
    crawler = require('./lib/crawler.js'),
    filter = require('./lib/filter.js');

// create local logging object
var log = new (require('./lib/log.js').Logger)('core');

// this makes sure the cache directory exists 
cache.create_path();

// some variables used for the http server
var url_pattern = /^\/(http:\/\/.*)|\?[^=]+=(http:\/\/.*)$/;
var bind = cfg.get('http_server')['bind'];
var port = cfg.get('http_server')['port'];

// create the http server with the feed proxy
http.createServer(function (client_request, client_response) {
  var host = client_request.headers['host'];
  var request_url = unescape(client_request.url);

  var url_match = request_url.match(url_pattern);
  if(url_match) {
    var feed_url = url_match[1] || url_match[2];
    log.info('http client with feed url: '+feed_url, feed_url);
    
    // fetch and process feed
    feed.parse(feed_url, {
      // the feed is successfully retrieved and parsed
      finished: function(feedxml, feedxmlmime, articles) {

        var doc = jsdom.jsdom(feedxml);
        
        
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
                log.warn('article not retreived: '+article_url, article_url);
                continue;
              }
              
              // the result of the content extraction process, per default,
              // gets populated with the original data
              var article_text = articles[article_url].data;
              if(!articles[article_url].error) {
                log.info('content extraction of '+article_url, article_url);
                
                var cache_file = cache.filename('rdby', article_url);
                // check for readability cache:
                if(func.file_exists(cache_file)) {
                  log.debug('use readability cache: '+cache_file, article_url);
                  article_text = fs.readFileSync(cache_file).toString();
                }
                // use readability to extract the article text
                else {
                  readability.parse(article_data.toString(), article_url,
                                    function(info) {
                    
                    log.debug('write readability cache: '+cache_file,
                              article_url);
                    
                    // replace relative urls with absolute ones:
                    var domain = articles[article_url].domain;
                    info.content = func.html_rel2abs(info.content, domain);
                    // TODO: it would be nice to do this directly in the dom
                    //   expand filtering rules?

                    fs.writeFile(cache_file, info.content, function(error) {
                      if(error) {
                        log.error('unable to write readability cache: ' + 
                                  error, article_url);

                      }
                    });
                    
                    article_text = info.content;
                  });
                }
                
                // apply the extracted append and prepend rules:
                if(articles[article_url].prepend != null) {
                  log.debug('filtering prepend rule: ' + 
                            articles[article_url].prepend.length, article_url);

                  article_text = articles[article_url].prepend + article_text;
                }
                if(articles[article_url].append != null) {
                  log.debug('filtering append rule: ' + 
                            articles[article_url].append.length, article_url);

                  article_text += articles[article_url].append;
                }
              } // end if only no error
              
              // insert article text in feed:
              var replace_entity = '&replaceurl:'+func.sha1(article_url)+';';
              article_text = article_text.replace(/\x08/, '');
              log.debug('replace entity: '+replace_entity+' length: '+
                        article_text.length, article_url);

              feedxml = feedxml.replace(replace_entity, article_text);
            }

            log.info('deliver finished feed, length: '+feedxml.length+
                     ' mime: '+feedxmlmime, article_url);

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
      
      // and error occurred during the retrieval or parsing of the feed
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
console.log('open a browser and try: http://127.0.0.1:'+port+'/\n');

