'use strict';

const util = require('util');
const linter = require('stylelint');
const lintbotMain = require('electron').remote.require('./app/lintbot-main');
const viewportChecker = require(__dirname + '/best-practices/viewport');

const ERROR_MESSAGE_STATUS = require(`${__dirname}/../../error-message-status`);

const getStyleLintConfig = function () {
  const stylelintConfig = require(`${__dirname}/best-practices/stylelint.json`);

  stylelintConfig.plugins.push(`${__dirname}/../../../node_modules/stylelint-declaration-block-no-ignored-properties`);

  return stylelintConfig;
};

const shouldIncludeError = function (message, line, lines, fileContents) {
  /* SVG overflow: hidden CSS */
  if (message.match(/selector-root-no-composition/) && lines[line - 1] && lines[line - 1].match(/svg/)) return false;
  if (message.match(/root-no-standard-properties/) && lines[line - 2] && lines[line - 2].match(/svg/)) return false;

  if (message.match(/at-rule-empty-line-before/) && lines[line - 1] && lines[line - 1].match(/@[-\w]*viewport/)) return false;

  return true;
};

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, fileContents, lines, next) {
  let errors = [];
  let checkViewport;
  const stylelintConfig = getStyleLintConfig();

  lintbotMain.send('check-group:item-computing', checkGroup, checkId);

  checkViewport = viewportChecker.check(fileContents, lines);

  if (checkViewport && checkViewport.length > 0) {
    lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, checkViewport, false, false, ERROR_MESSAGE_STATUS.SKIP);
    return next();
  }

  linter.lint({code: fileContents, config: stylelintConfig})
    .then(function (data) {
      if (data.results && data.results[0]) {
        data.results[0].warnings.forEach(function (item) {
          if (shouldIncludeError(item.text, item.line, lines, fileContents)) {
            errors.push(util.format('Line %d: %s', item.line, item.text.replace(/\(.+?\)$/, '').replace(/"/g, '`')));
          }
        });
      }

      lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
      next();
    })
    .catch(function (err) {
      if (err.reason && err.line) {
        errors.push(`Line ${err.line}: ${err.reason}`);
      } else {
        errors.push('There was an error running the test—please refresh and try again');
      }

      lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
      next();
    })
  ;
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkLabel = 'Best practices & indentation';
    const checkId = 'best-practices';

    lintbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fileContents, lines, next) {
        check(checkGroup, checkId, checkLabel, fileContents, lines, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
