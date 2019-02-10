'use strict';

const util = require('util');
const path = require('path');
const http = require('http');
const exec = require('child_process').exec;
const escapeShell = require(`${__dirname}/../../escape-shell`);
const lintbotMain = require('electron').remote.require('./app/lintbot-main');
const serverManager = require('electron').remote.require('./app/server-manager');
const userAgentService = require(`${__dirname}/../../user-agent-service`);

const shouldIncludeError = function (message, line) {
  // The standard info: using HTML parser
  if (!line && message.match(/content-type.*text\/html/i)) return false;

  // The schema message
  if (!line && message.match(/schema.*html/i)) return false;

  // Google fonts validation error with vertical pipes
  if (message.match(/bad value.*fonts.*google.*\|/i)) return false;

  // Elements that "don't need" specific roles
  if (message.match(/element.*does not need.*role/i)) return false;

  return true;
};

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, fullPath, fileContents, lines, next) {
  const validatorPath = path.resolve(__dirname.replace(/app.asar[\/\\]/, 'app.asar.unpacked/') + '/../../../vendor/html-validator');
  const hostInfo = serverManager.getHostInfo('html');
  const crashMessage = 'Unable to connect to the HTML validator; the background process may have crashed. Please quit & restart Lintbot.';
  let messages = {};
  let errors = [];

  const requestOpts = {
    hostname: hostInfo.hostname,
    port: hostInfo.port,
    path: '/?out=json&level=error&parser=html5',
    method: 'POST',
    protocol: `${hostInfo.protocol}:`,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(fileContents),
      'User-Agent': userAgentService.get(),
    }
  };

  const req = http.request(requestOpts, (res) => {
    let data = [];

    res.setEncoding('utf8');

    res.on('data', (chunk) => {
      data.push(chunk);
    });

    res.on('end', (chunk) => {
      if (data.length > 0) {
        try {
          messages = JSON.parse(data.join(''));
        } catch (e) {
          errors.push(crashMessage);
          lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
          lintbotMain.send('restart', crashMessage);
          return next(errors);
        }

        if (messages.messages) {
          messages.messages.forEach(function (item) {
            if (shouldIncludeError(item.message, item.line)) {
              errors.push(util.format('Line %d: %s', item.lastLine, item.message.replace(/“/g, '`').replace(/”/g, '`')));
            }
          });
        }

        lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
        return next(errors);
      } else {
        errors.push(crashMessage);
        lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
        lintbotMain.send('restart', crashMessage);
        return next(errors);
      }
    });
  });

  req.on('error', () => {
    errors.push(crashMessage);
    lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
    lintbotMain.send('restart', crashMessage);
    return next(errors);
  });

  lintbotMain.debug(`@@${validatorPath}@@`);
  lintbotMain.send('check-group:item-computing', checkGroup, checkId);

  req.end(fileContents, 'utf8');
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
