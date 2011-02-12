// a very simple template library:
var fs = require('fs');
var utils2 = require('./utils2.js');

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

      utils2.foreach(variables, function(name) {
        content = content.replace('&'+name+';', variables[name]);
      });

      response.writeHead(200, {
        'content-type': 'text/html',
        'server': utils2.settings['http_server']['banner']
      });
      response.end(content);
    });
  }
};
exports.Template = Template;

function error(response, message)
{
  console.log('--[ An Error Occured: '+message);
  var page = new Template('./html/error.html');
  page.assign('message', message);
  page.render(response);
}
exports.error = error;
