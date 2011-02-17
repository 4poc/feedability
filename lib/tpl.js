// a very simple template library:
var fs = require('fs');
var func = require('./func.js'),
    cfg = require('./cfg.js'),
    cache = require('./cache.js');

/**
 * Simple Template Class.
 * 
 * Usage:
 *  var page = new Template('html/index.html');
 *  page.assign('host', '127.0.0.1');
 *  page.render(response);
 */
var Template = function(filename) {
  this.filename = filename;
  this.variables = {};
}
Template.prototype = {
  filename: '',
  variables: {},
  assign: function(name, value) {
    this.variables[name] = value;
  },
  render: function(response) {
    var variables = this.variables;
    fs.readFile(this.filename, function(error, data) {
      if(error) { 
        throw error;
      }
      var content = data.toString();

      func.array_foreach(variables, function(name) {
        content = content.replace('&'+name+';', variables[name]);
      });

      response.writeHead(200, {
        'content-type': 'text/html',
        'server': cfg.get('http_server')['banner']
      });
      response.end(content);
    });
  }
};
exports.Template = Template;

function error(response, message)
{
  console.log('an error occured: '+message);
  var page = new Template('./html/error.html');
  page.assign('message', message);
  page.render(response);
}
exports.error = error;
