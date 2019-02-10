'use strict';

const path = require('path');
const exists = require('./file-exists');
const lintbotMain = require('./lintbot-main');
const screenshotNamingService = require('./checks/screenshots/naming-service');

let missingFiles = [];

const lockLintbotFile = function (locker, lintbotFile) {
  locker.lockString('lintbot', JSON.stringify(lintbotFile));
};

const lockLintbotIgnoreFile = function (locker, lintbotIgnoreFile) {
  locker.lockString('lintbotignore', JSON.stringify(lintbotIgnoreFile));
};

const lockFiles = function (locker, currentFolderPath, files) {
  files.forEach(function (file) {
    let filePath = path.resolve(currentFolderPath + '/' + file.path);

    if (!file.locked) return;

    if (!exists.check(filePath)) {
      missingFiles.push(file.path);
      return;
    }

    if (file.locked) locker.lockFile(file.path, filePath);
  });
};

const lockScreenshots = function (locker, currentFolderPath, files) {
  files.forEach(function (file) {
    let screenshotSizes = (Array.isArray(file.sizes)) ? file.sizes.slice(0) : Object.keys(file.sizes);

    screenshotSizes.forEach(function (size) {
      let screenshotFileName = screenshotNamingService.getScreenshotFilename(screenshotNamingService.makeScreenshotBasename(file), size);
      let screenshotPath = path.resolve(currentFolderPath + '/' + screenshotNamingService.REFERENCE_SCREENSHOT_FOLDER + '/' + screenshotFileName);

      if (!exists.check(screenshotPath)) {
        missingFiles.push(screenshotFileName);
        return;
      }

      locker.lockFile(screenshotFileName, screenshotPath);
    });
  });
};

const lock = function (locker, currentFolderPath, lintbotFileParsed, lintbotFile, lintbotIgnoreFile) {
  missingFiles = [];
  locker.reset();

  lockLintbotFile(locker, lintbotFile);
  lockLintbotIgnoreFile(locker, lintbotIgnoreFile);

  if (lintbotFile.html) lockFiles(locker, currentFolderPath, lintbotFile.html);
  if (lintbotFile.css) lockFiles(locker, currentFolderPath, lintbotFile.css);
  if (lintbotFile.js) lockFiles(locker, currentFolderPath, lintbotFile.js);
  if (lintbotFile.screenshots) lockScreenshots(locker, currentFolderPath, lintbotFile.screenshots);
  if (lintbotFileParsed.screenshots) lockScreenshots(locker, currentFolderPath, lintbotFileParsed.screenshots);

  missingFiles = [...new Set(missingFiles)];

  if (missingFiles.length > 0) {
    lintbotMain.send('alert', `The following files could not be locked because they’re missing:\n• ${missingFiles.join('\n• ')}`);
  }
};

module.exports = {
  lock: lock
};
