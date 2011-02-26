
var urlopen = require('../lib/urlopen.js');

exports.testDetectContentType = function(test) {
  test.expect(8);

  test.deepEqual(
    { header: 'image/png; charset=utf-8',
      mime: 'image/png',
      charset: 'utf-8',
      binary: true },
    urlopen.detectContentType('...', 'image/png'));

  test.deepEqual(
    { header: 'text/html; charset=iso-8859-4',
      mime: 'text/html',
      charset: 'iso-8859-4',
      binary: false },
    urlopen.detectContentType('<html></html>', 'text/html; charset=ISO-8859-4'));

  // test fallbacks
  test.deepEqual(
    { header: 'text/plain; charset=utf-8',
      mime: 'text/plain',
      charset: 'utf-8',
      binary: false },
    urlopen.detectContentType('<html></html>', null));

  // html charset detection (html4)
  test.deepEqual(
    { header: 'text/html; charset=iso-8859-1',
      mime: 'text/html',
      charset: 'iso-8859-1',
      binary: false },
    urlopen.detectContentType('<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" /></head></html>', 'text/html'));
  
  // html charset detection (html5)
  test.deepEqual(
    { header: 'text/html; charset=iso-8859-1',
      mime: 'text/html',
      charset: 'iso-8859-1',
      binary: false },
    urlopen.detectContentType('<html><head><meta charset="iso-8859-1"></head></html>', 'text/html'));
  
  // xml declaration charset detection
  test.deepEqual(
    { header: 'text/xml; charset=iso-8859-1',
      mime: 'text/xml',
      charset: 'iso-8859-1',
      binary: false },
    urlopen.detectContentType('<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>', 'text/xml'));
  
  // rss feed detection
  test.deepEqual(
    { header: 'application/rss+xml; charset=iso-8859-1',
      mime: 'application/rss+xml',
      charset: 'iso-8859-1',
      binary: false },
    urlopen.detectContentType('<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>\n<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">\n<channel></channel>\n</rss>\n\n', 'text/xml'));
  
  // atom feed detection
  test.deepEqual(
    { header: 'application/atom+xml; charset=iso-8859-1',
      mime: 'application/atom+xml',
      charset: 'iso-8859-1',
      binary: false },
    urlopen.detectContentType('<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>\n<feed>\n</feed>\n\n', 'text/xml'));
  
  
  test.done();
}

/**
 * Detect Content-Type on various factors
 * 
 * In most cases the web server already returns a content-type,
 * but that value may not be accurate. This method detects the
 * xml formats atom and rss and the xml and html charset 
 * attributes. The returned object looks like:
 * <pre>
 * {
 *   header: "text/html; charset=ISO-8859-4",
 *   mime: "text/html",
 *   charset: "ISO-8859-4",
 *   binary: false // assume binary content
 * }
 * </pre>
 * 
 * @param headers of request may include content-type
 * @param buffer or string with file contents
 * @return object with content type string, mime and charset
 */


urlopen.open('http://apoc.cc/encoding_test.php?charset=iso',
// 'http://www.giessener-allgemeine.de/Home/Stadt/Uebersicht/Artikel,-Protest-gegen-Verkauf-des-Parkhauses-Roonstrasse-_arid,242093_regid,1_puid,1_pageid,113.html', 
// http://www.giessener-allgemeine.de/cms_media/xml/7_az_stadt.xml', //'http://apoc.cc/encoding_test.php?charset=s',
// http://www.spiegel.de/politik/ausland/0,1518,747173,00.html',
// http://apoc.cc/encoding_test.php?charset=utf8',
// http://feeds.guardian.co.uk/theguardian/rss
// http://www.spiegel.de/netzwelt/gadgets/0,1518,722478,00.html',
// http://apoc.cc/encoding_test.php?charset=utf8', // #'utf8',
  function(error, content, response) {
    console.log(error);
    console.log(content);
    console.log(typeof content);
    console.log(typeof response);
  }
);
