
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

