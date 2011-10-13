/*
 * The MIT License
 *
 * Copyright (c) 2011 Ken Arnold
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function($) {
  $.jog = jog;

  var n = 0;
  //noinspection JSUnusedGlobalSymbols
  var levels = {
    Fine: n++,
    Debug: n++,
    Info: n++,
    Config:n++,
    Warning:n++,
    Severe: n++,
    Alert: n++,
    Off: n++
  };
  $.extend($.jog, levels);  // create $.jog.Info, etc.
  $.jog.levels = levels;    // create $.jog.levels.Info, etc.

  var levelNameToNum = {};
  var levelNumToName = {};

  var uniqueIdSequence = 0;

  function newUniqueId(name) {
    var time = new Date().getTime();
    var random = Math.random().toPrecision(21);
    var sequence = uniqueIdSequence++;
    return name + ':' + time + ':' + random + ':' + sequence;
  }

  /**
   * The handler base class. Takes care of the config() method and settings
   * field.
   */
  function Handler(name) {
    this.name = name;

    this._handlerId = newUniqueId(name);
    this._settings = {};

    // The method that modifies the configuration fields 
    this.config = function(properties, replace) {
      replace = replace != undefined ? replace : false;
      if (properties) {
        if (replace) {
          this._settings = {};
        }
        $.extend(this._settings, properties);
      }
      return $.extend({}, this._settings);
    };

    this.copy = function(name) {
      name = name || this.name + 'Copy';
      var dup = $.extend(true, {}, this);
      dup._handlerId = newUniqueId(name);
      if (this.copyCleanup) {
        this.copyCleanup(dup);
      }
      return dup;
    };

    this.level = function(level) {
      if (level != undefined) this._settings.level = level;
      return this._settings.level;
    }
  }

  function newHandler(name, properties) {
    if (!name) return undefined;
    var handler = new Handler(name);
    if (!properties) {
      throw new Error("Property object must be specified");
    }
    if (typeof(properties.publish) != 'function') {
      throw new Error("Handler must have a publish() method");
    }
    $.extend(handler, properties);
    return handler;
  }

  $.jog.newHandler = newHandler;

  // The popup handler needs the location of this jog.js file so it can find the
  // companion logPopup.html file. The following code is borrowed from
  // http://stackoverflow.com/questions/984510/what-is-my-script-src-url/3865126#3865126
  var scriptDir = (function() {
    var scripts = document.getElementsByTagName('script'),
        script = scripts[scripts.length - 1];

    return script.getAttribute('src', 2).replace(/\/+[^/]*\/*$/, '/');
    //this works in all browser even in FF/Chrome/Safari
  }());

  // The function used by default to insert a container for the log table
  function defaultInsertHtml() {
    var top = $('<div/>');
    $(document.body).append(top);
    return top;
  }

  var knownHandlers = {
    html: newHandler("html", {
      _settings: {
        idPrefix: 'jog',
        classPrefix: 'jog',
        htmlId: undefined, // by default this is generated from idPrefix
        insertHtml: defaultInsertHtml
      },
      publish: function(area, levelNum, levelName, when, message) {
        this._ensureTable();
        var clsPrefix = this._settings.classPrefix;

        var levelClass = clsPrefix + '-level-' + levelName;
        var row = $('<tr/>').addClass(levelClass);
        var areaParts = area.split('.');
        var lineage = '';
        for (var i = 0; i < areaParts.length; i++) {
          lineage += '-' + areaParts[i];
          var areaClass = clsPrefix + '-area' + lineage;
          row.addClass(areaClass);
        }
        row.append($('<td class="' + clsPrefix + '-area"/>').text(area));
        row.append($('<td class="' + clsPrefix + '-level"/>').text(levelName));
        row.append($('<td class="' + clsPrefix + '-when"/>').text(when));
        row.append($('<td class="' + clsPrefix + '-message"/>').html(message));
        this._tableBody.append(row);
      },
      // Ensure that the table exists, adding it if needed
      _ensureTable: function() {
        if (this._tableBody) return this._tableBody;

        var idPrefix = this._settings.idPrefix;
        var classPrefix = this._settings.classPrefix;

        var htmlId = this._settings.htmlId;
        if (!htmlId) {
          htmlId = idPrefix + '-html';
        }

        // If the top does not exist, create it and add it
        var top = $('#' + htmlId);
        if (!top || top.length == 0) {
          top = this._settings.insertHtml();
          if (top) {
            top = $(top); // make sure it's JQuery-able
          }
          if (!top || top.length == 0) {
            throw Error("insertHtml for '" + htmlId + "' returns no node");
          }
          top.attr('id', htmlId);
          this._addedTop = top;
        }
        top.addClass(classPrefix + "-html");

        // If the table already exists, then use it. This typically would only
        // happen if two differently-configured html publishers were writing to
        // the same table; if so, the second one would see the table already
        // existing. I don't recommend that people build pages with this already
        // set up themselves, so I don't document this behavior -- it's internal
        // and subject to change.
        var tableId = idPrefix + '-' + 'table';
        var table = $('#' + tableId);
        if (!table || table.length == 0) {
          // common code for some nodes
          function setup(node, suffix) {
            node.addClass(classPrefix + '-' + suffix);
            node.attr('id', idPrefix + '-' + suffix);
            return node;
          }

          table = setup($('<table/>'), 'table');
          var header = setup($('<tr/>'), 'header');

          function headerCell(colName) {
            var cell = $('<th/>');
            cell.text(colName);
            cell.attr('id', idPrefix + '-' + colName.toLowerCase());
            header.append(cell);
          }

          headerCell('Area');
          headerCell('Level');
          headerCell('When');
          headerCell('Message');

          top.append(table);
          table.append(header);
          if (!this._addedTop) {
            // If we didn't add the top, the top-most thing added is the table
            this._addedTop = table;
          }
        }
        this._tableBody = top.find('table > tbody');
      },
      destroy: function() {
        if (!this._addedTop) return;
        this._addedTop.remove();
        this.cleanupCopy();
        delete this._addedTop;
        delete this._tableBody;
      },
      cleanupCopy: function() {
        delete this._addedTop;
        delete this._tableBody;
      }
    }),
    popup: newHandler("popup", {
      _settings: {
        title: 'Log Messages',
        css: 'jog.css'
      },
      publish: function(area, levelNum, levelName, when, message) {
        // The message record for sending logs to the popup window
        var logRecord = {
          area: area,
          levelNum: levelNum,
          levelName: levelName,
          when: when,
          message: message
        };

        // If the window is already up and ready, send it the new log
        if (this._windowReady) {
          this._sendLog(logRecord);
        } else {
          // If the "pending" list doesn't exist, this is the first log, so
          // we want to get the popup window started. this.pending holds all log
          // messages that arrive before the popup window is ready to take them.
          if (!this._pending) {
            this._pending = [];
            var self = this;
            var popup;
            // Listen for 'readyMessage' event the popup uses to say it's ready
            $.pm.bind('readyMessage.jog', function() {
              self._popup = popup;
              // When the popup has said it's ready, send the settings ...
              $.pm({
                target: popup,
                type: "logOptions.jog",
                data: self._settings
              });
              // ... and then send all pending messages
              self._consumePending();
            });
            // Now that we're ready to receive the 'ready' message, pop it up
            popup = window.open(scriptDir + "jogPopup.html", "Log");
          }
          // Put the log message in the pending queue until the popup is ready
          this._pending.push(logRecord);
        }
      },
      _consumePending: function() {
        this._windowReady = true;
        while (this._pending.length > 0) {
          var logRecord = this._pending.shift();
          this._sendLog(logRecord);
        }
      },
      _sendLog: function(logRecord) {
        // send a log message to the popup for it to display
        $.pm({
          target: this._popup,
          type: "logRecord.jog",
          data: logRecord
        });
      },
      destroy: function() {
        if (!this._popup) return;
        this._popup.close();
        $.pm.unbind('.jog');
        delete this._popup;
        delete this._windowReady;
        delete this._pending;
      },
      cleanupCopy: function() {
        throw Error("Popup handler not ready (yet) for multiple copies");
      }
    }),
    console: newHandler("console", {
      _settings: {
        prefix: '',
        separator: ' - '
      },
      publish: function(area, levelNum, levelName, when, message) {
        if (!this._levelMethod) {
          this._levelMethod = [];
          this._levelMethod[levels.Fine] = "debug";
          this._levelMethod[levels.Debug] = "debug";
          this._levelMethod[levels.Info] = "info";
          this._levelMethod[levels.Warning] = "warn";
          this._levelMethod[levels.Config] = "warn";
          this._levelMethod[levels.Severe] = "error";
          this._levelMethod[levels.Alert] = "error";
        }
        var prefix = this._settings.prefix;
        if (!prefix) prefix = '';
        if (prefix.length > 0) prefix += ':';
        message = messageText(message);
        var sep = this._settings.separator;
        var method = this._levelMethod[levelNum];
        if (!method || !console[method]) {
          method = "log";
        }
        console[method](prefix + area + sep + levelName + sep + when + sep +
            message);
      }
    }),
    alert: newHandler("alert", {
      _settings: {
        level: levels.Alert
      },
      publish: function(area, levelNum, levelName, when, message) {
        message = messageText(message);
        alert("Area: " + area + "\n" + "Level: " + levelName + "\n" + "When: " +
            when + "\n" + "Message: " + message + "\n");
      }
    })
  };
  $.jog.knownHandlers = knownHandlers;

  // Convert a message to just its text
  function messageText(message) {
    // If it's HTML, extract the text part
    return $('<span>' + message + '</span>').text();
  }

  // The default time format
  function defaultTimeFormat(when) {
    return when.toLocaleTimeString();
  }

  // Create the name-to-number and number-to-name maps
  for (var levelName in levels) {
    var levelNum = levels[levelName];

    levelNumToName[levelNum] = levelName;

    var ch = levelName.charAt(0);
    levelNameToNum[levelName] = levelNum;
    levelNameToNum[levelName.toUpperCase()] = levelNum;
    levelNameToNum[levelName.toLowerCase()] = levelNum;
    levelNameToNum[ch.toUpperCase()] = levelNum;
    levelNameToNum[ch.toLowerCase()] = levelNum;
  }

  // Set up the root of all areas, and thereby the default area settings
  var areas = {};
  var areaRoot = new Area('');
  areaRoot.level(levels.Info);
  areaRoot.handlers(knownHandlers.console, knownHandlers.alert);
  areaRoot.toTimeString = defaultTimeFormat;

  // Reliably convert any string or number to its level number, if it has one
  function toLevelNum(level) {
    if (typeof(level) == 'number') {
      if (level >= levels.Fine && level <= levels.Off) {
        return level;
      }
      throw new Error("Level out of range Fine..Off (" + levels.Fine + ".." +
          levels.Off + ")");
    }

    // Undefined is sometimes a reasonable value (and we'll accept null)
    if (!level) return undefined;

    if (typeof(level) == 'object') {
      level = level.toString();
    }

    if (typeof(level) == 'string') {
      // See if it's "3", etc.
      var num = parseInt(level);
      if (!isNaN(num)) {
        // This enforces the validity check for numbers
        return toLevelNum(num);
      }
      num = levelNameToNum[level.charAt(0)];
      if (num == undefined) {
        throw new Error("Invalid level name: '" + level + "'");
      }
      return num;
    }
    throw Error("Invalid level specifier type: " + typeof(level));
  }

  // Reliably convert any string or number to its level name, if it has one
  function toLevelName(level) {
    var levelNum = toLevelNum(level);
    return levelNumToName[levelNum];
  }

  $.jog.levelName = toLevelName;

  // Return the object that represents an area
  function jog(area) {
    if (!area)
      return areaRoot;

    var areaInfo = areas[area];
    if (!areaInfo) {
      areaInfo = new Area(area);
      areas[area] = areaInfo;
    }
    return areaInfo;
  }

  // The area object represents the behavior of a given area. They are stored
  // for each area, and jog() returns a temporary version that has the current
  // values for an area, including the inherited ones. The methods of this
  // object can be invoked by users directly, so method should be exposed with
  // careful consideration.
  function Area(name) {
    var self = this;

    this.name = name;
    this._handlers = {}; // the handlers set specifically on this area
    this._useParentHandlers = true;
    this._lineage = []; // the cumulative area names from root to me (see below)

    function notDerived() {
      if (self._isDerived) throw Error("Operation not allowed on derived area");
    }

    this.useParentHandlers = function(value) {
      if (value != undefined) {
        notDerived();
        this._useParentHandlers = value;
      }
      return this._useParentHandlers;
    };

    // Calculate this area's lineage (except for root, which is
    // implicit). This sets the _lineage field to a series of names, from
    // the top down through this area. For example, for the area "x.y.z",
    // _lineage would have ["x", "x.y", "x.y.z"].
    (function() {
      var parts = name.split(/\./);
      for (var i = 0; i < parts.length; i++) {
        if (i == 0) {
          self._lineage.push(parts[i]);
        } else {
          self._lineage.push(self._lineage[i - 1] + '.' + parts[i]);
        }
      }
    })();

    // Build up the current settings for the area by extending values from
    // ancestors.
    //
    // This is done on the fly for each log message. It could be calculated
    // only if there has been an ancestor changed. That would be faster, but
    // maybe not worth the complexity. (something like how swing components
    // invalidate their layout and those of their descendants if they are
    // changed, and then are recalculated if they are needed but invalid.)
    this.derive = function() {
      // We start at the top (root), and then merge in more and more specific
      // values.
      var info = $.extend(true, {}, areaRoot);
      info._isDerived = true;

      for (var i = 0; i < this._lineage.length; i++) {
        var areaName = this._lineage[i];
        var areaInfo = areas[areaName];
        if (areaInfo) {
          // If this area cuts off its parent, use only its own handlers
          if (!areaInfo._useParentHandlers) {
            info._handlers = {};
          }
          $.extend(true, info, areaInfo);
        }
      }
      return info;
    };

    // The actual logging function
    this.log = function(level, message) {
      var levelNum = toLevelNum(level);

      // Special case, and not just for speed -- An Off shouldn't be shown
      if (levelNum == levels.Off) return false;

      var derived = (this._isDerived ? this : this.derive());
      if (levelNum < derived._level) return false;

      // This is how the user can check if a certain level would be logged
      if (!message) return true;

      notDerived();
      
      // Resolve the message into a simple string so we do it exactly once
      if (typeof(message) == 'function') {
        message = message();
      }
      if (typeof(message) == 'object') {
        message = message.toString();
      }

      // Generate the messages
      var levelName = levelNumToName[levelNum];
      var when = derived.toTimeString(new Date());
      for (var id in derived._handlers) {
        var handler = derived._handlers[id];
        var handlerLevel = handler._settings.level;
        if (!handlerLevel || handlerLevel <= levelNum) {
          handler.publish(this.name, levelNum, levelName, when, message);
        }
      }
      return true;
    };

    this.level = function(level) {
      // we check with "arguments.length" because "undefined" is a valid value
      if (arguments.length == 1) {
        notDerived();
        this._level = toLevelNum(level);
      }
      return this._level;
    };

    this.addHandlers = function() {
      notDerived();
      for (var i = 0; i < arguments.length; i++) {
        var handler = arguments[i];
        this._handlers[handler._handlerId] = handler;
      }
    };

    this.removeHandlers = function() {
      notDerived();
      for (var i = 0; i < arguments.length; i++) {
        var handler = arguments[i];
        delete this._handlers[handler._handlerId];
      }
    };

    this.handlers = function() {
      if (arguments.length != 0) {
        notDerived();
        // set the list of handlers
        this._handlers = {};
        this.addHandlers.apply(this, arguments);
      }
      var current = [];
      for (var id in this._handlers) {
        current.push(this._handlers[id]);
      }
      return current;
    };

    // Function to implement error(), info(), etc.
    function levelNameFunction(levelNum) {
      return function(message) {
        return this.log(levelNum, message);
      }
    }

    // Add functions for levels, (area.error(), area.info(), ...).
    for (levelName in levels) {
      // Don't create off() function
      if (levelName == 'Off') continue;
      var functionName = levelName.toLowerCase();
      var levelNum = levelNameToNum[levelName];
      this[functionName] = levelNameFunction(levelNum);
    }

    this.destroy = function() {
      notDerived();
      for (var id in this._handlers) {
        var handler = this._handlers[id];
        if (handler.destroy) {
          handler.destroy();
        }
      }
    }
  }

  function destroy() {
    for (var areaName in areas) {
      var areaInfo = areas[areaName];
      areaInfo.destroy();
    }
    areaRoot.destroy();
  }

  $.jog.destroy = destroy;

})(jQuery);
