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
 * Module provide filtering class for pre and post processing of
 * feed, to be more precise: the dom and regular expression based
 * manipulation of single received pages/ feed items.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    uri = require('url'),
    util = require('util');

// internal libraries
var log = new (require('./log.js').Logger)('filter'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    Cache = require('./cache.js').Cache,
    urlopen = require('./urlopen.js');

// external libraries
var jsdom = require('jsdom');


var Filter = function(url) {
  log.info('create Filter('+url+')',url);
  this.url = url;
  this.jquery_url = cfg.get('filter')['jquery_url'];
  this.rules = this.getRulesByUrl(url);
  this.prepend = '';
  this.append = '';
}



/**
 * Return matching rules by url
 */
Filter.prototype.getRulesByUrl = function(url) {
  var matched_rules = {},
      all_rules = cfg.get('filter')['rules'];
  for(url_match in all_rules) {
    if((new RegExp(url_match, 'ig')).test(url)) {
      func.object_merge(matched_rules, all_rules[url_match])
    }
  }
  log.debug('matching filtering rules: '+util.inspect(matched_rules));
  return matched_rules;
}

/**
 * Create jsdom doc from xml string
 * 
 * @param the xml string
 * @returns the jsdoc dom document
 */
Filter.prototype.createDoc = function(content) {
  content = content.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  log.info('filtering create jsdom doc: '+this.url+' ('+
            content.length+')', this.url);
  try {
    return jsdom.jsdom(content);
  }
  catch(e) {
    log.warn('unable to create jsdom doc: '+content, this.url);
    return null;
  }
}

/**
 * Create jsdom window and jQuery context
 */
Filter.prototype.jQueryify = function(doc, callback) {
  var window = null;
  try {
    window = doc.parentWindow;
    window = window || doc.createWindow();
    if(window === null) {
      throw '';
    }
  }
  catch(e) {
    return callback('unable to create jsdom window');
  }

  try {
    jsdom.jQueryify(window, this.jquery_url, function(w, jquery) { // TODO: whats w?
      log.debug('callback from jsdom.jQueryify()')
    
      // log.debug('test jquery context: '+jquery('title').html())
      return callback(null, jquery);
    });
  }
  catch(e) {
    return callback('unable to jqueryify');
  }
}


/**
 * Apply the supplied filter on the document dom
 * 
 * This filter 
 * 
 * @param document dom tree (as created with createDoc)
 * @param filtering rules to apply
 */
Filter.prototype.applyFilter = function(jquery, rules) {
  if(!rules) {
    return;
  }
  
  // remove filters:
  for(var j in rules['remove']) {
    log.debug('apply remove rule: '+rules['remove'][j]);
    jquery(rules['remove'][j]).remove();
  }

  // exclusive filters:
  // replaces the body of the current dom with the found element(s)
  if(rules['exclusive'] && rules['exclusive'].length > 0) {
    var exclusive_html = '';
    for(var j in rules['exclusive']) {
      log.debug('apply exclusive rule: '+rules['exclusive'][j]);

      exclusive_html += jquery(rules['exclusive'][j]).html();
      log.debug('exclusive rule extracted: '+exclusive_html.length);

    }
    jquery('body').html(exclusive_html);
  }
}

Filter.prototype.applyReplaceFilter = function(content, replace_rules) {
  // replace placeholders and replace content
  for(var regex in replace_rules) {
    var replace_rule = replace_rules[regex];
    replace_rule = replace_rule.replace('%{URL_BASE}', func.url_base(this.url));

    log.debug('replace('+content.length+') filter: regex('+regex+') -> '+replace_rule);
    content = content.replace((new RegExp(regex, 'gi')), replace_rule);
    log.debug('replaced: '+content.length);
  }

  return content;
}

/**
 * Apply pre filter rules:
 */
Filter.prototype.preFilter = function(content, callback) {
  var pre_rules = this.rules['pre'],
      prepend_rules = this.rules['prepend'],
      append_rules = this.rules['append'],
      self = this;

  log.info('preFilter(): '+util.inspect(pre_rules));
  
  if(pre_rules && pre_rules['replace']) {
    content = this.applyReplaceFilter(content, pre_rules['replace']);
  }
  
  if(prepend_rules || append_rules || pre_rules) {
    var doc = this.createDoc(content);
    if(!doc) {
      log.error('unable to create jsdom document');
      return callback('Unable to parse document.');
    }
    this.jQueryify(doc, function(error, jquery) {
      if(error) {
        return callback(error);
      }
      
      log.debug('apply pre filtering rules.');
      self.applyFilter(jquery, pre_rules);
      
      for(var j in prepend_rules) {
        log.debug('apply prepend rule: '+prepend_rules[j], this.url);
        self.prepend += jquery(prepend_rules[j]).html();
        log.debug('prepend rule extracted: ' + self.prepend.length, this.url);
      }
      for(var j in append_rules) {
        log.debug('apply append rule: '+append_rules[j], this.url);
        self.append += jquery(append_rules[j]).html();
        log.debug('append rule extracted: ' + self.append.length, this.url);
      }
      
      return callback(null, '<html>' + jquery('html').html() + '</html>');
    });
  }
  else {
    log.info('no pre-filters to apply', this.url);
    callback(null, content);
  }
}

Filter.prototype.postFilter = function(content, callback) {
  var post_rules = this.rules['post'],
      self = this;
      
  log.info('postFilter(): '+util.inspect(post_rules)+' prepend:'+self.prepend.length);
  
  content = self.prepend + content + self.append;
  
  if(post_rules) {
    var doc = this.createDoc('<html><head></head><body>'+content+'</body></html>');
    if(!doc) {
      log.error('unable to create jsdom document');
      return callback('Unable to parse document.');
    }
    this.jQueryify(doc, function(error, jquery) {
      if(error) {
        return callback(error);
      }
      
      self.applyFilter(jquery, post_rules);
      
      var filtered = jquery('body').html();
      
      if(post_rules && post_rules['replace']) {
        filtered = self.applyReplaceFilter(filtered, post_rules['replace']);
      }
      
      return callback(null, filtered);
    });
  }
  else {
    log.info('no post-filters to apply', this.url);
    callback(null, content);
  }
}


exports.Filter = Filter;


