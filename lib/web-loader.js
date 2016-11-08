'use strict';

const PRELOAD_JS = __dirname + '/hidden-browser-window-preload.js';
const PRELOAD_PATH = 'chrome://ensure-electron-resolution/';

const path = require('path');
const ipcMain = require('electron').ipcMain;
const electron = require('electron');
const app = electron.app;
const BrowserWindow = require('electron').BrowserWindow;

const getNewBrowserWindow = function (userOpts) {
  const defaultOpts = {
    width: 1000,
    height: 600,
  };
  const opts = Object.assign(defaultOpts, userOpts);

  return new BrowserWindow({
    x: 0,
    y: 0,
    center: false,
    width: opts.width,
    height: opts.height,
    show: false,
    frame: false,
    enableLargerThanScreen: true,
    backgroundColor: '#fff',
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve(PRELOAD_JS),
    },
    defaultEncoding: 'UTF-8',
  });
};

const destroy = function (win) {
  if (win) win.destroy();
  win = null;
};

const load = function (url, opts, next) {
  let win;
  let didFinishLoad = false;
  let domReady = false;
  let windowLoaded = false;
  let fontsReady = false;
  let onFinishLoadFired = false;

  const cleanup = function () {
    win.closeDevTools();
    ipcMain.removeAllListeners('__markbot-hidden-browser-devtools-loaded');
    ipcMain.removeAllListeners('__markbot-hidden-browser-window-loaded');
    ipcMain.removeAllListeners('__markbot-hidden-browser-window-fonts-loaded');
    ipcMain.removeAllListeners('__markbot-hidden-browser-har-generation-succeeded');
  };

  const notifyDevToolsExtensionOfLoad = function (e) {
    if (e.sender.getURL() != PRELOAD_PATH) {
      win.webContents.executeJavaScript('new Image().src = "https://did-finish-load/"');
    }
  };

  const waitForFinalLoad = function (e) {
    // The `did-finish-load` & `dom-ready` events often fire too soon to execute JS in the window
    const isLoading = setInterval(function () {
      if (!win.webContents.isLoading()) {
        clearInterval(isLoading);
        notifyDevToolsExtensionOfLoad(e);
      }
    }, 20);
  };

  const checkForFinalLoad = function (e) {
    if (e.sender.getURL() != PRELOAD_PATH && didFinishLoad && domReady && windowLoaded && fontsReady && !onFinishLoadFired) {
      onFinishLoadFired = true;
      waitForFinalLoad(e);
    }
  };

  BrowserWindow.removeDevToolsExtension('devtools-har-extension');
  BrowserWindow.addDevToolsExtension(path.resolve(__dirname + '/../devtools-har-extension'));
  win = getNewBrowserWindow(opts);

  win.webContents.on('did-finish-load', function (e) {
    if (e.sender.getURL() != PRELOAD_PATH) {
      didFinishLoad = true;
      checkForFinalLoad(e);
    }
  });

  win.webContents.on('dom-ready', function (e) {
    if (e.sender.getURL() != PRELOAD_PATH) {
      domReady = true;
      checkForFinalLoad(e);
    }
  });

  ipcMain.on('__markbot-hidden-browser-devtools-loaded', function (e) {
    process.nextTick(function () {
      win.loadURL(url, {'extraHeaders': 'pragma: no-cache\n'});
    });
  });

  ipcMain.on('__markbot-hidden-browser-window-fonts-loaded', function (e, details) {
    if (e.sender.getURL() != PRELOAD_PATH) {
      fontsReady = true;
      checkForFinalLoad(e);
    }
  });

  ipcMain.on('__markbot-hidden-browser-window-loaded', function (e, details) {
    if (e.sender.getURL() != PRELOAD_PATH) {
      windowLoaded = true;
      checkForFinalLoad(e);
    }
  });

  ipcMain.on('__markbot-hidden-browser-har-generation-succeeded', function (e, details) {
    cleanup();
    next(win, JSON.parse(details));
  });

  win.openDevTools({mode: 'bottom'});
  win.loadURL(PRELOAD_PATH, {'extraHeaders': 'pragma: no-cache\n'});
};

module.exports = {
  load: load,
  destroy: destroy,
};