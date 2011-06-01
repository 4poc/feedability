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
 * Load cookies from browser database, create Cookie: header based on
 * given url.
 * 
 * @fileOverview
 */

// built in libraries
var uri = require('url'),
    util = require('util');

// internal libraries
var log = new (require('./log.js').Logger)('cookie'),
    func = require('./func.js'),
    cfg = require('./cfg.js');

// external libraries
if(cfg.get('cookies').activate) {
  var sqlite = require('sqlite');
}

// global cookie storage
var cookie_jar = null;

// indicates the finished loading of the cookie jar
exports.loaded = false;

/**
 * Load Cookies from Browser Database/Files
 */
var load = function() {
  var config = cfg.get('cookies');

  if(cookie_jar !== null || !config.activate) {
    log.info('cookie storage load skiped')
    return; // return if already loaded
  }

  log.info('loading cookie storage');

  if(config['type'] == 'firefox_sqlite') {
    var db = new sqlite.Database();
    db.open(config['cookie_jar'], function(error) {
      if(error) {
        log.error('unable to load cookie_sqlite: ' + config['cookie_jar']);
        return;
      }

      var sql = 'SELECT * FROM moz_cookies';
      db.execute(sql, function(error, rows) {
        if(error) {
          log.error('error execute sqlite query: '+error);
          return;
        }

        cookie_jar = [];
        for(var i = 0; i < rows.length; i++) {
          // whitelist configuration, if set (not empty), match with host field 
          if(config.whitelist && config.whitelist.length > 0) {
            var listed = false;
            for(var j = 0; j < config.whitelist.length; j++) {
              if((new RegExp(config.whitelist[j])).test(rows[i].host)) {
                listed = true;
              }
            }
            if(!listed) {
              continue;
            }
          }

          cookie_jar.push({
            name: rows[i].name,
            value: rows[i].value,
            host: rows[i].host,
            path: rows[i].path
          });
          // this ignores isSecure and the expiration time fields
        }

        log.info('loaded ' + cookie_jar.length + ' cookies in the cookie jar');
        exports.loaded = true;

        db.close(function(error) {
          if(error) {
            log.error('error closing database: ' + error);
            return;
          }
          log.debug('database closed.');
        });
      });
    });
  }

};
load();

/**
 * @todo create a regexp escape function (escape . and / etc.)
 */
exports.get = function(url) {
  var cookies = [],
      p_url = uri.parse(url);

  for(var i = 0; i < cookie_jar.length; i++) {
    var cookie = cookie_jar[i];

    // match cookie against host
    if((new RegExp(cookie.host.replace('.', '\\.'))).test(p_url.hostname)) {

      // match cookie path
      if((new RegExp('^'+cookie.path.replace('/', '\\/').replace('.', '\\.'))).test(p_url.pathname)) {

        cookies.push(cookie.name + '=' + cookie.value); // uriescape?  
      
      }
    }
  }

  log.debug('use cookie header: ' + cookies.join('; '), url);

  return cookies.join('; ');
};



