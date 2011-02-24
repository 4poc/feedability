
var entity = require('../lib/entity.js');

// test encoding
exports.testEntityEncoding = function(test) {
  test.expect(8);
  
  // default options:
  test.strictEqual('a&lt;&gt;&apos;&quot;&amp;&ouml;&auml;&uuml;&szlig;b', 
                   entity.encode('a<>\'"&öäüßb'));
  
  // no xml option:
  test.strictEqual('<>\'"&&ouml;&auml;&uuml;&szlig;', 
                   entity.encode('<>\'"&öäüß', {xml: false}));
  
  // no html option
  test.strictEqual('&lt;&gt;&apos;&quot;&amp;öäüß', 
                   entity.encode('<>\'"&öäüß', {html: false}));
  
  // all option
  test.strictEqual('&#60;&#62;&#39;&#34;&#38;&#246;&#228;&#252;&#223;&#97;&#98;&#99;&#100;', 
                   entity.encode('<>\'"&öäüßabcd', {all: true}));
  
  test.strictEqual('&#10004;', entity.encode('✔', {all: true}));
  
  // default options: + numbered
  test.strictEqual('&#60;&#62;&#39;&#34;&#38;&#246;&#228;&#252;&#223;', 
                   entity.encode('<>\'"&öäüß', {numbered: true}));
  
  // no xml option: + numbered
  test.strictEqual('<>\'"&&#246;&#228;&#252;&#223;', 
                   entity.encode('<>\'"&öäüß', {xml: false, numbered: true}));
  
  // no html option + numbered
  test.strictEqual('&#60;&#62;&#39;&#34;&#38;öäüß', 
                   entity.encode('<>\'"&öäüß', {html: false, numbered: true}));

  test.done();
}

// test decoding
exports.testEntityDecoding = function(test) {
  test.expect(4);
  
  // test options:
  test.strictEqual('<öß', entity.decode('&lt;&ouml;&#223;'));
  test.strictEqual('<ö&#223;', entity.decode('&lt;&ouml;&#223;', {numbered: false}));
  test.strictEqual('<&ouml;ß', entity.decode('&lt;&ouml;&#223;', {html: false}));
  test.strictEqual('&lt;öß', entity.decode('&lt;&ouml;&#223;', {xml: false}));
  
  test.done();
}

