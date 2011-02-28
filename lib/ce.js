/**
 * Feedability: Node.js Feed Proxy With Readability
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

/**
 * Contains a class for content extraction based on arc90's
 * Readability. This is the place where future development of
 * other content extraction algorithms and/or template detection
 * systems _could_ be developed.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    uri = require('url');

// internal libraries
var log = new (require('./log.js').Logger)('ce'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    Filter = require('./filter.js').Filter,
    Cache = require('./cache.js').Cache,
    urlopen = require('./urlopen.js');

// external libraries
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
      if(error || !pre_filtered_content) {
        return callback(error);
      }

      log.debug('callback from preFilter('+pre_filtered_content.length+'):'+url, url);
      
      readability.parse(pre_filtered_content, url, function(info) {

        log.debug('callback from readability.parse('+info.content.length+'):'+url, url);
        
        // post-content extraction filter (after the extraction)
        filter.postFilter(info.content, function(error, post_filtered_content) {
          if(error || !post_filtered_content) {
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
    if(error || !content) {
      callback(error);
      return;
    }
    ce.extract(url, content, callback);
  });
}

exports.ContentExtraction = ContentExtraction;

