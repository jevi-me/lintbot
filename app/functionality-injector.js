'use strict';

const path = require('path');
const fs = require('fs');

let injectionJs = false;

const makeExecTestJs = function (js, testIndex, label, testWinId) {
  if (!injectionJs) injectionJs = fs.readFileSync(path.resolve(`${__dirname}/functionality-methods.js`), 'utf8');

  return `
    (function () {
      ${injectionJs}

      __LintbotInjectedFunctions.testIndex = ${testIndex};
      __LintbotInjectedFunctions.browserWindowId = ${testWinId};
      __LintbotInjectedFunctions.taskRunnerId = ${taskRunnerId};
      __LintbotInjectedFunctions.doneLabel = '__lintbot-functionality-test-done-${label}';
      __LintbotInjectedFunctions.passLabel = '__lintbot-functionality-test-pass-${label}';
      __LintbotInjectedFunctions.failLabel = '__lintbot-functionality-test-fail-${label}';
      __LintbotInjectedFunctions.debugLabel = '__lintbot-functionality-test-debug-${label}';

      __LintbotInjectedFunctions.send('mouseMove', { x: -10, y: -10 }, () => {
        (function ($, $$, css, bounds, offset, on, ev, send, hover, activate, done, pass, fail, debug) {
          'use strict';

          try {
            eval(${js});
          } catch (e) {
            __LintbotInjectedFunctions.debugFail(e);
          }
        }(
          __LintbotInjectedFunctions.$,
          __LintbotInjectedFunctions.$$,
          __LintbotInjectedFunctions.css,
          __LintbotInjectedFunctions.bounds,
          __LintbotInjectedFunctions.offset,
          __LintbotInjectedFunctions.on,
          __LintbotInjectedFunctions.ev,
          __LintbotInjectedFunctions.send,
          __LintbotInjectedFunctions.hover,
          __LintbotInjectedFunctions.activate,
          __LintbotInjectedFunctions.done,
          __LintbotInjectedFunctions.pass,
          __LintbotInjectedFunctions.fail,
          __LintbotInjectedFunctions.debug
        ));
      });
    }());
  `;
};

const runCode = function (win, testJs, testIndex, listenerLabel) {
  let bindFunction = `
    (function () {
      'use strict';

      window.__lintbot.playAnimations();
      setTimeout(() => {
        __LintbotInjectedFunctions.fail('The Lintbot requirements test code took too long to run or didn’t execute the required \`done()\` or \`pass()\` functions');
      }, 7000);

      ${testJs.trim()}
    }());
  `;

  let js = makeExecTestJs(JSON.stringify(bindFunction), testIndex, listenerLabel, win.id);

  win.webContents.executeJavaScript(js);
};

module.exports = {
  runCode: runCode,
};
