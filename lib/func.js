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
 * Convenient collection of JavaScript and Node.js helper functions,
 * the methods do not touch any object prototypes. No function has
 * any internal dependency except the built-in Node.js libraries.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    uri = require('url'),
    crypto = require('crypto');

var func = exports;
    
/*****************************************************************************
 *  Object Functions
 *****************************************************************************/

/**
 * Merge Two Objects Recursively,
 * converts boolean strings (true, false) to boolean primitives.
 * 
 * @param object
 */
func.object_merge = function(obj1, obj2) {
  // @http://stackoverflow.com/questions/171251/how-can-i-merge-properties-
  //    of-two-javascript-objects-dynamically/383245#383245
  for(var key in obj2) {
    if(typeof obj2[key] == 'string' && typeof obj1[key] == 'boolean') {
      if(obj2[key] == 'true') {
        obj2[key] = true;
      }
      else if(obj2[key] == 'false') {
        obj2[key] = false;
      }
    }
    try {
      // Property in destination object set; update its value.
      if(obj2[key].constructor == Object) {
        obj1[key] = func.object_merge(obj1[key], obj2[key]);
      }
      else {
        obj1[key] = obj2[key];
      }
    }
    catch(e) {
      // Property in destination object not set; create it and set its value.
      obj1[key] = obj2[key];
    }
  }
  return obj1;
};

exports.object_empty = function(object) {
  for(var prop in object) {
    if(object.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}



/*****************************************************************************
 *  Array Functions
 *****************************************************************************/

// remove array item
function array_remove(array, item) {
  var j = 0;
  while(j < array.length) {
    if(array[j] == toremove) {
      array.splice(j, 1);
    }
    else { 
      j++;
    }
  }
  return array;
}
exports.array_remove = array_remove;

// checks for item in array, returns true if found
function array_includes(array, item) {
  for(var key in array) {
    if(array[key] == item) {
      return true;
    }
  }
  return false;
}
exports.array_includes = array_includes;

// returns an array with all keys of the supplied array
function array_keys(array) {
  var keys_array = Array();
  for(key in array) {
    keys_array.push(key);
  }
  return keys_array;
}
exports.array_keys = array_keys;

// iterates over array and calls the callback with key and value as params
function array_foreach(array, callback) {
  for(var key in array) {
    if(typeof array[key] != 'function') {
      callback(key, array[key]);
    }
  }
}
exports.array_foreach = array_foreach;

/*****************************************************************************
 *  String Functions
 *****************************************************************************/

// removes leading and tailing whitespace characters from string and returns
function string_trim(string) {
  return (string || '').replace(/^\s+|\s+$/g, ''); 
}
exports.string_trim = string_trim;

// returns true of the string is empty(no characters/only whitespaces)
function string_empty(string) {
  if(!string || string.match(/^\s$/)) {
    return true;
  }
  else {
    return false;
  }
}
exports.string_empty = string_empty;

exports.string_softtabs = function(num) {
  var tabs = '';
  while(--num > 0) {
    tabs += '  ';
  }
  return tabs;
}


/*****************************************************************************
 *  Miscellaneous Functions
 *****************************************************************************/

// read and returns file stats informations
function file_stats(filename) {
  try {
    var stats = fs.lstatSync(filename);
    return stats;
  }
  catch(e) {
    return null;
  }
}
exports.file_stats = file_stats;

// return true if the supplied file exists, false otherwise
// if delempty is set to true the file is deleted and false is returned
//  when the file has zero size
function file_exists(filename, delempty) {
  var stats = file_stats(filename);
  if (stats === null) {
    return false;
  }
  
  if (delempty != undefined && stats.size == 0) {
    //console.log('unlink empty file: '+filename);
    fs.unlinkSync(filename);
    return false;
  }
  return true;
}
exports.file_exists = file_exists;

// calculates and returns the SHA-1 hash of the supplied string
function sha1(string) {
  return crypto.createHash('sha1').update(string).digest("hex");
}
exports.sha1 = sha1;

exports.base64_encode = function(string) {
  return (new Buffer(string)).toString('base64');
}

exports.base64_decode = function(base64_string) {
  return (new Buffer(base64_string, 'base64')).toString();
}

// replaces relative links and resource urls with absolute urls
function html_rel2abs(html, domain) {
  var search = /(src|href)=('|")?(\/)/ig,
      replace = '$1=$2http://'+domain+'$3';

  return html.replace(search, replace);
}
exports.html_rel2abs = html_rel2abs;

// searches a section of text within the html, replaces all tags before match
// currently unused and should do this with fuzzy-string anyway
function htmlplain_contains(search, html) { 
  search = string_trim(search).replace(/<[a-zA-Z\/][^>]*>/g, '');
  html = html.replace(/<[a-zA-Z\/][^>]*>/g, '');
  if(html.indexOf(search) == -1) {
    return false;
  }
  else {
    return true;
  }
}
exports.htmlplain_contains = htmlplain_contains;

exports.ms = function() {
  return (new Date()).getTime();
}

exports.url_base = function(url) {
  var parsed = uri.parse(url);
  return parsed.protocol + '//' + parsed.host + '/';
}

