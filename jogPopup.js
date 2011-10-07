var tableBody;

$(document).ready(function() {
  $.pm.bind('logOptions', handleLogOptions);
  $.pm.bind('logRecord', handleLogRecord);
});

var settings;

function handleLogOptions(data) {
  var merged = $.extend(settings, data.settings);
  for (var key in merged) {
    if (settings[key] != data.settings[key]) {
      updateSetting(data.settings, key);
    }
  }
  // store a copy of the settings
  settings = $.extend({}, data.settings);
}

function handleLogRecord(data) {
  $.jog('baseHandlers').html.publish(data.area, data.levelNum, data.level,
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
