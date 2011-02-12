// built in libraries
var fs = require('fs'),
    http = require('http'),
    util = require('util'),
    jsdom = require('jsdom'),
    urllib = require('url'),
    crypto = require('crypto');

// external libraries
var expat = require('node-expat');

// internal libraries
var utils2 = require('./utils2.js'),
    urlopen = require('./urlopen.js');

/**
 * Simple crawler that fetches urls and calls a callback when all 
 * url contents are fetched.
 */
var Crawler = function(urls) {
  console.log('--[ crawler scheduled '+urls.length+' urls');
  this.urls = urls;
  this.contents = {};
}
Crawler.prototype = {
  urls: [],
  contents: {}, // hash key(url) -> value(site content) 
  fetch: function(callbacks) { // define finished and error callback
    for(var i = 0; i < this.urls.length; i++) {
      var contents = this.contents;
      var urls = this.urls;
      // execute in own scope:
      (function() {
        var url = urls[i];
        console.log('--[ crawler fetch url: '+url);
        
        // first check if the url is in cache:
        var cache_file = './cache/'+utils2.sha1(url)+'.html';
        if(utils2.filestats(cache_file) !== null) {
          console.log('--[ load cache file: '+cache_file);
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
              callbacks.finished(contents);
            }
          });
        }
        else {
          urlopen.fetch(url, {
            data: function(data) {
              // write cache file:
              fs.writeFile(cache_file, data, function(error) {
                if(error) {
                  console.log('--[ log write error: '+error);
                }
                else {
                  console.log('--[ log file written '+cache_file);
                }
              });

              contents[url] = data;
              
              // remove the current url from the list:
              utils2.removeitem(urls, url);
              
              // no more urls left?
              if(urls.length == 0) {
                callbacks.finished(contents);
              }
            },
            error: callbacks.error
          });
        }
      })();
    }
  }
};
exports.Crawler = Crawler;
