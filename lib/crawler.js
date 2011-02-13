// built in libraries
var fs = require('fs'),
    urllib = require('url');

// internal libraries
var utils2 = require('./utils2.js'),
    urlopen = require('./urlopen.js');

var filter = null;
    
/**
 * Simple crawler that fetches urls and calls a callback when all 
 * url contents are fetched.
 */
var Crawler = function(urls) {
  console.log('scheduled '+urls.length+' urls to crawl');
  this.urls = urls;
  this.contents = {};
}
Crawler.prototype = {
  urls: [],
  contents: {}, // hash key(url) -> value(site content) 
  fetch: function(callbacks) { // define finished and error callback
    var crawler = this;
    for(var i = 0; i < this.urls.length; i++) {
      var contents = this.contents;
      var urls = this.urls;
      // execute in own scope:
      (function() {
        var url = urls[i];
        
        // first check if the url is in cache:
        var cache_file = './cache/'+utils2.sha1(url)+'.html';
        if(utils2.filestats(cache_file) !== null) {
          console.log('use cache file: '+cache_file);
          fs.readFile(cache_file, function(error, data) {
            if(error) {
              callbacks.error(error);
              return;
            }
          
            contents[url] = data.toString();

            // remove the current url from the list:
            utils2.removeitem(urls, url);

            // no more urls left?
            if(urls.length == 0) {
              crawler.filterhook(callbacks.finished, contents);
            }
          });
        }
        else {
          urlopen.fetch(url, {
            data: function(data) {
              // write cache file:
              fs.writeFile(cache_file, data, function(error) {
                if(error) {
                  console.log('[ERROR] unable to write cache file: '+error);
                }
                else {
                  console.log('written cache file: '+cache_file);
                }
              });

              contents[url] = data;
              
              // remove the current url from the list:
              utils2.removeitem(urls, url);
              
              // no more urls left?
              if(urls.length == 0) {
                crawler.filterhook(callbacks.finished, contents);
              }
            },
            error: callbacks.error
          });
        }
      })();
    }
  },
  filterhook: function(callback, contents) {
    if(utils2.settings['filter']['activate']) {
      if(filter == null) {
        filter = require('./filter.js');
        console.log('loaded filter library');
      }
      
      filter.filter(contents, function(contents) {
        callback(contents);
      });
    }
    else {
      callback(contents);
    }
  }
};
exports.Crawler = Crawler;
