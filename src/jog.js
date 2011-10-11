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

  //!! Make levels actual objects so ==, <=, etc might operate?
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
  $.extend($.jog, levels);
  $.jog.levels = levels;

  var levelNameToNum = {};
  var levelNumToName = {};

  /**
   * The handler base class. Takes care of the config() method and settings
   * field.
   */
  function Handler(name) {
    this.name = name;

    // The method that modifies the configuration fields 
    this.config = function(properties, override) {
      override = override != undefined ? override : false;
      if (!this._settings) {
        this._settings = {};
      }
      if (override) {
        this._settings = $.extend({}, properties);
      } else {
        $.extend(this._settings, properties);
      }
    };
  }

  function newHandler(name, properties) {
    if (!name) return undefined;
    var handler = new Handler(name);
    if (properties) {
      $.extend(handler, properties);
    }
    return handler;
  }

  $.jog.newHandler = newHandler;

  // The popup handler needs the location of this jog.js file so it can find the
  // companion logPopup.html file. The following code is borrowed from
  // http://stackoverflow.com/questions/984510/what-is-my-script-src-url/3865126#3865126
  var scriptDir= (function() {
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

  var baseHandlers = {
    html: newHandler("html", {
      _settings: {
        idPrefix: 'jog',
        classPrefix: 'jog',
        htmlId: undefined, // by default this is generated from idPrefix
        insertHtml: defaultInsertHtml
      },
      publish: function(area, levelNum, level, when, message) {
        this._ensureTable();
        var clsPrefix = this._settings.classPrefix;

        var levelClass = clsPrefix + '-level-' + level;
        var areaClass = clsPrefix + '-area-' + area;
        var row = $('<tr/>').addClass(levelClass).addClass(areaClass);
        row.append($('<td class="' + clsPrefix + '-area"/>').text(area));
        row.append($('<td class="' + clsPrefix + '-level"/>').text(level));
        row.append($('<td class="' + clsPrefix + '-when"/>').text(when));
        row.append($('<td class="' + clsPrefix + '-message"/>').html(message));
        this._tableBody.append(row);
      },
      // Ensure that the table exists, adding it if needed
      _ensureTable: function() {
        if (this._tableBody) return this._tableBody;

        var htmlId = this._settings.htmlId;
        if (!htmlId) {
          htmlId = this._settings.idPrefix + '-html';
        }

        // If the top does not exist, create it and add it
        var top = $('#' + htmlId);
        if (!top || top.length == 0) {
          top = this._settings.insertHtml();
          if (top) {
            top = $(top); // make sure it's JQuery-able
          }
          if (!top || top.length == 0) {
            throw "insertHtml for '" + htmlId + "' returns no node";
          }
          top.attr('id', htmlId);
          top.addClass(this._settings.classPrefix + "-html");
          this._addedTop = top;
        }

        var idPrefix = this._settings.idPrefix;
        var classPrefix = this._settings.classPrefix;

        // common code for some nodes
        function setup(node, suffix) {
          node.addClass(classPrefix + '-' + suffix);
          node.attr('id', idPrefix + '-' + suffix);
          return node;
        }

        var table = setup($('<table/>'), 'table');
        var header = setup($('<tr/>'), 'header');
        header.append($('<th/>').text('Area'));
        header.append($('<th/>').text('Level'));
        header.append($('<th/>').text('When'));
        header.append($('<th/>').text('Message'));

        top.append(table);
        table.append(header);
        this._tableBody = top.find('table > tbody');
        if (!this._addedTop) {
          // If we didn't add the overall top, then we added the table
          this._addedTop = table;
        }
      },
      destroy: function() {
        if (!this._addedTop) return;
        this._addedTop.remove();
        delete this._addedTop;
        delete this._tableBody;
      }
    }),
    popup: newHandler("popup", {
      _settings: {
        title: 'Log Messages',
        css: 'jog.css'
      },
      publish: function(area, levelNum, level, when, message) {
        // The message record for sending logs to the popup window
        var logRecord = {
          area: area,
          levelNum: levelNum,
          level: level,
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
            console.log('bind readyMessage');
            $.pm.bind('readyMessage.jog', function() {
              console.log('got readyMessage');
              self._popup = popup;
              // When the popup has said it's ready, send the settings ...
              console.log('send logOptions');
              $.pm({target: popup, type: "logOptions.jog",
                data: self._settings});
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
        console.log('send logRecord');
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
      }
    }),
    console: newHandler("console", {
      _settings: {
        prefix: '',
        separator: ' - '
      },
      publish: function(area, levelNum, level, when, message) {
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
        console[method](prefix + area + sep + level + sep + when + sep +
            message);
      },
      alert: function(area, levelNum, level, when, message) {
        message = messageText(message);
        alert("Area: " + area + "\n" + "Level: " + level + "\n" + "When: " +
            when + "\n" + "Message: " + message + "\n");
      }
    })
  };
  $.jog.baseHandlers = baseHandlers;

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
  areaRoot.alertLevel(levels.Alert);
  areaRoot.addHandlers(baseHandlers.console);
  areaRoot.toTimeString = defaultTimeFormat;

  // Reliably convert any string or number to its level number, if it has one
  function toLevelNum(level) {
    if (level == undefined) return undefined;
    if (typeof(level) == 'string') {
      // See if it's "12"
      var num = parseInt(level);
      if (!isNaN(num)) {
        return num;
      }
      return levelNameToNum[level.charAt(0)];
    }
    return level;
  }

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

  // Merge a second array of values into the first, eliminating duplicate
  // objects (as opposed to duplicate values, which would be done by
  // $.extend()).
  //
  // There seems to be no easy way to filter out unique//identities*, which
  // have the property of equality but not of order (you can test if x === y,
  // but there is no equivalent of <, <=, etc. that deals with identity). So the
  // usual unique-ing algorithm of "first sort, then eliminate successive
  // duplicates" doesn't work because you can't sort them. So we have to do the
  // merge linearly. Luckily the list of handlers usually has no more than a
  // few members, so this shouldn't explode.
  function addUnique(target, array) {
    nextArrayValue:
        for (var i = 0; i < array.length; i++) {
          var value = array[i];
          for (var j = 0; j < target.length; j++) {
            if (value === target[j]) {
              continue nextArrayValue;
            }
          }
          target.push(value);
        }
  }

  // Removes elements from an array by identity; see addUnique()
  function removeUnique(target, array) {
    for (var i = 0; i < array.length; i++) {
      var value = array[i];
      for (var j = 0; j < target.length; j++) {
        if (value === target[j]) {
          target.splice(j, 1);
          break;
        }
      }
    }
  }

  // The area object represents the behavior of a given area. They are stored
  // for each area, and jog() returns a temporary version that has the current
  // values for an area, including the inherited ones. The methods of this
  // object can be invoked by users directly, so method should be exposed with
  // careful consideration.
  function Area(name) {
    var self = this;

    this.name = name;
    this._handlers = []; // the handlers set specifically on this area
    this._useParentHandlers = true;
    this._lineage = []; // the cumulative area names from root to me (see below)

    this.useParentHandlers = function(value) {
      if (value != undefined) this._useParentHandlers = value;
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
    function buildAreaInfo() {
      // We start at the top (root), and then merge in more and more specific
      // values.
      var info = $.extend(true, {}, areaRoot);
      // $.extend() works for everything but the handlers, which need to be
      // merged by identity. So we handle that ourselves along the way. We
      // start the final list of handlers with a copy of the root handler set
      var handlers = [].concat(areaRoot._handlers);

      for (var i = 0; i < self._lineage.length; i++) {
        var areaName = self._lineage[i];
        var areaInfo = areas[areaName];
        if (areaInfo) {
          $.extend(true, info, areaInfo);
          // If this area cuts off its parent, use only its own handlers
          if (!areaInfo._useParentHandlers) {
            handlers = [];
          }
          // Equivalent to handlers.push(_handlers[0], _handlers[1], ...)
          addUnique(handlers, areaInfo._handlers);
        }
      }

      info._handlers = handlers;
      return info;
    }

    // The actual logging function
    this.log = function(levelSpec, message) {
      var levelNum = toLevelNum(levelSpec);

      // Special case, and not just for speed -- An Off shouldn't be shown
      if (levelNum == levels.Off) return false;

      var areaInfo = buildAreaInfo();
      if (levelNum < areaInfo._level) return false;

      // This is how the user can check if a certain level would be logged
      if (!message) return true;

      var alertLevelNum = areaInfo._alertLevel;

      var handlers = areaInfo._handlers;

      // Generate the messages
      var levelName = levelNumToName[levelNum];
      var when = areaInfo.toTimeString(new Date());
      for (var i = 0; i < handlers.length; i++) {
        var handler = handlers[i];
        handler.publish(this.name, levelNum, levelName, when, message);
        if (levelNum >= alertLevelNum && handler.alert) {
          handler.alert(this.name, levelNum, levelName, when, message);
        }
      }
      return true;
    };

    this.level = function(level) {
      // we check with "arguments.length" because "undefined" is a valid value
      if (arguments.length == 1) this._level = toLevelNum(level);
      return levelNumToName[this._level];
    };

    this.alertLevel = function(level) {
      // we check with "arguments.length" because "undefined" is a valid value
      if (arguments.length == 1) this._alertLevel = toLevelNum(level);
      return levelNumToName[this._alertLevel];
    };

    this.addHandlers = function() {
      addUnique(this._handlers, arguments);
    };

    this.removeHandlers = function() {
      removeUnique(this._handlers, arguments);
    };

    this.handlers = function() {
      if (arguments.length == 0) {
        // return a copy of the current list of handlers
        return [].concat(this._handlers);
      }
      // set the list of handlers
      this._handlers = [];
      this.addHandlers.apply(this, arguments);
    };

    // Function to implement error(), info(), etc.
    function levelNameFunction(levelNum) {
      return function(message) {
        return this.log(levelNum, message);
      }
    }

    // Add functions for levels, (area.error(), area.info(), ...).
    for (levelName in levels) {
      var functionName = levelName.toLowerCase();
      var levelNum = levelNameToNum[levelName];
      this[functionName] = levelNameFunction(levelNum);
    }

    this.destroy = function() {
      for (var i = 0; i < this._handlers.length; i++) {
        var handler = this._handlers[i];
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