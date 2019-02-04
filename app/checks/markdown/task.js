(function () {
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const lintbotMain = require('electron').remote.require('./app/lintbot-main');
  const exists = require(__dirname + '/file-exists');
  const validation = require(__dirname + '/checks/markdown/validation');
  const content = require(__dirname + '/checks/content');

  const group = taskDetails.group;
  const file = taskDetails.options.file;
  const isCheater = taskDetails.options.cheater;

  let checksToComplete = 0;

  const checkIfDone = function () {
    checksToComplete--;

    if (checksToComplete <= 0) done();
  };

  const check = function () {
    const fullPath = path.resolve(taskDetails.cwd + '/' + file.path);
    let errors = [];
    let fileContents = '';
    let validationChecker;
    let contentChecker;

    const bypassAllChecks = function (f) {
      checksToComplete = 0;

      if (f.valid) validationChecker.bypass();
      if (f.search || f.searchNot) contentChecker.bypass();
    };

    checksToComplete++;
    lintbotMain.send('check-group:item-new', group, 'exists', 'Exists');

    if (file.locked) {
      checksToComplete++;
      lintbotMain.send('check-group:item-new', group, 'unchanged', 'Unchanged');

      if (isCheater) {
        lintbotMain.send('check-group:item-complete', group, 'unchanged', 'Unchanged', [`The \`${file.path}\` should not be changed`]);
      } else {
        lintbotMain.send('check-group:item-complete', group, 'unchanged', 'Unchanged');
      }

      checkIfDone();
    } else {
      if (file.valid) {
        checksToComplete++;
        validationChecker = validation.init(group);
      }

      if (file.search || file.searchNot) {
        checksToComplete++;
        contentChecker = content.init(group);
      }
    }

    if (!exists.check(fullPath)) {
      lintbotMain.send('check-group:item-complete', group, 'exists', 'Exists', [`The file \`${file.path}\` is missing or misspelled`]);
      bypassAllChecks(file);
      checkIfDone();
      return;
    }

    fs.readFile(fullPath, 'utf8', function (err, fileContents) {
      if (fileContents.trim() == '') {
        lintbotMain.send('check-group:item-complete', group, 'exists', 'Exists', [`The file \`${file.path}\` is empty`]);
        bypassAllChecks(file);
        checkIfDone();
        return;
      }

      lintbotMain.send('check-group:item-complete', group, 'exists', 'Exists');
      checkIfDone();

      if (file.locked) return;

      if (file.valid) validationChecker.check(fullPath, fileContents, checkIfDone);

      if (file.search || file.searchNot) {
        if (file.search && !file.searchNot) contentChecker.check(fileContents, file.search, [], checkIfDone);
        if (!file.search && file.searchNot) contentChecker.check(fileContents, [], file.searchNot, checkIfDone);
        if (file.search && file.searchNot) contentChecker.check(fileContents, file.search, file.searchNot, checkIfDone);
      }
    });
  };

  check();
}());
