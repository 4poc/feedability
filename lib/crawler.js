var log = new (require('./log.js').Logger)('crawler');

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
  log.info('schedule url crawling: '+urls.length, urls[0])
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
    log.debug('wrote json cache: '+json_cache_filename, real_url)
    return json_cache;
  },
  load_json_cache: function(url) {
    var json_cache_filename = cache.filename('json', url);
    log.debug('read json cache: '+json_cache_filename, url)
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
            log.debug('loaded filter library');
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
          log.debug('use raw data cache: '+cache_file, url);
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
                log.warning('empty article contents retreived', real_url);
                next();
                return;
              }
              // write cache file:
              log.debug('write article cache: '+cache_file, real_url);
              fs.writeFile(cache_file, data, function(error) {
                if(error) {
                  log.error('unable to write article cache: '+error, real_url);
                }
              });

              var article = crawler.write_json_cache(url, real_url, data);
              // append the data to the meta information:
              article.data = data;
              articles[url] = article;
              
              next();
            },
            error: function(error) {
              log.warning('unable to crawl article: '+error, url);
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
