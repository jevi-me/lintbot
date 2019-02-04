(function () {
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const lintbotMain = require('electron').remote.require('./app/lintbot-main');
  const exists = require(`${__dirname}/file-exists`);
  const validation = require(`${__dirname}/checks/html/validation`);
  const bestPractices = require(`${__dirname}/checks/html/best-practices`);
  const outline = require(`${__dirname}/checks/html/outline`);
  const accessibility = require(`${__dirname}/checks/html/accessibility`);
  const elements = require(`${__dirname}/checks/html/elements`);
  const content = require(`${__dirname}/checks/content`);

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
    let unique = {};
    let errors = [];
    let fileContents = '';
    let validationChecker;
    let bestPracticesChecker;
    let outlineChecker;
    let accessibilityChecker;
    let elementsChecker;
    let contentChecker;

    // Backwards compatibility
    if (file.has_not) {
      if (!file.hasNot || !Array.isArray(file.hasNot)) file.hasNot = [];
      file.hasNot = file.hasNot.concat(file.has_not);
    }

    if (file.search_not) {
      if (!file.searchNot || !Array.isArray(file.searchNot)) file.searchNot = [];
      file.searchNot = file.searchNot.concat(file.search_not);
    }

    const bypassAllChecks = function (f) {
      checksToComplete = 0;

      if (f.valid) validationChecker.bypass();
      if (f.bestPractices) bestPracticesChecker.bypass();
      if (f.outline) outlineChecker.bypass();
      if (f.accessibility) accessibilityChecker.bypass();
      if (f.has || f.hasNot) elementsChecker.bypass();
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

        if (file.bestPractices) {
          checksToComplete++;
          bestPracticesChecker = bestPractices.init(group);
        }

        if (file.outline) {
          checksToComplete++;
          outlineChecker = outline.init(group);
        }

        if (file.accessibility) {
          checksToComplete++;
          accessibilityChecker = accessibility.init(group);
        }

        if (file.has || file.hasNot) {
          checksToComplete++;
          elementsChecker = elements.init(group);
        }
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
      var lines;

      if (fileContents.trim() == '') {
        lintbotMain.send('check-group:item-complete', group, 'exists', 'Exists', [`The file \`${file.path}\` is empty`]);
        bypassAllChecks(file);
        checkIfDone();
        return;
      }

      lintbotMain.send('check-group:item-complete', group, 'exists', 'Exists');
      checkIfDone();

      if (file.locked) return;

      lines = fileContents.toString().trim().split(/[\n\u0085\u2028\u2029]|\r\n?/g);

      if (file.maxLines) {
        checksToComplete++;
        lintbotMain.send('check-group:item-new', group, 'lines', '№ lines');

        if (lines.length > file.maxLines) {
          lintbotMain.send('check-group:item-complete', group, 'lines', '№ lines', [`There are more lines of code in \`${file.path}\` than expected (has ${lines.length}, expecting <= ${file.maxLines})`]);
        } else {
          lintbotMain.send('check-group:item-complete', group, 'lines', '№ lines');
        }
      }

      if (file.valid) {
        validationChecker.check(fullPath, fileContents, lines, function (err) {
          if (!err || err.length <= 0) {
            checkIfDone();

            if (file.bestPractices) bestPracticesChecker.check(fileContents, lines, checkIfDone);
            if (file.outline) outlineChecker.check(fileContents, checkIfDone);
            if (file.accessibility) accessibilityChecker.check(taskRunnerId, file, checkIfDone);

            if (file.has || file.hasNot) {
              if (file.has && !file.hasNot) elementsChecker.check(fileContents, file.has, [], checkIfDone);
              if (!file.has && file.hasNot) elementsChecker.check(fileContents, [], file.hasNot, checkIfDone);
              if (file.has && file.hasNot) elementsChecker.check(fileContents, file.has, file.hasNot, checkIfDone);
            }
          } else {
            if (file.bestPractices) {
              bestPracticesChecker.bypass();
              checksToComplete--;
            }

            if (file.outline) {
              outlineChecker.bypass();
              checksToComplete--;
            }

            if (file.accessibility) {
              accessibilityChecker.bypass();
              checksToComplete--;
            }

            if (file.has || file.hasNot) {
              elementsChecker.bypass();
              checksToComplete--;
            }

            checkIfDone();
          }
        });
      }

      if (file.search || file.searchNot) {
        if (file.search && !file.searchNot) contentChecker.check(fileContents, file.search, [], checkIfDone);
        if (!file.search && file.searchNot) contentChecker.check(fileContents, [], file.searchNot, checkIfDone);
        if (file.search && file.searchNot) contentChecker.check(fileContents, file.search, file.searchNot, checkIfDone);
      }
    });
  };

  check();
}());
