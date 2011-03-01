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
 * Contains the class for cache accessing, it is used to store
 * received feeds and pages by the urlopen module and to cache the
 * content extracted by readability.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    uri = require('url');

// internal libraries
var log = new (require('./log.js').Logger)('cache'),
    func = require('./func.js'),
    cfg = require('./cfg.js');

// only require node-compress if cache should use gzip compression
if(cfg.get('cache').compress) {
  var compress = require('compress');
}

var Cache = function(url, extension) {
  this.content = null;
  this.url = url;
  this.extension = extension;
  this.domain = uri.parse(url).hostname;
  
  var cache_path = cfg.get('cache')['path'];
  // make sure settings cache path exists:
  if(!func.file_exists(cache_path)) {
    log.info('create cache directory: '+cache_path);
    fs.mkdirSync(cache_path, 0755);
  }
  // make sure domain cache path exists:
  cache_path += '/' + this.domain;
  if(!func.file_exists(cache_path)) {
    log.info('create non-existing domain directory', this.domain);
    fs.mkdirSync(cache_path, 0755);
  }
  this.filename = cache_path + '/' + func.sha1(url) + '.' + extension;

  log.debug('initialize cache file: '+this.filename);
}

Cache.prototype.exists = function() {
  return func.file_exists(this.filename);
}

Cache.prototype.read = function() {
  var encoding = 'utf-8';

  if(this.content) {
    return this.content;
  }
  
  log.debug('read cache file: '+this.filename, this.url);
  var content = fs.readFileSync(this.filename, encoding);
  
  // decompression
  if(compress) {
    // do decompression ...
  }
  
  if(this.extension == 'json') {
    content = JSON.parse(content);
  }
  this.content = content;
  
  log.debug('read content type is '+typeof content);
  return content;
}

Cache.prototype.write = function(content) {
  if(!content || (typeof content == 'string' && content == '')) {
    log.warn('ignoring empty content', this.url);
    return;
  }
  this.content = content;
  log.debug('write cache content ('+content.length+') file: '+this.filename, this.url);
  if(this.extension == 'json') {
    content = JSON.stringify(content);
  }
  var encoding = 'utf-8';
  
  // compress content before writing
  if(compress) {
    // do compression ...
  }
  
  fs.writeFileSync(this.filename, content, encoding);
}

exports.Cache = Cache;
