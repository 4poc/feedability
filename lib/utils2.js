var fs = require('fs'),
    crypto = require('crypto');

var settings = null;
function load_settings(filename) {
  if(settings == null) {
    console.log('load json settings: '+filename);
    try {
      settings = JSON.parse(fs.readFileSync(filename, 'utf8'));
    }
    catch (error) {
      console.log('[ERROR] loading settings: '+error);
    }
  }
  exports.settings = settings;
}
load_settings('settings.json');

function extend(to, from)
{
  var l,i,o,j;
  for (i = 1, l = arguments.length; i < l; i++) {
    o = arguments[i];
    for (j in o) {
      to[j] = o[j];
    }
  }
  return to;
}
exports.extend = extend;

function removeitem(array, toremove)
{
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
exports.removeitem = removeitem;

function inarray(array, search)
{
  for(var i=0; i<array.length; i++) {
    if(array[i] == search) {
      return true;
    }
  }
  return false;
}
exports.inarray = inarray;

function hashkeys(hash)
{
  var array = Array();
  for(key in hash) {
    array.push(key);
  }
  return array;
}
exports.hashkeys = hashkeys;

function cloneobject(object)
{
  for(i in object) {
    this[i] = object[i];
  }
} // baz = new cloneobject(bar);
exports.cloneobject = cloneobject;

function sha1(str)
{
  return crypto.createHash('sha1').update(str).digest("hex");
}
exports.sha1 = sha1;

function foreach(array, callback)
{
  for(var k in array) {
    if(typeof array[k] != 'function') {
      callback(k, array[k]);
    }
  }
}
exports.foreach = foreach;

function filestats(filename)
{
  try {
    var stats = fs.lstatSync(filename);
    return stats;
  }
  catch(e) {
    return null;
  }
}
exports.filestats = filestats;

function trim(s){ 
  return ( s || '' ).replace( /^\s+|\s+$/g, '' ); 
}
exports.trim = trim;

var xml_special_to_escaped_one_map = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;'
};

var escaped_one_to_xml_special_map = {
  '&amp;': '&',
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>'
};

function encodexml(string) {
  return string.replace(/([\&"<>])/g, function(str, item) {
  return xml_special_to_escaped_one_map[item];
  });
};
function decodexml(string) {
  return string.replace(/(&quot;|&lt;|&gt;|&amp;)/g,
  function(str, item) {
    return escaped_one_to_xml_special_map[item];
  });
}
exports.encodexml = encodexml;
exports.decodexml = decodexml;