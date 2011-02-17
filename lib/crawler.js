// built in libraries
var fs = require('fs'),
    uri = require('url');

// internal libraries
var func = require('./func.js'),
    cfg = require('./cfg.js'),
    cache = require('./cache.js'),
    urlopen = require('./urlopen.js');

var filter = null;
    
/**
 * Simple crawler that fetches urls and calls a callback when all 
 * url contents are fetched.
 */
var Crawler = function(urls) {
  console.log('scheduled '+urls.length+' urls to crawl');
  this.urls = urls;
  this.articles = {}; // a hash with urls as keys
}
Crawler.prototype = {
  // here in json cache methods the url is considered to be the real_url
  write_json_cache: function(url, real_url, data) {
    var json_cache_filename = cache.filename('json', url);
    var json_cache = {
      url: real_url,
      orig_url: url,
      domain: uri.parse(real_url).hostname,
      length: data.length,
      date: (new Date()).toLocaleString()
    };
    fs.writeFileSync(json_cache_filename, JSON.stringify(json_cache));
    console.log('wrote json cache file: '+json_cache_filename);
    return json_cache;
  },
  load_json_cache: function(url) {
    var json_cache_filename = cache.filename('json', url);
    console.log('read json cache file: '+json_cache_filename);
    return JSON.parse(fs.readFileSync(json_cache_filename, 'utf8'));
  },
  fetch: function(callbacks) { // define finished and error callback
    var crawler = this; // store reference to access object methods later
    var tasks = this.urls.length;
    
    function next() {
      tasks--;
      if(tasks <= 0) {
        // filter the received articles: (jquery selector filtering)
        if(cfg.get('filter')['activate']) {
          if(filter == null) {
            filter = require('./filter.js');
            console.log('loaded filter library');
          }

          filter.filter(crawler.articles, function(articles) {
            callbacks.finished(articles);
          });
        }
        else {
          callbacks.finished(crawler.articles);
        }
      }
    }
    
    for(var i = 0; i < this.urls.length; i++) {
      var articles = this.articles;
      var urls = this.urls;
      // execute in own scope:
      (function() {
        var url = urls[i];
        
        // first check if the url is in cache:
        var cache_file = cache.filename('raw', url);
        if(func.file_exists(cache_file, true)) {
          console.log('use cache file: '+cache_file);
          fs.readFile(cache_file, function(error, data) {
            if(error) {
              callbacks.error(error);
              return;
            }
          
            var article = crawler.load_json_cache(url);
            article.data = data;
            articles[url] = article;

            next();
          });
        }
        else {
          urlopen.fetch(url, {
            data: function(data, real_url) {
              if(data.length == 0) {
                console.log('article contents not retreived');
                next();
                return;
              }
              // write cache file:
              console.log('write crawler cache file: '+cache_file);
              fs.writeFile(cache_file, data, function(error) {
                if(error) {
                  console.log('[ERROR] unable to write crawler cache file: '+error);
                }
              });

              var article = crawler.write_json_cache(url, real_url, data);
              // append the data to the meta information:
              article.data = data;
              articles[url] = article;
              
              next();
            },
            error: function(error) {
              console.log('[ERROR] unable to crawl, error: '+error);
              articles[url] = {
                  data: 'Feedability was unable to receive the <a href="' +
                        url + '">article</a>. The Error Message: '+ error,
                  error: true
              };
              next();
              return;
            }
          });
        }
      })();
    }
  }
};
exports.Crawler = Crawler;
