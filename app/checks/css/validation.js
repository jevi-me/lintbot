'use strict';

const path = require('path');
const util = require('util');
const exec = require('child_process').exec;
const xmlParser = require('xml2js').parseString;
const escapeShell = require(`${__dirname}/../../escape-shell`);
const convertToUrl = require(`${__dirname}/../../convert-path-to-url`);
const lintbotMain = require('electron').remote.require('./app/lintbot-main');

const cssValidatorInvalidChars = ['#'];

const cleanMessage = function (message) {
  message = message.replace(/\s+/g, ' ');
  return message;
};

const shouldIncludeError = function (context, message, skippedstring, line, lines, fileContents, prevErrorDetails) {
  var nonExistingPropMatch = null;

  // Ignore :root variable declarations
  if (context && /\:root/.test(context)) return false;
  // Ignore } parse errors in media queries immediate after :root errors
  // THIS IS SO HACKY—trying to work around the out-dated CSS validator
  if (/parse error/i.test(message) && /\}/.test(skippedstring) && prevErrorDetails && /\:root/.test(prevErrorDetails.context)) {
    return false
  }

  // Parse error at bottom of CSS, usually extra closing brace
  if (line > lines.length - 1) return true;

  // Caused by @viewport
  // It’s a little overzealous: if the viewport is written all on one line, as I tend to do
  //   then validation errors anywhere in that line will be skipped
  //   it relies on the best practices & properties to catch skipped errors
  if (message.match(/parse error/i) && lines[line].match(/viewport/) || (lines[line - 1] && lines[line - 1].match(/viewport/))) return false;
  if (message.match(/at-rule @.*viewport/i)) return false;

  if (message.match(/text-size-adjust/)) return false;
  if (message.match(/text-rendering/)) return false;

  // Vendor prefixes
  if (message.match(/-webkit-/)) return false;
  if (message.match(/-moz-/)) return false;
  if (message.match(/-ms-/)) return false;
  if (message.match(/-o-/)) return false;

  // Touch action
  if (message.match(/property touch-action/i)) return false;

  // Appearance
  if (message.match(/property appearance/i)) return false;

  // Ignore var() values
  if (skippedstring && /var\(/.test(skippedstring)) return false;
  // Ignore custom property declarations within a CSS block
  if (/parse error/i.test(message) && /\-\-[a-z0-9-]+\:/.test(skippedstring)) return false;
  // Ignore var() within line error message
  if (lines[line] && /var\(/.test(lines[line])) return false;

  // Ignore CSS4 form selectors
  if (message && /pseudo.+\:(invalid|valid|required|optional|in-range|out-of-range)/.test(message)) return false;

  // clip-path: inset
  if (message && /inset\(.+\%.+clip-path/i.test(message)) return false;

  // Ignore ::selection selectors
  if (/\:\:(-moz-)?selection/.test(message)) return false;

  return true;
};

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, fullPath, fileContents, lines, next) {
  const validatorPath = path.resolve(__dirname.replace(/app.asar[\/\\]/, 'app.asar.unpacked/') + '/../../../vendor/css-validator');
  const execPath = 'java -jar ' + escapeShell(validatorPath + '/css-validator.jar') + ' --output=soap12 --profile=css3svg ' + escapeShell('file://' + convertToUrl(fullPath));
  let errors = [];

  lintbotMain.send('check-group:item-computing', checkGroup, checkId);
  lintbotMain.debug(`@@${validatorPath}@@`);
  lintbotMain.debug(`\`${execPath}\``);

  if ((new RegExp(`[${cssValidatorInvalidChars.join('')}]`)).test(fullPath)) {
    errors = [`The CSS file, found at this location: \`${fullPath}\`, cannot be validated because the CSS validator doesn’t allow the following characters in file & folder names: \`${cssValidatorInvalidChars.join('\`, \`')}\``];
    lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
    return next(errors);
  }

  exec(execPath, function (err, data) {
    var xml = data.trim().replace(/^\{.*\}/, '').trim();

    xmlParser(xml, function (err, result) {
      let results;
      let errorCount;
      let errorsList;

      if (!result) {
        errors.push('There was a problem with the CSS validator — please try again');
        lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
        return next(errors);
      }

      results = result['env:Envelope']['env:Body'][0]['m:cssvalidationresponse'][0]['m:result'][0]['m:errors'][0];
      errorCount = parseInt(results['m:errorcount'][0], 10);

      if (errorCount > 0) {
        errorsList = results['m:errorlist'][0]['m:error'];
        let prevErrorDetails = false;

        errorsList.forEach(function (error, errorIndex) {
          let context = (error['m:context'] && error['m:context'][0]) ? error['m:context'][0].trim() : false;
          let line = error['m:line'][0];
          let message = error['m:message'][0].trim().replace(/\s*\:$/, '.').replace(/\s*\:/, ':').replace(/\(.*?\#.*?\)/, '—');
          let skippedstring = (error['m:skippedstring'] && error['m:skippedstring'][0]) ? error['m:skippedstring'][0].trim() : false;

          if (shouldIncludeError(context, message, skippedstring, line, lines, fileContents, prevErrorDetails)) {
            let contextMessage = '';
            let skipMessage = '';

            if (context) contextMessage = ` inside the \`${context}\` selector`;
            if (skippedstring) skipMessage = ` around this code: \`${skippedstring}\``;

            errors.push(`Line ${line}: ${message}${contextMessage}${skipMessage}`);
          }

          prevErrorDetails = {
            context: context,
            message: message,
            skippedstring: skippedstring,
            line: line
          };
        });
      }

      lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
      next(errors);
    });
  });
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkId = 'validation';
    const checkLabel = 'Validation';

    lintbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fullPath, fileContents, lines, next) {
        check(checkGroup, checkId, checkLabel, fullPath, fileContents, lines, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
