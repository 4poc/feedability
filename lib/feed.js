// external libraries
var expat = require('node-expat');

// internal libraries
var utils2 = require('./utils2.js'),
    urlopen = require('./urlopen.js');

var item_elements = utils2.settings['feed_parser']['item_elements'];
var remove_elements = utils2.settings['feed_parser']['remove_elements'];

/**
 * Fetch a feed by url, parse it and create new xml string.
 * 
 * This method fetches the url using urlopen and parses the feed xml 
 * using expat. It creates a new string with the feeds xml. This method
 * removes certain elements with article excerpts (settings.json) and
 * creates a new description element with an pseudo entity: 
 *   &replaceurl:<SHA1 of article url>;
 * after that the finished callback is called. If an error occured the
 * error callback is called.
 * 
 * TODO: use libxmljs or something like that instead of expat
 */
function parse(feed_url, callbacks)
{
  // fetching the feed
  urlopen.fetch(feed_url, {
    data: function(data) {
      var xml = ''; // the resulting feed string
      var type = null; // should be either rss or atom
      var ign = false; // ignore an element until endElement
      var root = null; // root toplevel element of the feed rss/feed
      var incdata = false; // set to true within cdata
      var articles = [];
      var textcue = '';
      var itemelm = false; // set to true within item elements
      var itemurl = null; // save the last link url of a item
      var itemurlelm = false; // within an link element
      
      var xml_parser = new expat.Parser('utf-8');
      xml_parser.addListener('startElement', function(name, attrs) {
        if(!root) {
          if(name == 'feed' || name == 'rss') {
            root = name;
            
            if(name == 'feed') {
              type = 'atom';
            }
            else {
              type = 'rss';
            }
            console.log('start parsing '+type+' feed');
          }
          else { // the root element should be feed or rss for atom/rss feeds
            callbacks.error('Unable to parse the feed. Toplevel element '+
                            'should be feed or rss.');
            return;
          }
        }
   
        // mark the elements as item
        if(utils2.inarray(item_elements, name)) itemelm = true;
        
        // ignore the remove elements
        if(itemelm && utils2.inarray(remove_elements, name)) ign = true;
        
        if(itemelm && name == 'link') {
          if(attrs['href']) { // <link href="[itemurl]" />
            itemurl = attrs['href'];
          }
          else { // <link>[itemurl]</link>
            itemurlelm = true;
          }
        }
                             
        if(!ign) {
          xml += '<'+name;
          utils2.foreach(attrs, function(attr_name) {
            xml += ' '+attr_name+'="'+utils2.encodexml(attrs[attr_name])+'"';
          }); xml += '>';
        }
      });
      
      // End Elements </entry> etc.
      xml_parser.addListener('endElement', function(name) {
        if(textcue != '') {
          textcue = utils2.trim(textcue);
          xml += textcue;
          if(itemurlelm && name == 'link') {
            itemurl = utils2.decodexml(textcue);
            itemurlelm = false;
          }
          textcue = '';
        }

        // the end of an item element </item> </entry>
        if(itemelm && utils2.inarray(item_elements, name)) {
          console.log('found item link: '+itemurl);
          articles.push(itemurl);
          
          if(type == 'atom') xml += '<content type="html">';
          else xml += '<content:encoded>';
          xml += '<![CDATA[&replaceurl:'+utils2.sha1(itemurl)+';]]>';
          if(type == 'atom') xml += '</content>';
          else xml += '</content:encoded>';
        }
                             
        if(!ign) {
          xml += '</'+name+'>\n';
        }
        
        if(itemelm && utils2.inarray(remove_elements, name)) ign = false;
        
        if(utils2.inarray(item_elements, name)) itemelm = false;

        // the endelement of the toplevel feed element ends the parsing
        if(root == name) {
          var feedxmlmime = null;
          if(type == 'atom') {
            feedxmlmime = 'application/atom+xml';
          }
          else {
            feedxmlmime = 'text/xml';
          }
          callbacks.finished(xml, feedxmlmime, articles);
        }
      });
      xml_parser.addListener('text', function(text) {        
        if(!incdata) {
          text = utils2.encodexml(text);
        }

        if(!ign) {
          textcue += text;
        }
      });
      
      // XML Declaration
      xml_parser.addListener('xmlDecl', function(version, encoding, s) {
        xml += '<?xml version="'+version+'" encoding="utf-8"?>\n';
      });
      
      // CData Block
      xml_parser.addListener('startCdata', function() {
        incdata = true;
        if(!ign) {
          xml += '<![CDATA[';
        }
      });
      
      // CData Block
      xml_parser.addListener('endCdata', function() {
        incdata = false;
        if(!ign) {
          xml += ']]>';
        }
      });
      
      xml_parser.parse(data, true);
    },
    error: callbacks.error
  });
}
exports.parse = parse;
