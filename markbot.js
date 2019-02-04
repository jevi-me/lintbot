/* ----------------------------------------------------------------------
Based on Markbot by Thomas J Bradley <hey@thomasjbradley.ca>
  (homepage: https://github.com/thomasjbradley/markbot)
------------------------------------------------------------------------- */

'use strict';


/*--- Constants ---*/
const electron      = require('electron');
const nativeImage   = require('electron').nativeImage;
const app           = electron.app;
const Menu          = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const shell         = electron.shell;


/*--- Node Require ---*/
const exec      = require('child_process').exec;
const fs        = require('fs');
const path      = require('path');
const util      = require('util');
const https     = require('https');
const crypto    = require('crypto');
const request   = require('request');
const mkdirp    = require('mkdirp');
const fixPath   = require('fix-path');

/*--- File Require ---*/
const lintbotMain             = require('./app/lintbot-main');
const lintbotFileGenerator    = require('./app/lintbot-file-generator');
const dependencyChecker       = require('./app/dependency-checker');
const serverManager           = require('./app/server-manager');
const screenshotNamingService = require('./app/checks/screenshots/naming-service');
const passcode                = require('./app/passcode');
const locker                  = require('./app/locker');
const requirementsFinder      = require('./app/requirements-finder');
const lockMatcher             = require('./app/lock-matcher');
const exists                  = require('./app/file-exists');
const escapeShell             = require(`./app/escape-shell`);
const checkManager            = require('./app/check-manager');


/*-- Variables --*/
global.ENV = process.env.NODE_ENV;
global.DEBUG = (global.ENV === 'development');

const LINTBOT_DEVELOP_MENU = !!process.env.LINTBOT_DEVELOP_MENU || false;
const LINTBOT_LOCK_PASSCODE = process.env.LINTBOT_LOCK_PASSCODE || false;
const appMenu = require('./app/menu');
const LINTBOT_FILE = '.lintbot.yml';
const LINTBOT_LOCK_FILE = '.lintbot.lock';


/*--- Files Variables ---*/
let appPkg = require('./package.json');
let config = require('./config.json');


let dependencies = {};
let lintbotFile = {};
let lintbotFileOriginal = {};
let lintbotIgnoreFile = {};
let mainWindow;
let debugWindow;
let differWindow;
let reportsWindow;
let menuCallbacks = {};
let menuOptions = {
  openCoursewebsite: false,
  openRepo: false,
  runChecks: false,
  revealFolder: false,
  viewLocal: false,
  viewLive: false,
  browseRepo: false,
  //submitAssignment: false,
  //signOut: false,
  //signOutUsername: false,
  showDevelop: false,
  developMenuItems: false,
  debugChecked: global.DEBUG,
  openReports: false,
};
let lintbotFilePath;
let lintbotLockFilePath;
let currentFolderPath;
let startupCurrentFolderPath;
let lintbotLockFileLocker;
let actualFilesLocker;
let isCheater = {
  cheated: false,
  matches: {},
};

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-features', 'ColorCorrectRendering');


/*--- Window Functions ---*/
const updateAppMenu = function () {
  menuOptions.showDevelop = (LINTBOT_DEVELOP_MENU && LINTBOT_LOCK_PASSCODE && passcode.matches(LINTBOT_LOCK_PASSCODE, config.secret, config.passcodeHash));
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenu.getMenuTemplate(app, menuCallbacks, menuOptions)));
};

const createMainWindow = function (next) {
  mainWindow = new BrowserWindow({
    width: 800,
    minWidth: 800,
    height: 600,
    show: false,
    minHeight: 550,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'light',
  });

  mainWindow.loadURL('file://' + __dirname + '/frontend/main/main.html');

  mainWindow.on('closed', function () {
    if (differWindow) differWindow.destroy();
    if (debugWindow) debugWindow.destroy();
    if (reportsWindow) reportsWindow.destroy();


    checkManager.stop();
    exports.disableFolderMenuFeatures();

    mainWindow.destroy();
    mainWindow = null;

    BrowserWindow.getAllWindows().forEach(window => {
      window.destroy();
      window = null;
    });
    if (process.platform !== 'darwin') app.quit();
  });

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();

    if (next) next();
  });

  mainWindow.on('focus', function () {
    mainWindow.webContents.send('app:focus');
  });

  mainWindow.on('blur', function () {
    mainWindow.webContents.send('app:blur');
  });

  global.lintbotMainWindow = mainWindow.id;
  if (global.DEBUG) console.log(`Main window: ${mainWindow.id}`);
};

const createDebugWindow = function () {
  debugWindow = new BrowserWindow({
    width: 600,
    minWidth: 600,
    height: 300,
    minHeight: 300,
    show: false
  });

  debugWindow.on('close', function (e) {
    e.preventDefault();
    debugWindow.hide();
  });

  debugWindow.loadURL('file://' + __dirname + '/frontend/debug/debug.html');
  global.lintbotDebugWindow = debugWindow.id;
};

const createWindows = function (next) {
  createMainWindow(() => {
    dependencyChecker.check((deps) => {
      dependencies = deps;

      if (deps.hasMissingDependencies) return mainWindow.webContents.send('error:missing-dependency', deps);

      serverManager.start(() => {
        mainWindow.webContents.send('app:ready');
        createDebugWindow();

        if (startupCurrentFolderPath) {
          lintbotMain.send('app:file-dropped', startupCurrentFolderPath);
          startupCurrentFolderPath = false;
        } else {
          if (next) next();
        }
      });
    });
  });
};

const initializeInterface = function () {
  let repoOrFolder = (lintbotFile.repo) ? lintbotFile.repo : currentFolderPath.split(/[\\\/]/).pop();

  mainWindow.setRepresentedFilename(currentFolderPath);
  mainWindow.setTitle(repoOrFolder + ' — Lintbot');

  menuOptions.runChecks = true;
  menuOptions.revealFolder = true;
  menuOptions.viewLocal = true;
  menuOptions.developMenuItems = true;

  if (lintbotFile.canvasCourse) lintbotMain.send('app:with-canvas');

  if (lintbotFile.repo) {
    menuOptions.viewLive = `https://{{username}}.github.io/${repoOrFolder}/`;
    menuOptions.ghRepo = `https://github.com/{{username}}/${repoOrFolder}`;
    menuOptions.ghIssues = `https://github.com/{{username}}/${repoOrFolder}/issues/new`;
    menuOptions.browseRepo = true;
    lintbotMain.send('app:with-github');
  } else {
    menuOptions.viewLive = false;
    menuOptions.ghRepo = false;
    menuOptions.ghIssues = false;
    menuOptions.browseRepo = false;
    lintbotMain.send('app:without-github');
  }
};

const checkForCheating = function () {
  lintbotLockFileLocker = locker.new(config.passcodeHash);
  actualFilesLocker = locker.new(config.passcodeHash);

  lintbotLockFileLocker.read(lintbotLockFilePath);
  requirementsFinder.lock(actualFilesLocker, currentFolderPath, lintbotFile, lintbotFileOriginal, lintbotIgnoreFile);
  isCheater = lockMatcher.match(lintbotLockFileLocker.getLocks(), actualFilesLocker.getLocks(), lintbotIgnoreFile);

  /*if (isCheater.cheated) {
    lintbotMain.debug('CHEATER!');

    for (let match in isCheater.matches) {
      if (!isCheater.matches[match].equal) {
        if (isCheater.matches[match].actualHash && isCheater.matches[match].expectedHash) {
          lintbotMain.debug(`&nbsp;&nbsp;┖ \`${match}\` is different — expecting: \`${isCheater.matches[match].expectedHash.slice(0, 7)}…\` actual: \`${isCheater.matches[match].actualHash.slice(0, 7)}…\``);
        } else {
          lintbotMain.debug(`&nbsp;&nbsp;┖ \`${match}\` is different`);
        }

      }
    }
  }*/
};

const hasFilesToCheck = function () {
  const noGit = (typeof lintbotFile.git === 'undefined');
  const noHtmlFiles = (typeof lintbotFile.html === 'undefined' || lintbotFile.html.length < 1);
  const noCssFiles = (typeof lintbotFile.css === 'undefined' || lintbotFile.css.length < 1);
  const noJsFiles = (typeof lintbotFile.js === 'undefined' || lintbotFile.js.length < 1);
  const noMdFiles = (typeof lintbotFile.md === 'undefined' || lintbotFile.md.length < 1);
  const noYmlFiles = (typeof lintbotFile.yml === 'undefined' || lintbotFile.yml.length < 1);
  const noFiles = (typeof lintbotFile.files === 'undefined' || lintbotFile.files.length < 1);
  const noFunctionality = (typeof lintbotFile.functionality === 'undefined' || lintbotFile.functionality.length < 1);
  const noScreeshots = (typeof lintbotFile.screenshots === 'undefined' || lintbotFile.screenshots.length < 1);
  const noPerformance = (typeof lintbotFile.performance === 'undefined' || lintbotFile.performance.length < 1);
  const noUnitTests = (typeof lintbotFile.unittests === 'undefined' || lintbotFile.unittests.length < 1);

  if (noGit && noHtmlFiles && noCssFiles && noJsFiles && noMdFiles && noYmlFiles && noFiles && noFunctionality && noScreeshots && noPerformance && noUnitTests) {
    lintbotMain.send('app:file-missing');

    setTimeout(function () {
      lintbotMain.send('alert', 'Lintbot cannot find any files or checks to run');
    }, 75);

    return false;
  }

  return true;
};

const startChecks = function () {
  let lintbotGroup = `lintbot-${Date.now()}`;
  let repoOrFolder = (lintbotFile.repo) ? lintbotFile.repo : currentFolderPath.split(/[\\\/]/).pop();

  lintbotFile.cwd = currentFolderPath;
  //lintbotFile.username = menuOptions.signOutUsername;

  lintbotMain.send('app:file-exists', repoOrFolder);
  lintbotMain.send('check-group:new', lintbotGroup, 'Lintbot file');

  if (lintbotFile.internalTemplate) {
    lintbotMain.send('check-group:item-new', lintbotGroup, 'file', 'Not found');
    lintbotMain.send('check-group:item-complete', lintbotGroup, 'file', 'Not found', [], [], ['**No LintbotFile was found**, default settings are being used to check the code, which may not be what is being graded. Double-check that the original assignment was forked.']);
    lintbotMain.send('check-group:item-new', lintbotGroup, 'settings', 'Using default settings');
    lintbotMain.send('check-group:item-complete', lintbotGroup, 'settings', 'Using default settings');
  } else {
    lintbotMain.send('check-group:item-new', lintbotGroup, 'file', 'Exists');
    lintbotMain.send('check-group:item-complete', lintbotGroup, 'file', 'Exists');
  }

  checkManager.run(lintbotFile, isCheater, function () {
    lintbotMain.send('app:all-done');
  });
};

const handleLintbotFile = function (mf, ignores, mfOriginal) {
  lintbotFile = mf;
  lintbotFileOriginal = mfOriginal;
  lintbotIgnoreFile = ignores;

  if (mf.inheritFilesNotFound && mf.inheritFilesNotFound.length > 0) lintbotMain.debug(`Inherited Lintbot file(s) “${mf.inheritFilesNotFound.join(', ')}” not found`);

  if (global.DEBUG) console.log(mf);
  lintbotMain.debug(`Server “web”: @@${serverManager.getHost('web')}@@`);
  lintbotMain.debug(`Server “html”: @@${serverManager.getHost('html')}@@`);
  lintbotMain.debug(`Server “language”: @@${serverManager.getHost('language')}@@`);

  initializeInterface();
  updateAppMenu();
  checkForCheating();

  if (hasFilesToCheck()) startChecks();
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus()
    }
  });
  app.on('ready', () => {
    fixPath();
    updateAppMenu();
    createWindows();
  });
}

menuCallbacks.showDebugWindow = function () {
  debugWindow.show();
};

app.on('window-all-closed', function () {
  app.exit();
});

app.on('will-quit', () => {
  serverManager.stop();
  app.releaseSingleInstance();
  app.releaseSingleInstanceLock();
  app.exit();
});

exports.relaunch = function () {
  app.relaunch();
  app.quit();
};

app.on('activate', function () {
  if (app.isReady()) {
    if (!mainWindow) createWindows();
  }
});

exports.openRepo = function (path) {
  if (typeof path !== 'string') path = path[0];

  if (!mainWindow) {
    if (app.isReady()) {
      createWindows(() => {
        lintbotMain.send('app:file-dropped', path);
      });
    } else {
      startupCurrentFolderPath = path;
    }
  } else {
    lintbotMain.send('app:file-dropped', path);
  }
};
menuCallbacks.openRepo = exports.openRepo;

exports.fileMissing = function (path) {
  if (!mainWindow) {
    if (app.isReady()) {
      createWindows(() => {
        lintbotMain.send('app:file-missing');
      });
    }
  } else {
    lintbotMain.send('app:file-missing');
  }
};
menuCallbacks.fileMissing = exports.fileMissing;

app.on('open-file', function (e, path) {
  e.preventDefault();
  exports.openRepo(path);
});

exports.newDebugGroup = function (label) {
  debugWindow.webContents.send('__lintbot-debug-group', label);
};

exports.debug = function (args) {
  debugWindow.webContents.send('__lintbot-debug', ...args);
};

exports.revealFolder = function () {
  if (currentFolderPath) {
    shell.showItemInFolder(currentFolderPath);
  }
};
menuCallbacks.revealFolder = exports.revealFolder;

exports.openCoursewebsite = function () {
  shell.openExternal(config.coursewebsite);
};
menuCallbacks.openCoursewebsite = exports.openCoursewebsite;

exports.openBrowserToServer = function () {
  shell.openExternal(serverManager.getHost('web'));
};
menuCallbacks.openBrowserToServer = exports.openBrowserToServer;

/*exports.createGitHubIssue = function () {
  shell.openExternal(menuOptions.ghIssues.replace(/\{\{username\}\}/, menuOptions.signOutUsername));
};
menuCallbacks.createGitHubIssue = exports.createGitHubIssue;

exports.openGitHubRepo = function () {
  shell.openExternal(menuOptions.ghRepo.replace(/\{\{username\}\}/, menuOptions.signOutUsername));
};
menuCallbacks.openGitHubRepo = exports.openGitHubRepo;*/

/*exports.submitAssignment = function () {
  lintbotMain.send('app:submit-assignment');
};
menuCallbacks.submitAssignment = exports.submitAssignment;

exports.enableSubmitAssignment = function () {
  menuOptions.submitAssignment = true;
  updateAppMenu();
};

exports.disableSubmitAssignment = function () {
  menuOptions.submitAssignment = false;
  updateAppMenu();
};*/

exports.enableOpenReports = function () {
  menuOptions.openReports = true;
  updateAppMenu();
};

exports.disableOpenReports = function () {
  menuOptions.openReports = false;
  updateAppMenu();
};

exports.openInCodeEditor = function () {
  if (currentFolderPath) {
    exec(`code ${escapeShell(currentFolderPath)}`);
  }
};
menuCallbacks.openInCodeEditor = exports.openInCodeEditor;

exports.disableFolderMenuFeatures = function () {
  menuOptions.runChecks = false;
  menuOptions.revealFolder = false;
  menuOptions.viewLocal = false;
  menuOptions.viewLive = false;
  menuOptions.browseRepo = false;
  menuOptions.ghRepo = false;
  menuOptions.ghIssues = false;
  updateAppMenu();
};
menuCallbacks.disableFolderMenuFeatures = exports.disableFolderMenuFeatures;

/*exports.disableSignOut = function () {
  menuOptions.openRepo = false;
  menuOptions.signOut = false;
  menuOptions.signOutUsername = false;
  menuOptions.openCoursewebsite = false;
  updateAppMenu();
};

exports.enableSignOut = function (username) {
  menuOptions.openRepo = true;
  menuOptions.signOut = true;

  if (username && username !== 'false') {
    menuOptions.signOutUsername = username;
    menuOptions.openCoursewebsite = true;
  }

  updateAppMenu();
};*/

exports.copyReferenceScreenshots = function () {
  lintbotFile.screenshots.forEach(function (file) {
    let screenshotSizes;

    if (!file.sizes) return;

    screenshotSizes = (Array.isArray(file.sizes)) ? file.sizes.slice(0) : Object.keys(file.sizes);
    mkdirp.sync(path.resolve(currentFolderPath + '/' + screenshotNamingService.REFERENCE_SCREENSHOT_FOLDER));

    screenshotSizes.forEach(function (width) {
      fs.rename(
        screenshotNamingService.getScreenshotPath(currentFolderPath, screenshotNamingService.makeScreenshotBasename(file), width),
        screenshotNamingService.getScreenshotPath(currentFolderPath, screenshotNamingService.makeScreenshotBasename(file), width, true),
        (e) => {
          const imgRefPath = screenshotNamingService.getScreenshotPath(currentFolderPath, screenshotNamingService.makeScreenshotBasename(file), width, true);
          const imgRef = nativeImage.createFromPath(imgRefPath);
          const imgSizeRef = imgRef.getSize();

          if (imgSizeRef.width > width) {
            let resizedImageNew = imgRef.resize({
              width: width,
              quality: 'best',
            });
            fs.writeFile(imgRefPath, resizedImageNew.toPNG(), () => {});
          }
        }
      );
    });
  });
};
menuCallbacks.copyReferenceScreenshots = exports.copyReferenceScreenshots;

exports.lockRequirements = function () {
  actualFilesLocker.save(lintbotLockFilePath);
};
menuCallbacks.lockRequirements = exports.lockRequirements;

exports.onFileDropped = function(filePath) {

  if (reportsWindow) reportsWindow.destroy();
  if (debugWindow) debugWindow.destroy();
  if (differWindow) differWindow.hide();

  mainWindow.getChildWindows().forEach(function(win){
    win.destroy();
    win = null;
  });

  createreportsWindow();
  createDebugWindow();

  lintbotFilePath = path.resolve(filePath + '/' + LINTBOT_FILE);
  lintbotLockFilePath = path.resolve(filePath + '/' + LINTBOT_LOCK_FILE);
  currentFolderPath = filePath;

  serverManager.getServer('web').setRoot(currentFolderPath);

  if (exists.check(lintbotFilePath)) {
    lintbotFileGenerator.get(lintbotFilePath, handleLintbotFile);
  } else {
    lintbotFileGenerator.buildFromFolder(filePath, handleLintbotFile);
  }

  mainWindow.focus();
};

exports.showDifferWindow = function (imgs, width) {
  let js = `setImages('${imgs}')`;

  if (!differWindow) {
    differWindow = new BrowserWindow({
      width: 320,
      height: 400,
      minWidth: 320,
      maxHeight: 2000,
      show: false
    });

    differWindow.loadURL(`file://${__dirname}/frontend/differ/differ.html`);

    differWindow.on('close', function (e) {
      e.preventDefault();
      differWindow.hide();
      e.returnValue = false;
    });

    differWindow.on('closed', function () {
      differWindow = null;
    });
  }

  differWindow.setSize(width, 400);
  differWindow.setMaximumSize(width, 2000);
  differWindow.webContents.executeJavaScript(js);
  differWindow.show();
  differWindow.setSize(width, 400);
  //global.lintbotDifferWindow = differWindow.id;
};

exports.toggleDebug = function () {
  let ignoreWindows = [global.lintbotMainWindow, global.lintbotDebugWindow];

  global.DEBUG = !global.DEBUG;
  menuOptions.debugChecked = global.DEBUG;

  if (differWindow) ignoreWindows.push(global.lintbotDifferWindow);

  if (global.DEBUG) {
    BrowserWindow.getAllWindows().forEach(function (win) {
      if (ignoreWindows.indexOf(win.id) === -1) {
        win.webContents.openDevTools({ mode: 'detach' });
        win.show();
      }
    });
  } else {
    BrowserWindow.getAllWindows().forEach(function (win) {
      if (ignoreWindows.indexOf(win.id) > -1) return;

      win.hide();
      win.webContents.closeDevTools();
      mainWindow.focus();
    });
  }
};
menuCallbacks.toggleDebug = exports.toggleDebug;

exports.focusToolbar = function () {
  mainWindow.focus();
  lintbotMain.send('app:focus-toolbar');
};
menuCallbacks.focusToolbar = exports.focusToolbar;

exports.focusCheckList = function () {
  mainWindow.focus();
  lintbotMain.send('app:focus-checklist');
};
menuCallbacks.focusCheckList = exports.focusCheckList;

exports.focusErrorList = function () {
  mainWindow.focus();
  lintbotMain.send('app:focus-errorlist');
};
menuCallbacks.focusErrorList = exports.focusErrorList;

/*exports.submitAssessment = function (ghUsername, apiToken, details, next) {
  let requestOptions = {
    'url': `${config.progressinatorApi}/submit-assessment`,
    'headers': {
      'Authorization': `Token ${apiToken}`,
      'User-Agent': `Lintbot/${appPkg.version}`,
    },
    'json': true,
    'body': {
      'github_username': ghUsername,
      'submitted_by': `Lintbot/${appPkg.version}`,
      'assessment_uri': `ca.learn-the-web.exercises.${lintbotFile.repo}`,
      'grade': 1,
      'cheated': isCheater.cheated,
      'details': details,
    }
  };
  let hash = crypto.createHash('sha512');
  let bodyForSig = [
    ghUsername,
    requestOptions.body.submitted_by,
    requestOptions.body.assessment_uri,
    requestOptions.body.grade,
    isCheater.cheated,
    config.passcodeHash,
  ];
  const lintbotMouth = isCheater.cheated ? '〜' : '◡';
  const possibleQuotes = require('./frontend/main/success-messages.json');
  const quote = isCheater.cheated ? 'Cheater' : possibleQuotes[Math.floor(Math.random() * possibleQuotes.length)];

  requestOptions.body.signature = hash.update(JSON.stringify(bodyForSig), 'ascii').digest('hex');
  requestOptions.body.details.comment = `└[ ◕ ${lintbotMouth} ◕ ]┘ Lintbot says, “${quote}!”`;

  request.post(requestOptions, function (err, res, body) {
    if (err) return next(true);
    next(false, res.statusCode, body);
  });
}
*/

const createreportsWindow = function () {
  if (!reportsWindow) {
    reportsWindow = new BrowserWindow({
      width: 900,
      minWidth: 600,
      height: 600,
      minHeight: 400,
      show: false
    });
    reportsWindow.setTitle('Mocha Reports');
    reportsWindow.on('close', function (e) {
      e.preventDefault();
      reportsWindow.hide();
    });
    reportsWindow.on('closed', function () {
      reportsWindow = null;
    });
    let reportsHtml = 'file://' + __dirname + '/frontend/reports/reports.html';
    reportsWindow.loadURL( reportsHtml );
  }
}

exports.showReportsWindow = function (){
  reportsWindow.show();
  reportsWindow.focus();
};

exports.reportsWindowTab = function(fp, ll){
  reportsWindow.webContents.send('make-reports-window-tab', fp, ll)
};
