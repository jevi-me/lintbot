(function () {
    "use strict";
    const fs = require('fs');
    const path = require('path');
    const ipcRenderer = require('electron').ipcRenderer;
    const lintbotMain = require('electron').remote.require('./app/lintbot-main');
    const fileExists = require(__dirname + '/file-exists');
    const classify = require(__dirname + '/classify');
    const webLoader = require(__dirname + '/web-loader');
    const unitTestInjector = require(__dirname + "/unit-test-injector");

    const group = taskDetails.group;
    const fullPath = taskDetails.cwd;
    const indexFile = taskDetails.options.path;

    let testsToRun = taskDetails.options;
    let isPath;

    testsToRun.labels.forEach((unit, i) => {
        testsToRun.listenerLabel[i] = testsToRun.labels[i].toLowerCase().trim().replace(/\s/g, "") + "-" + Date.now();
        testsToRun.displayLabel[i] = testsToRun.labels[i];
        lintbotMain.send('check-group:item-new', group, testsToRun.listenerLabel[i], testsToRun.displayLabel[i]);
    });

    const check = function (lLabel, dLabel, loc, next) {

        const listenerLabel = lLabel;
        const displayLabel = dLabel;
        const urlPath = loc;
        isPath = !urlPath.includes('http');

        let hasErrors = false;
        let win;

        const cleanup = function () {
            ipcRenderer.removeAllListeners("__lintbot-unit-test-error");
            ipcRenderer.removeAllListeners("__lintbot-unit-test-pass-" + listenerLabel);
            ipcRenderer.removeAllListeners("__lintbot-unit-test-fail-" + listenerLabel);
            ipcRenderer.removeAllListeners("__lintbot-unit-test-debug-" + listenerLabel);
            webLoader.destroy(win);
            win = null;
        };

        lintbotMain.send("check-group:item-computing", group, listenerLabel, displayLabel);

        ipcRenderer.on("__lintbot-unit-test-error", function (event, message) {
            hasErrors = true;

            if (message) {
                message = message.replace(/\.$/, "");
                lintbotMain.send("check-group:item-complete", group, listenerLabel, displayLabel, [`${message}`]);
            }
            cleanup();
            next();
        });

        ipcRenderer.on("__lintbot-unit-test-pass-" + listenerLabel, function (event) {
            lintbotMain.send("check-group:item-complete", group, listenerLabel, displayLabel);
            cleanup();
            next();
        });

        ipcRenderer.on("__lintbot-unit-test-fail-" + listenerLabel, function (event, reason) {
            lintbotMain.send("check-group:item-complete", group, listenerLabel, displayLabel, [`${reason}`]);
            cleanup();
            next();
        });

        ipcRenderer.on("__lintbot-unit-test-debug-" + listenerLabel, function (event, ...e) {
            lintbotMain.debug(...e);
        });

        ipcRenderer.on("__lintbot-unit-test-report-tab-"+ listenerLabel, function (e, fp) {
            lintbotMain.send("report-window-tab-lbm", fp, listenerLabel);
        });


            webLoader.load(taskRunnerId, indexFile, {}, false, function (theWindow) {
                win = theWindow;
                unitTestInjector.unit_runCode(theWindow, urlPath, fullPath, isPath, listenerLabel);
                let lintbotMain = require('electron').remote.BrowserWindow.fromId(1);
                theWindow.setParentWindow(lintbotMain);
                next();
            });
    };

    const checkNext = function () {
        if (testsToRun.urls.length <= 0) return done();
        check(testsToRun.listenerLabel.shift(), testsToRun.displayLabel.shift(), testsToRun.urls.shift(), checkNext);
    };

    checkNext();
}());