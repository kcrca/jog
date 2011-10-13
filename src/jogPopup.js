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

var _settings;

$(document).ready(function() {
  $.pm.bind('logOptions.jog', handleLogOptions);
  $.pm.bind('logRecord.jog', handleLogRecord);
  $.pm({target: window.opener, type: 'readyMessage.jog', data: {}});
});

function handleLogOptions(data) {
  var merged = $.extend({}, _settings, data.settings);
  for (var key in merged) {
    if (_settings[key] != merged[key]) {
      updateSetting(data.settings, key);
    }
  }
  // store a copy of the settings
  _settings = merged;
}

function handleLogRecord(data) {
  $.jog.knownHandlers.html.publish(data.area, data.levelNum, data.levelName,
      data.when, data.message);
}

function updateSetting(key, newSettings) {
  switch (key) {
  case 'title':
    $('title').text(newSettings.title);
    $('.jog-title').text(newSettings.title);
    break;

  case 'css':
    var logCss = $('#jog-css');
    var css = newSettings.css;
    if (css.charAt(0) == '<') {
      logCss.replaceWith($(css));
    } else {
      logCss.attr('href', css);
    }
  }
}
