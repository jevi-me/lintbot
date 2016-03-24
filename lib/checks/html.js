'use strict';

var
  fs = require('fs'),
  path = require('path'),
  exists = require('../file-exists'),
  validation = require('./html/validation'),
  bestPractices = require('./html/best-practices'),
  elements = require('./html/elements'),
  content = require('./content')
;

module.exports.check = function (listener, filePath, file, group, matchesLock) {
  var
    errors = [],
    fullPath = path.resolve(filePath + '/' + file.path),
    fileContents = '',
    validationChecker,
    bestPracticesChecker,
    elementsChecker,
    contentChecker
  ;

  const bypassAllChecks = function (f) {
    if (f.valid) validationChecker.bypass();
    if (f.bestPractices) bestPracticesChecker.bypass();
    if (f.has || f.has_not) elementsChecker.bypass();
    if (f.search || f.search_not) contentChecker.bypass();
  };

  listener.send('check-group:item-new', group, 'exists', 'Exists');

  if (file.valid) {
    validationChecker = validation.init(listener, group);
    if (file.bestPractices) bestPracticesChecker = bestPractices.init(listener, group);
  }

  if (file.has || file.has_not) elementsChecker = elements.init(listener, group);
  if (file.search || file.search_not) contentChecker = content.init(listener, group);

  if (!exists.check(fullPath)) {
    listener.send('check-group:item-complete', group, 'exists', 'Exists', [`The file “${file.path}” is missing or misspelled`]);
    bypassAllChecks(file);
    return;
  }

  if (file.locked) {
    listener.send('check-group:item-new', group, 'unchanged', 'Unchanged');

    if (!matchesLock) {
      listener.send('check-group:item-complete', group, 'unchanged', 'Unchanged', [`The “${file.path}” should not be changed`]);
    } else {
      listener.send('check-group:item-complete', group, 'unchanged', 'Unchanged');
    }
  }

  fs.readFile(fullPath, 'utf8', function (err, fileContents) {
    var lines;

    if (fileContents.trim() == '') {
      listener.send('check-group:item-complete', group, 'exists', 'Exists', [`The file “${file.path}” is empty`]);
      bypassAllChecks(file);
      return;
    }

    listener.send('check-group:item-complete', group, 'exists', 'Exists');
    lines = fileContents.toString().split(/[\n\u0085\u2028\u2029]|\r\n?/g);

    if (file.valid) {
      validationChecker.check(fullPath, fileContents, lines, function (err) {
        if (!err || err.length <= 0) {
          if (file.bestPractices) bestPracticesChecker.check(fileContents, lines);

          if (file.has || file.has_not) {
            if (file.has && !file.has_not) elementsChecker.check(fileContents, file.has, []);
            if (!file.has && file.has_not) elementsChecker.check(fileContents, [], file.has_not);
            if (file.has && file.has_not) elementsChecker.check(fileContents, file.has, file.has_not);
          }
        } else {
          if (file.bestPractices) bestPracticesChecker.bypass();
          if (file.has || file.has_not) elementsChecker.bypass();
        }
      });
    }

    if (file.search || file.search_not) {
      if (file.search && !file.search_not) contentChecker.check(fileContents, file.search, []);
      if (!file.search && file.search_not) contentChecker.check(fileContents, [], file.search_not);
      if (file.search && file.search_not) contentChecker.check(fileContents, file.search, file.search_not);
    }
  });
};