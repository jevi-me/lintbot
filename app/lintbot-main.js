'use strict';

const is = require('electron-is');

let lintbotMain;

const init = function (main) {
  let electron;

  if (is.renderer()) {
    electron = require('electron').remote;
    lintbotMain = electron.BrowserWindow.fromId(electron.getGlobal('lintbotMainWindow')).webContents;
  } else {
    electron = require('electron');
    lintbotMain = electron.BrowserWindow.fromId(global.lintbotMainWindow).webContents;
  }
};

const destroy = function () {
  lintbotMain = null;
};

const send = function (label, ...messages) {
  init();
  lintbotMain.send(label, ...messages);
  destroy();
};

const debug = function (...messages) {
  send('debug', ...messages);
};

const isDebug = function () {
  if (is.renderer()) {
    return require('electron').remote.getGlobal('DEBUG');
  } else {
    return global.DEBUG;
  }
};

module.exports = {
  send: send,
  debug: debug,
  isDebug: isDebug,
};
