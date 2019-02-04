'use strict';

const path = require('path');
const fs = require('fs');
//const is = require('electron-is');
const cp = require('child_process');

let isPath;
let injectionJs = false;
let folderPath;

const getJsCode = function (testJsURL, isPath, label, cb) {
    function makeHttpObject() {
        try {
            return new XMLHttpRequest();
        } catch (error) {
        }
        try {
            return new ActiveXObject('Msxml2.XMLHTTP');
        } catch (error) {
        }
        try {
            return new ActiveXObject('Microsoft.XMLHTTP');
        } catch (error) {
        }
        throw new Error('Could not create HTTP request object.');
    }

    if (!isPath) { //Online URL
        let mto = makeHttpObject();
        let unitTestJs;
        mto.open("GET", testJsURL, true);
        mto.send(null);
        mto.onreadystatechange = function () {
            if (this.readyState === 4) {
                unitTestJs = JSON.stringify(this.responseText);
                let filename = 'unittest' + label + '.js';
                let unitTestPath = '/tests/' + filename;
                fs.writeFileSync(folderPath + '/' + unitTestPath, unitTestJs, 'utf-8'); //TODO test this
                cb(unitTestPath);
            }
        };
    } else { //Local path within dropped folder
        cb(testJsURL);
    }

};
const buildCmd = function (jsPath, label) {
    //let os = is.windows() ? 'win' : 'unix';
    let reportDir = folderPath + '/TestResults/' + label;
    //const cmdin = os === 'win' ? cmdw : cmdu;
    return 'cd ' + folderPath + ' && npm install && mocha -t 0 ' + jsPath + '  --reporter mochawesome --reporter-options reportDir=' + reportDir + ',reportFilename=testresults';
};
const runCmd = function (cmdin, cb) {
    let command = cp.exec(cmdin);
    let result = '';
    let error = false;
    command.stderr.on('error', function () {
        error = true;
    });
    command.stdout.on('data', function (data) {
        result += data.toString();
    });
    command.on('disconnect', function () {
        error = true;
    });
    command.on('exit', function (code) {
        if (code === -1) {
            error = true;
        }
    });
    command.on('close', function (code) {
        if (code === 1 && error === false) {
            try {cb(JSON.stringify(result));}
            catch(e){}
        }
        else { cb(false); }
        command.kill('SIGINT');
    });
};
const processMsg = function (resp, label) {

    let output = 'fail()';
    let failure_msg;
    let jsonOutputFile = folderPath+'/TestResults/' + label+'/testresults.json';
    let htmlOutputFile = folderPath+'/TestResults/' + label+'/testresults.html';

    if (!resp || resp === '""') {
        output = 'fail("There was an error executing the Unit Tests. Double check the test scripts, and try again. [Error: command]");';
    } else {
        let jsonOutput = fs.readFileSync(jsonOutputFile).toString();
        let processed = JSON.parse(jsonOutput);
        if (processed.stats.failures === 0 && processed.stats.hasSkipped === false) {
            output = 'report("'+htmlOutputFile+'"); pass(); ';
        }
        else{
            failure_msg = 'Oops! There are ' + processed.stats.failures + ' failed test(s) found, and '+ processed.stats.skipped +' skipped test(s) out of ' + processed.stats.testsRegistered + ' tests. Test pass percentage is '+processed.stats.passPercent+  '%. Click the `View Reports` button above.';
            output = 'report("'+htmlOutputFile+'"); fail("'+failure_msg+'"); ';
        }
    }
    return `
    (function () {
      'use strict';
      
      window.__lintbot.playAnimations();
      setTimeout(() => {
        __uLintbotInjectedFunctions.fail('The Lintbot requirements test code took too long to run or didn’t execute the required \`done()\` or \`pass()\` functions');
        }, 7000);
        ${output}
      }());
  `;
};
const unit_makeExecTestJs = function (js, label, testWinId) {
    if (!injectionJs) injectionJs = fs.readFileSync(path.resolve(`${__dirname}/unit-test-methods.js`), 'utf8');
    return `
    (function () {
      ${injectionJs}

      __uLintbotInjectedFunctions.browserWindowId = ${testWinId};
      __uLintbotInjectedFunctions.taskRunnerId = ${taskRunnerId};
      __uLintbotInjectedFunctions.doneLabel = '__lintbot-unit-test-done-${label}';
      __uLintbotInjectedFunctions.passLabel = '__lintbot-unit-test-pass-${label}';
      __uLintbotInjectedFunctions.failLabel = '__lintbot-unit-test-fail-${label}';
      __uLintbotInjectedFunctions.debugLabel = '__lintbot-unit-test-debug-${label}'
      __uLintbotInjectedFunctions.reportLabel = '__lintbot-unit-test-report-tab-${label}';
      
      __uLintbotInjectedFunctions.send('mouseMove', { x: -10, y: -10 }, () => {
        (function ($, $$, css, bounds, offset, on, ev, send, hover, activate, done, pass, fail, debug, report) {
          'use strict';

          try {
            eval(${js});
          } catch (e) {
            __uLintbotInjectedFunctions.debugFail(e);
          }
        }(
          __uLintbotInjectedFunctions.$,
          __uLintbotInjectedFunctions.$$,
          __uLintbotInjectedFunctions.css,
          __uLintbotInjectedFunctions.bounds,
          __uLintbotInjectedFunctions.offset,
          __uLintbotInjectedFunctions.on,
          __uLintbotInjectedFunctions.ev,
          __uLintbotInjectedFunctions.send,
          __uLintbotInjectedFunctions.hover,
          __uLintbotInjectedFunctions.activate,
          __uLintbotInjectedFunctions.done,
          __uLintbotInjectedFunctions.pass,
          __uLintbotInjectedFunctions.fail,
          __uLintbotInjectedFunctions.debug,
          __uLintbotInjectedFunctions.report
        ));
      });
    }());
  `;
};
const unit_runCode = function (win, jsURLPath, fullPath, isPathBoolean, listenerLabel) {
    let bindFunction;
    let cmdin;
    isPath = isPathBoolean;
    folderPath = fullPath;
    getJsCode(jsURLPath, isPath, listenerLabel, function (resp) {
        cmdin = buildCmd(resp, listenerLabel);
        runCmd(cmdin, function (message) {
            bindFunction = processMsg(message, listenerLabel);
            let js = unit_makeExecTestJs(JSON.stringify(bindFunction), listenerLabel, win.id);
            win.webContents.executeJavaScript(js);
        });
    });
};



module.exports = {
    unit_runCode: unit_runCode,
};
