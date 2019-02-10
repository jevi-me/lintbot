'use strict';

const path = require('path');
const util = require('util');
const yaml = require('js-yaml');
const S = require('string');
const lintbotMain = require('electron').remote.require('./app/lintbot-main');

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, fullPath, fileContents, next) {
  let filename = path.parse(fullPath).base;
  let yamlData;
  let errors = [];

  lintbotMain.send('check-group:item-computing', checkGroup, checkId);

  try {
    yamlData = yaml.safeLoad(fileContents);
  } catch (e) {
    if (e.reason && e.mark) {
      let line = e.mark.line + 1;
      let reason = S(e.reason).humanize();

      errors.push(`Line ${line}: ${reason}`);
    } else {
      let reason = (e.reason) ? ' — ' + S(e.reason).humanize() : '';

      errors.push(`There was a validation error in the YAML data${reason}`);
    }
  }

  if (errors.length > 0) {
    errors.unshift({
      type: 'intro',
      message: 'Refer to the Markdown & YAML cheat sheet to help understand these errors:',
      link: 'https://learn-the-web.algonquindesign.ca/topics/markdown-yaml-cheat-sheet/', //TODO: Fix link to algonquindesign
      linkText: 'https://mkbt.io/md-yml-cheat-sheet/',
    });
  }

  lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
  next(errors);
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkId = 'validation';
    const checkLabel = 'Validation & best practices';

    lintbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fullPath, fileContents, next) {
        check(checkGroup, checkId, checkLabel, fullPath, fileContents, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
