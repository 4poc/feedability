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
console.log('Feedability : NodeJS Feed Proxy With Readability');

/**
 * Core module for startup and shutdown of the feedability HTTP server.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    http = require('http'),
    util = require('util');

// internal libraries
var cfg = require('./lib/cfg.js'),
    log = new (require('./lib/log.js').Logger)('core'),
    func = require('./lib/func.js'),
    ProxyRequest = require('./lib/proxy.js').ProxyRequest;

// some variables used for the http server
var bind = cfg.get('proxy')['bind'];
var port = cfg.get('proxy')['port'];

// create the http server with the feed proxy
http.createServer(function(request, response) {

  try {
    var proxy_request = new ProxyRequest(request, response);
    proxy_request.process();    
  }
  catch(exception) {
    log.error('proxy request exception: '+exception);
  }

}).listen(port, bind);
console.log('http server listening on '+bind+' port '+port);
console.log('open a browser and try: http://127.0.0.1:'+port+'/\n');

