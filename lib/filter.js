var jsdom = require('jsdom'),
    util = require('util'),
    fs = require('fs');

var func = require('./func.js'),
    cfg = require('./cfg.js'),
    cache = require('./cache.js');

// configuration and filter rules
var jquery_url = cfg.get('filter')['jquery_url'];
var rules = cfg.get('filter')['rules'];
var url_patterns = Array();
for(var url_pattern_string in rules) {
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
      var matched_rules = Array();
      for(var n in url_patterns) {
        var re_string = url_patterns[n];
        var re = new RegExp(re_string, "ig");
        // console.log('checking for '+re_string+' to url: '+url);
        if(re.test(url)) {
          console.log('matching jquery filters: '+util.inspect(rules[re_string]));
          matched_rules.push(rules[re_string]);
        }
      }
      if(matched_rules.length == 0) {
        console.log('no matching filters skip filtering');
        next(); 
        return; // == continue here
      }
      
      // rule specific options
      var html = articles[orig_url].data.toString();
      html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
      
      // this is "very" slow (and blocking?)
      console.log('filter create jsdom for url: '+url+' ('+articles[orig_url].data.length+')');
      var window = null;
      try {
        var doc = jsdom.jsdom(html);
        
        if(!doc.body) {
          throw '';
        }
        
        window = doc.parentWindow;
        window = window || doc.createWindow();

        if(window === null) {
          throw '';
        }
      }
      catch(e) {
        console.log('[WARNING] unable to create dom tree for '+orig_url);
        next(); // no fatal error
        return
      }


      // this jQueryify is surprisingly fast
      try {
        jsdom.jQueryify(window, jquery_url, function() {
          var $ = window.jQuery;
          console.log('created jquery context for url: '+url);
          
          // apply filter rules
          for(var l in matched_rules) {
            var rules_remove = matched_rules[l]['remove'] || [];
            var rules_exclusive = matched_rules[l]['exclusive'] || [];
            var rules_prepend = matched_rules[l]['prepend'] || [];
            var rules_append = matched_rules[l]['append'] || [];
            
            // reset prepend/append in feedability it gets assigned anyway
            articles[orig_url].prepend = '';
            articles[orig_url].append = '';
            
            // removes matching elements directly from the dom doc
            for(var j in rules_remove) {
              console.log('apply remove rule: '+rules_remove[j]);
              $(rules_remove[j]).remove();
            }
            // replaces the body of the current dom with the found element(s)
            if(rules_exclusive.length > 0) {
              var exclusive_html = '';
              for(var j in rules_exclusive) {
                console.log('apply exclusive rule: '+rules_exclusive[j]);
                exclusive_html += $(rules_exclusive[j]).html();
                console.log('exclusive rule extracted: '+exclusive_html.length);
              }
              $('body').html(exclusive_html);
            }
            // "passively" selects elements and store the html text in property
            for(var j in rules_prepend) {
              console.log('apply prepend rule: '+rules_prepend[j]);
              articles[orig_url].prepend += $(rules_prepend[j]).html();
              console.log('prepend rule extracted: '+articles[orig_url].prepend.length);
            }
            for(var j in rules_append) {
              console.log('apply append rule: '+rules_append[j]);
              articles[orig_url].append += $(rules_append[j]).html();
              console.log('append rule extracted: '+articles[orig_url].append.length);
            }
          }

          // convert the modified dom back to html:
          articles[orig_url].data = '<html>'+$('html').html()+'</html>';
          next();
        });
      }
      catch(e) {
        console.log('[WARNING] unable to jqueryify for '+orig_url);
        next(); // no fatal error
        return
      }
    })();// end pseudo function for own focus
  }
}
exports.filter = filter;
