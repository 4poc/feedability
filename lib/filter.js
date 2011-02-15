var jsdom = require('jsdom'),
    util = require('util'),
    fs = require('fs');

var func = require('./func.js'),
    cfg = require('./cfg.js'),
    cache = require('./cache.js');

// configuration and filter rules
var jquery_path = cfg.get('jquery_path');
var jquery_filters = cfg.get('filter')['jquery_filters'];
var url_patterns = Array();
for(var url_pattern_string in jquery_filters) {
  url_patterns.push(url_pattern_string);
}

/**
 * JQuery Selector Based Pre-Filter
 * 
 * This implements a filter that removes certain elements specified
 * by jQuery selectors from the received article sites before it gets
 * processed by Readability.
 * The process of creating the dom tree and removing the elements is
 * time consuming, that should be noted.
 * The important filter settings are ['filter']['jquery_filters'], 
 * a hash with regular expressions as keys that gets matched with
 * the article url. For the content of the matching urls, a jsdom
 * tree is parsed and the selectors in the array value is used
 * to remove elements. So for an example:
 *   "filter": {
 *     "activate": true,
 *     "jquery_path": "./ext/jquery-1.5.min.js",
 *     "jquery_filters": {
 *       "example\\.com": ["#navigation", ".meta"]
 *     }
 *   }
 * This will apply the two filter selectors on all urls that match
 * with /example\.com/ig. Elements with the ID "navigation" and
 * Elements with the Class "meta" will be deleted from the article.
 * 
 * This filter is applied after the articles are received (or loaded
 * from cache files) and before the content extraction process
 * with readability. The filter is only applied if there are no
 * readability cache files availible (*.rdby). So make sure you delete
 * the rdby files after changing the filter rules or they will have
 * no effect on already cached articles.
 */
function filter(articles, callback) {
  var article_urls = func.array_keys(articles);
  var tasks = article_urls.length;

  // this nice pattern is based on (3.1): 
  //   http://blog.mixu.net/2011/02/02/essential-node-js-patterns-and-snippets/
  function next() { 
    tasks--;
    if(tasks <= 0) {
      callback(articles);
    }
  }

  for(var i = 0; i < article_urls.length; i++) {(function() {
      var orig_url = article_urls[i];
      var url = articles[orig_url].url;
      console.log('start filtering for '+url);

      // most of the filtering is very slow, so make sure this is really
      // necessary before continue.
      // check for cached readability file:
      var cache_file = cache.filename('rdby', orig_url);
      if(func.file_exists(cache_file)) { // cache file exists
        console.log('readability cache file found, skip filtering');
        next(); 
        return; // == continue here
      }
      // make sure there are matching filter rulesets:
      var matching_filters = Array();
      for(var n in url_patterns) {
        var re_string = url_patterns[n];
        var re = new RegExp(re_string, "ig");
        // console.log('checking for '+re_string+' to url: '+url);
        if(re.test(url)) {
          console.log('matching jquery filters: '+jquery_filters[re_string]);
          matching_filters.push(jquery_filters[re_string]);
        }
      }
      if(matching_filters.length == 0) {
        console.log('no matching filters skip filtering');
        next(); 
        return; // == continue here
      }
      
      // this is "very" slow (and blocking?)
      console.log('filter create jsdom for url: '+url+' ('+articles[orig_url].data.length+')');
      try {
        var window = jsdom.jsdom(articles[orig_url].data.toString()).createWindow();
      }
      catch(e) {
        console.log('[WARNING] unable to create dom tree for '+orig_url);
        next(); // no fatal error
        return
      }

      // this jQueryify is surprisingly fast
      jsdom.jQueryify(window, jquery_path, function(window, jquery) {
        console.log('created jquery context for url: '+url);
        
        // actual filtering
        for(var m in matching_filters) {
          for(var j in matching_filters[m]) {
            console.log('applying filter rule: '+matching_filters[m][j]);
            jquery(matching_filters[m][j]).remove();
          }
        }

        // convert the modified dom back to html:
        articles[orig_url].data = '<html>'+jquery('html').html()+'</html>';
        next();
      });
    })();// end pseudo function for own focus
  }
}
exports.filter = filter;
