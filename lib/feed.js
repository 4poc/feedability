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
 * Contains the feed class for parsing and generating the XML based
 * feeds. Atom and RSS feeds are supported. Its not meant to be a
 * complete implementation of RSS or Atom, thats the job of the
 * feedreader software.
 * 
 * @fileOverview
 */

// built-in libraries
var util = require('util');

// internal libraries
var log = new (require('./log.js').Logger)('feed'),
    func = require('./func.js'),
    cfg = require('./cfg.js'),
    entity = require('./entity.js'),
    cache = require('./cache.js'),
    urlopen = require('./urlopen.js');

// external libraries
var expat = require('node-expat');
    
/**
 * # Feedability Feed Parser/Generator Class (Constructor)
 * 
 * This is not a general purpose feed parser, it does not implement
 * any feed standard completely, but that isn't necessary for Feedability. 
 * It is the job of the feed reader application to properly parse the feed
 * and to interpret all the different standards and extensions.
 * 
 * This class uses the expat stream-oriented xml parser to find feed
 * items (`<entry>` for Atom or <item> for RSS) it then parses for item 
 * links (`<link [rel="alternate"] href="url">` for Atom, `<link>url</link>` 
 * for RSS) and text excerpts (`<summary>`, `<description>`, `<content>`,
 * `<encoded>`), the text excerpt elements are removed from the item xml 
 * that is created, the following object is created for each parsed item:
 * 
 *     {
 *        link: "<link>",
 *        pre: "<begin of item>",
 *        post: "<end of item>",
 *        excerpts: ["<excerpt text>"]
 *     }
 * 
 * Atom and RSS support elements for excerpts and full-text content,
 * Feedability is trying to keep the excerpts intact if found, and
 * uses the excerpts to detect if the feed already includes full-text.
 *
 * @class
 * @param buffer  The feed XML content
 * @param string  The url of the feed
 * @param string  An optional encoding to use
 */
var Feed = function(content, url, mime) {
  // private object properties
  this.content = content;
  this.url = url || 'http://localhost/';
  this.mime = mime;
  
  log.info('init feed parser for '+url, url);

  // create expat instance and append listeners but do not parse yet
  this.expat = new expat.Parser('UTF-8');
  this.addExpatListeners();
}

/**
 * Parse the feed for items, links and excerpts
 * 
 * The provided callback is executed with error/null and the feed
 * object itself.
 * 
 * @param function  The callback that gets called after finishing
 */
Feed.prototype.parse = function(callback) {
  if(func.string_empty(this.content)) {
    log.warn('unable to parse empty feed');
    callback('unable to parse empty feed');
  }
  
  // includes the xml declaration
  this.header = '';
  
  // the root element name
  this.root = null;
  
  // the stream is populated with generated xml from the events
  this.stream = '';
  
  // outer contains the xml before and after the item elements
  this.outer_pre = null;
  this.outer_post = null;
  
  // state properties for parsing feed items
  this.items = [];
  this.item = null; // the currently parsed item
  this.in_excerpt = false; // also used to skip the xml generator
  this.in_link = false; // for rss link elements
  
  // set to true by the startElement event, set back to false 
  // by any other event, used to decide to close the tag with ' />' or '>'
  this.prev_open = false;
  
  // invoke stream parsing, this is syncronized, it returns when
  // the parsing is completed (or an error occured)
  this.expat.parse(this.content, true); // what does the second argument do?
  
  // check to see if there was an error during parsing
  var error = this.expat.getError();
  if(error) {
    error = 'expat was unable to parse the feed document: ' + error;
  }

  callback(error, this);
}


/**
 * Add Listeners of the expat streaming parser
 */
Feed.prototype.addExpatListeners = function() {
  var self = this;
  
  // use closures to keep the scope of the object
  this.expat.addListener('startElement', function(n,a) { self.expatStartElement(n,a); });
  this.expat.addListener('endElement', function(n) { self.expatEndElement(n); });
  this.expat.addListener('text', function(t) { self.expatText(t); });
  this.expat.addListener('xmlDecl', function(v, e, s) { self.expatXmlDecl(v, e, s); });
  this.expat.addListener('startCdata', function() { self.expatStartCdata(); });
  this.expat.addListener('endCdata', function() { self.expatEndCdata(); });
}


/**
 * Stream Parser Event: xml declaration
 * 
 * Populates the header property with the correct xml declaration. All
 * text nodes are converted to UTF-8, so ignore the original encoding.
 * 
 * @param string the xml version
 * @param string the xml encoding
 * @param boolean the standalone flag
 */
Feed.prototype.expatXmlDecl = function(version, encoding, standalone) {
  log.debug('expat stream event: xmldecl, encoding: '+encoding);
  standalone = (standalone) ? 'yes' : 'no';
  this.header = '<?xml version="'+version+'" encoding="utf-8" standalone="'+standalone+'" ?>\n';
}


/**
 * Stream Parser Event: open element `<foo [attributes]>`
 * 
 * Code to detect root element, item elements including links and
 * excerpts.
 * 
 * @param string name the name of the element
 * @param object attributes
 */
Feed.prototype.expatStartElement = function(name, attributes) {
  log.debug('expat stream event: startelement, name: '+name);
  
  // use the root element (the first start element) to detect mime
  if(!this.root) {
    this.root = name;
    log.debug('the root element: '+name+' '+attributes);
    
    if(this.mime == 'application/rss+xml' && !attributes['xmlns:content']) {
      // the content:encoded element that gets inserted is part of
      // an external namespace extension:
      attributes['xmlns:content'] = 'http://purl.org/rss/1.0/modules/content/';
    }
  }
  
  // make sure the link rel="self" is matching the real location (-pedantic)
  /*if(!this.outer_pre && (name == 'link' || name == 'atom10:link') && 
      attributes['rel'] && attributes['rel'] == 'self' &&
      attributes['href'] && cfg.get('server')['location']) {

    attributes['href'] = cfg.get('server')['location'] + escape(attributes['href']);
  }*/
  
  // detects the first occuring of an item element
  if(this.isItem(name) && !this.outer_pre) {
    this.outer_pre = this.stream;
    this.stream = '';
  }

  // initialize empty item
  if(this.isItem(name)) {
    this.item = {pre: '', post: '', url: '', excerpts: []};
  }
  
  // detect item link:
  if(name == 'link' && this.item) {
    if(attributes['href']) {
      // this basically means that it uses the last <link> that either
      //  has no rel or rel=alternate, (rfc4287)
      if(!this.item.url || (attributes['rel'] == 'alternate' || !attributes['rel'])) {
        this.item.url = attributes['href'];
      }
    }
    else {
      this.in_link = true;
    }
  }
  
  // excerpt elements found
  if(this.item && this.isExcerpt(name)) {
    this.in_excerpt = true;
  }

  // create the excerpt
  if(!this.in_excerpt) {
    if(this.prev_open) {
      this.stream += '>';
    }
    this.stream += '<' + name;
    if(!func.object_empty(attributes)) {
      this.stream += ' ';
  
      attribute_str = '';
      func.array_foreach(attributes, function(key, value) {
        attribute_str += key+'="'+entity.encode(value, {xml: true, html: false})+'" ';
      });
      this.stream += attribute_str;

    }
    this.prev_open = true;
  }
}


/**
 * Stream Parser Event: close element `</foo>` or just `/>`
 * 
 * @param string the name of the closing tag
 */
Feed.prototype.expatEndElement = function(name) {
  var tag = null;
  if(this.prev_open) {
    tag = ' />'
    this.prev_open = false;
  }
  else {
    tag = '</'+name+'>';
  }
  log.debug('expat stream event: endelement, name: '+name+' stream+ '+tag);
  
  if(this.item) {
    // handle the end of an excerpt element
    if(this.isExcerpt(name)) {
      this.item.excerpts.push('');
      this.in_excerpt = false; tag ='';
    }
    
    // handle the end of an link element (switch flag off)
    if(this.item && this.in_link && name == 'link') {
      this.in_link = false;
    }
    
    // handle the end of the current item
    if(this.isItem(name)) {
      this.item.pre = this.stream;
      this.item.post = tag; tag=''; // post only includes the closing item tag
      this.stream = '';
      
      this.item.excerpts.splice(this.item.excerpts.length-1, 1);

      log.debug('parsed item: '+util.inspect(this.item, false, 4, true));
      
      this.items.push(this.item);
    }
  }
  
  if(!this.in_excerpt) {
    this.stream += tag;
  }
  
  // detect outer end (closing of root element)
  if(this.root == name) {
    this.outer_post = this.stream;
    this.stream = '';
  }
}


/**
 * Stream Parser Event: text node
 * 
 * Performs decoding/encoding and detect text nodes within link 
 * and excepts.
 * 
 * @param string
 */
Feed.prototype.expatText = function(text) {
  log.debug('expat stream event: text, text length: '+text.length);
  if(!this.cdata_text) {
    // encode the xml entities of non-cdata text nodes:
    text = entity.encode(text, {numbered: true});
  }

  if(this.prev_open) this.stream += '>';
  this.prev_open = false;
  
  // append the text to the last excerpts of the current item
  if(this.in_excerpt && !func.string_empty(text)) {
    if(this.item.excerpts.length == 0) {
      this.item.excerpts = [''];
    }
    this.item.excerpts[this.item.excerpts.length-1] += text;
  }
  else {
    this.stream += text;
    
    if(this.in_link) {
      this.item.url += text;
    }
  }
}


/**
 * Stream Parser Event: open a block of cdata `<![CDATA[`
 */
Feed.prototype.expatStartCdata = function() {
  log.debug('expat stream event: startcdata');
  if(this.prev_open) this.stream += '>';
  this.prev_open = false;
  this.cdata_text = true;
  
  if(!this.in_excerpt) {
    this.stream += '<![CDATA[';
  }
}


/**
 * Stream Parser Event: close a block of cdata `]]>`
 */
Feed.prototype.expatEndCdata = function() {
  log.debug('expat stream event: endcdata');
  this.cdata_text = false;
  
  if(!this.in_excerpt) {
    this.stream += ']]>';
  }
}


/**
 * Create the feed xml content for item
 * 
 * @returns string with the xml of the item
 */
Feed.prototype.createItemContents = function(item) {
  var content = item.pre;
  
  // TODO: create elements for excerpts and the real item content (if present)
  //       use tags based on detected feed type, reconsider rfcs

  if(item.excerpts.length > 0) {
    content += this.createItemExcerpts(item);
  }

  if(item.content) {
    content += this.createItemFullContent(item);
  }

  return content + item.post;
}

Feed.prototype.createItemExcerpts = function(item) {
  var content = '';
  if(this.mime == 'application/atom+xml') {
    content += '<summary><![CDATA['+item.excerpts.join('')+']]></summary>';
  }
  else { // rss
    content += '<description><![CDATA['+item.excerpts.join('')+']]></description>';
  }
  return content;
}

Feed.prototype.createItemFullContent = function(item) {
  var content = '';
  if(this.mime == 'application/atom+xml') {
    content += '<content type="html"><![CDATA['+item.content+']]></content>';
  }
  else { // rss
    if(item.excerpts.length == 0) {
      content += '<description><![CDATA['+item.content+']]></description>';
    } else {
      content += '<content:encoded><![CDATA['+item.content+']]></content:encoded>';
    }
  }
  return content;
}


/**
 * Returns the xml declaration
 */
Feed.prototype.getHeader = function() {
  return this.header;
}


/**
 * Returns outer pre xml.
 */
Feed.prototype.getOuterPre = function() {
  return this.outer_pre;
}


/**
 * Returns oooooooo... 
 */
Feed.prototype.getOuterPost = function() {
  return this.outer_post;
}



/**
 * Check to see if the tag name is specifying an feed item.
 * 
 * @param string  The name of the element
 * @returns boolean  Returns true if its a item
 */
Feed.prototype.isItem = function(name) {
  return (name == 'item' || name == 'entry');
}

/**
 * Check to see if the tag name is specifying an excerpt item.
 * 
 * @param string  The name of the element
 * @returns boolean  Returns true if its a excerpt
 */
Feed.prototype.isExcerpt = function(name) {
  return func.array_includes(["content:encoded", "description", "encoded",
                              "content", "summary"], name);
}

/**
 * Iterate over parsed items using a callback function
 * 
 * @param function  The callback function, called with item
 */
Feed.prototype.eachItem = function(callback) {
  func.array_foreach(this.items, function(i, item) {
    callback(item, i);
  });
}

Feed.prototype.getItems = function() {
  return this.items;
}


exports.Feed = Feed;

