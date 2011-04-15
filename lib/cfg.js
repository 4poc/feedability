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
 * Module provides methods for accessing the json based configuration
 * settings.
 * 
 * @fileOverview
 */

// built in libraries
var fs = require('fs'),
    util = require('util');

// external libraries
var func = require('./func.js');

var settings = null;

// load the configuration settings
function load() {
  if(settings == null) {
    console.log('[load settings.json file]');
    settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
    if(func.file_exists('user_settings.json')) {
      console.log('[found and load the user_settings.json file]');
      var user_settings = JSON.parse(
        fs.readFileSync('user_settings.json', 'utf8')
      );

      settings = func.object_merge(settings, user_settings);
    }
    
    // merge log settings:
    var Logger = require('./log.js').Logger;
    if(settings.log) {
      Logger.merge_options(settings.log);
    }
    var log = new Logger('cfg');
    log.info('configuration options merged');
  }
}
load();

function get(key) {
  return settings[key];
}
exports.get = get;
