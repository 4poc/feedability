var log = new (require('./log.js').Logger)('ce');

// built in libraries
var fs = require('fs'),
    uri = require('url');

// internal libraries
var func = require('./func.js'),
    cfg = require('./cfg.js'),
    Filter = require('./filter.js').Filter,
    Cache = require('./cache.js').Cache,
    urlopen = require('./urlopen.js');


var readability = require('readability');






var ContentExtraction = function(settings) {
  this.settings = settings
  this.url_count = 0;
  // this.filter = new Filter();
}

ContentExtraction.prototype.extract = function(url, content, callback) {
  log.debug('extract('+url+')',url);
  var cache = new Cache(url, 'rdby');
  
  // if readability cache exists, just use it, no filtering and extraction
  if(cache.exists()) {
    callback(null, cache.read(), url);
  }
  else {
    var filter = new Filter(url);
    // TODO: perfect place for Step?
    // pre-content extraction filter (before the extraction)
    filter.preFilter(content, function(error, pre_filtered_content) {
      if(error) {
        return callback(error);
      }

      log.debug('callback from preFilter('+pre_filtered_content.length+'):'+url, url);
      
      readability.parse(pre_filtered_content, url, function(info) {

        log.debug('callback from readability.parse('+info.content.length+'):'+url, url);
        
        // post-content extraction filter (after the extraction)
        filter.postFilter(info.content, function(error, post_filtered_content) {
          if(error) {
            return callback(error);
          }
          
          
          cache.write(post_filtered_content);
          callback(null, post_filtered_content, url);        

        }); // end post filter

      }); // end readability content extraction

    }); // end pre filter
  }
}

ContentExtraction.prototype.extractByUrl = function(url, callback) {
  var settings = {force_cache: true, keep_alive: true},
      ce = this;

  log.info('content extraction by url: '+url);
  urlopen.open(url, settings, function(error, content, response) {
    !error || callback(error);
    ce.extract(url, content, callback);
  });
}

exports.ContentExtraction = ContentExtraction;

