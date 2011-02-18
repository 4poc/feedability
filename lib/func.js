/**
 * Node.js Utility Functions
 * 
 * This file is a collection of javascript and nodejs helper 
 * functions. Besides node.js there are no external libraries
 * required.
 */
var fs = require('fs'),
    crypto = require('crypto');

/*****************************************************************************
 *  Object Functions
 *****************************************************************************/

// merge properties of two objects recursively together
function object_merge(obj1, obj2) {
  // @http://stackoverflow.com/questions/171251/how-can-i-merge-properties-
  //    of-two-javascript-objects-dynamically/383245#383245
  for(var key in obj2) {
    try {
      // Property in destination object set; update its value.
      if(obj2[key].constructor == Object) {
        obj1[key] = object_merge(obj1[key], obj2[key]);
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
}
exports.object_merge = object_merge;

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

// encodes special xml characters with entities
var xml_encode_map = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;'
};
function xml_encode(string) {
  return string.replace(/([\&"<>])/g, function(str, item) {
    return xml_encode_map[item];
  });
}
exports.xml_encode = xml_encode;

// decodes some of the special xml entities
var xml_decode_map = {};
for(var char in xml_encode_map) {
  xml_encode_map[xml_encode_map[char]] = char;
}
function xml_decode(string) {
  return string.replace(/(&quot;|&lt;|&gt;|&amp;)/g, function(str, item) {
    return xml_decode_map[item];
  });
}
exports.xml_decode = xml_decode;

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

