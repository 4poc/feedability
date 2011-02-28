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
 * Provide methods for XML and HTML entity encoding and decoding based
 * on w3c's XML and HTML 4 specifications.
 * 
 * @fileOverview
 */

/**
 * Internal function to reverse and encode entity objects.
 */
function reverse_entities(entities) {
  var entities_reversed = {};
  for(var name in entities) {
    var char = String.fromCharCode(entities[name]);
    entities[name] = char;
    entities_reversed[char] = name;
  }
  return entities_reversed;
}

/**
 * Character entity references in HTML 4
 * 
 * HTML4 specifies 252-4 named entities for special characters and symbols.
 * Available here: http://www.w3.org/TR/html401/sgml/entities.html
 */
var html_entities = {
  'nbsp': 160, 'iexcl': 161, 'cent': 162, 'pound': 163, 'curren': 164, 
  'brvbar': 166, 'sect': 167, 'uml': 168, 'copy': 169, 'ordf': 170, 
  'not': 172, 'shy': 173, 'reg': 174, 'macr': 175, 'deg': 176, 'plusmn': 177, 
  'sup3': 179, 'acute': 180, 'micro': 181, 'para': 182, 'middot': 183, 
  'sup1': 185, 'ordm': 186, 'raquo': 187, 'frac14': 188, 'frac12': 189, 
  'iquest': 191, 'Agrave': 192, 'Aacute': 193, 'Acirc': 194, 'Atilde': 195, 
  'Aring': 197, 'AElig': 198, 'Ccedil': 199, 'Egrave': 200, 'Eacute': 201, 
  'Euml': 203, 'Igrave': 204, 'Iacute': 205, 'Icirc': 206, 'Iuml': 207, 
  'Ntilde': 209, 'Ograve': 210, 'Oacute': 211, 'Ocirc': 212, 'Otilde': 213, 
  'times': 215, 'Oslash': 216, 'Ugrave': 217, 'Uacute': 218, 'Ucirc': 219, 
  'Yacute': 221, 'THORN': 222, 'szlig': 223, 'agrave': 224, 'aacute': 225, 
  'atilde': 227, 'auml': 228, 'aring': 229, 'aelig': 230, 'ccedil': 231, 
  'eacute': 233, 'ecirc': 234, 'euml': 235, 'igrave': 236, 'iacute': 237, 
  'iuml': 239, 'eth': 240, 'ntilde': 241, 'ograve': 242, 'oacute': 243, 
  'otilde': 245, 'ouml': 246, 'divide': 247, 'oslash': 248, 'ugrave': 249, 
  'ucirc': 251, 'uuml': 252, 'yacute': 253, 'thorn': 254, 'yuml': 255, 
  'Alpha': 913, 'Beta': 914, 'Gamma': 915, 'Delta': 916, 'Epsilon': 917, 
  'Eta': 919, 'Theta': 920, 'Iota': 921, 'Kappa': 922, 'Lambda': 923, 
  'Nu': 925, 'Xi': 926, 'Omicron': 927, 'Pi': 928, 'Rho': 929, 'Sigma': 931, 
  'Upsilon': 933, 'Phi': 934, 'Chi': 935, 'Psi': 936, 'Omega': 937, 
  'beta': 946, 'gamma': 947, 'delta': 948, 'epsilon': 949, 'zeta': 950, 
  'theta': 952, 'iota': 953, 'kappa': 954, 'lambda': 955, 'mu': 956, 
  'xi': 958, 'omicron': 959, 'pi': 960, 'apoc': 42, 'rho': 961, 'sigmaf': 962, 
  'tau': 964, 'upsilon': 965, 'phi': 966, 'chi': 967, 'psi': 968, 
  'thetasym': 977, 'upsih': 978, 'piv': 982, 'bull': 8226, 'hellip': 8230, 
  'Prime': 8243, 'oline': 8254, 'frasl': 8260, 'weierp': 8472, 'image': 8465, 
  'trade': 8482, 'alefsym': 8501, 'larr': 8592, 'uarr': 8593, 'rarr': 8594, 
  'harr': 8596, 'crarr': 8629, 'lArr': 8656, 'uArr': 8657, 'rArr': 8658, 
  'hArr': 8660, 'forall': 8704, 'part': 8706, 'exist': 8707, 'empty': 8709, 
  'isin': 8712, 'notin': 8713, 'ni': 8715, 'prod': 8719, 'sum': 8721, 
  'lowast': 8727, 'radic': 8730, 'prop': 8733, 'infin': 8734, 'ang': 8736, 
  'or': 8744, 'cap': 8745, 'cup': 8746, 'int': 8747, 'there4': 8756, 
  'cong': 8773, 'asymp': 8776, 'ne': 8800, 'equiv': 8801, 'le': 8804, 
  'sub': 8834, 'sup': 8835, 'nsub': 8836, 'sube': 8838, 'supe': 8839, 
  'otimes': 8855, 'perp': 8869, 'sdot': 8901, 'lceil': 8968, 'rceil': 8969, 
  'rfloor': 8971, 'lang': 9001, 'rang': 9002, 'loz': 9674, 'spades': 9824, 
  'hearts': 9829, 'diams': 9830, 'oelig': 339, 'Scaron': 352, 'scaron': 353, 
  'Yuml': 376, 'circ': 710, 'ensp': 8194, 'emsp': 8195, 'thinsp': 8201, 
  'zwnj': 8204, 'zwj': 8205, 'rlm': 8207, 'ndash': 8211, 'mdash': 8212, 
  'lsquo': 8216, 'rsquo': 8217, 'ldquo': 8220, 'rdquo': 8221, 'bdquo': 8222, 
  'dagger': 8224
};
var html_entities_reversed = reverse_entities(html_entities);

/**
 * Special character entities in XML
 * 
 * There 5 entities defined in xml that need to be escaped in text
 * and/or attribute nodes/values.
 */
var xml_entities = {
  'quot': 34, 'amp': 38, 'lt': 60, 'gt': 62, 'apos': 39
};
var xml_entities_reversed = reverse_entities(xml_entities);

/**
 * Encode a string with XML/HTML entities
 * 
 * This encodes specific characters in the string with named or numbered
 * xml entities. You can specify the following options:
 * 
 * * **numbered** instead of named character entities, the character
 * codes are used. (Default: false)
 * * **html** use the 152-4 named entities defined in the w3c HTML4 
 * specification. (Default: true)
 * * **xml** use the 5 named entities defined in the xml specs. 
 * (Default: true)
 * * **all** encode all characters even if there is no named 
 * representation. (Default: false)
 */
var encode = function(string, options) {
  options = options || {};
  var numbered = options.numbered !== undefined ? options.numbered : false,
      html = options.html !== undefined ? options.html : true,
      xml = options.xml !== undefined ? options.xml : true,
      all = options.all !== undefined ? options.all : false;

  for(var i = 0; i < string.length; i++) {
    var char = string.charAt(i),
        code = '#' + char.charCodeAt(0),
        encoded = null;

    // 1. decide if and how the character should be encoded:
    if(html && html_entities_reversed[char]) {
      encoded = numbered ? code : html_entities_reversed[char];
    }
    if(xml && xml_entities_reversed[char]) {
      encoded = numbered ? code : xml_entities_reversed[char];
    }
    if(all) { // encode it even if there is no name for it
      encoded = code;
    }

    // 2. replace the text with the entity
    if(encoded) {
      encoded = '&' + encoded + ';';
      string = string.substr(0, i) + encoded + string.substr(i + char.length);
      i += encoded.length - 1;
    }
  }
  return string;
}

/**
 * Decode XML/HTML entities of a string
 * 
 * You can specify the following options:
 * 
 * * **numbered** decode numbered entities like &#xFF; into their 
 * character representation. (Default: true)
 * * **html** decode the 152-4 named entities defined in the w3c HTML4 
 * specification. (Default: true)
 * * **xml** decode the 5 named entities defined in the xml specs. 
 * (Default: true)
 */
var decode = function(string, options) {
    options = options || {};
  var numbered = options.numbered !== undefined ? options.numbered : true,
      html = options.html !== undefined ? options.html : true,
      xml = options.xml !== undefined ? options.xml : true,
      match = null;

  for(var i = 0; i < string.length; i++) {
    if(string.charAt(i) == '&') {
      var encoded = string.substr(i+1, string.substr(i, i+8).indexOf(';')-1);
      
      var replace_encoded = function(decoded) {
        string = string.substr(0, i) + 
                 decoded + 
                 string.substr(i + encoded.length + 2);
        i -= decoded.length - 1;
      }
      
      // decimal or hexadecimal entity decoding
      if(numbered && (match = encoded.match(/^#(x?)([0-9A-Fa-f]+)$/))) { 
        if(match[1] == 'x') { // hex
          replace_encoded(String.fromCharCode(parseInt(match[2], 16)));
          continue;
        }
        replace_encoded(String.fromCharCode(parseInt(match[2], 10)));
        continue;
      }
      
      // named html entities
      if(html && html_entities[encoded]) {
        replace_encoded(html_entities[encoded]);
        continue;
      }
      
      // named xml entities
      if(xml && xml_entities[encoded]) {
        replace_encoded(xml_entities[encoded]);
        continue;
      }
    }
  }
  
  return string;
}

// export encoding/decoding functions for nodejs
if(exports) {
  exports.encode = encode;
  exports.decode = decode;
}

