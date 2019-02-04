'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const merge = require('merge-objects');
const glob = require('glob');

const lintbotMain = require('./lintbot-main');
const lintbotIgnoreParser = require('./lintbot-ignore-parser');
const exists = require('./file-exists');
const stripPath = require('./strip-path');

const accessibilityTemplates = [
  'accessibility',
  'aria-landmarks',
  'html',
  'forms',
];

const getFileCodeLang = function (fullPath) {
  return fullPath.match(/\.(html|css|js)$/)[1];
};

const getAlternativeExtensions = function (ext) {
  switch (ext) {
    // case 'md':
      // return 'md|yml';
      // break;
    default:
      return ext;
  }
};

const isCheckingAccessibility = function (lintbotFile) {
  if (lintbotFile.allFiles && lintbotFile.allFiles.html && lintbotFile.allFiles.html.accessibility) return true;

  if (lintbotFile.html) {
    let i = 0, total = lintbotFile.html.length;

    for (i = 0; i < total; i++) {
      if (lintbotFile.html[i].accessibility) return true;
    }
  }

  return false;
};

const bindAccessibilityProperties = function (lintbotFile) {
  const forcedProperties = [
    'outline',
  ];

  if (lintbotFile.allFiles && lintbotFile.allFiles.html && lintbotFile.allFiles.html.accessibility) {
    forcedProperties.forEach((prop) => {
      lintbotFile.allFiles.html[prop] = true;
    });
  }

  if (lintbotFile.html) {
    let i = 0, total = lintbotFile.html.length;

    for (i = 0; i < total; i++) {
      if (lintbotFile.html[i].accessibility) {
        forcedProperties.forEach((prop) => {
          lintbotFile.html[i][prop] = true;
        });
      }
    }
  }

  return lintbotFile;
};

const findCompatibleFiles = function (folderpath, ignore, ext) {
  const fullPath = path.resolve(folderpath);
  const minFileExts = new RegExp(`min\.(${ext})$`);
  const ignoreRegExps = ignore.map((item) => new RegExp(`^${item}`));
  const totalIgnores = ignoreRegExps.length;
  let files = glob.sync(`${fullPath}/**/*.+(${ext})`);

  if (!files) return [];

  files = files.filter((file) => {
    let strippedFile = stripPath(file, folderpath);

    if (file.match(minFileExts)) return false;

    for (let i = 0; i < totalIgnores; i++) {
      if (ignoreRegExps[i].test(strippedFile)) return false;
    }

    return true;
  });

  return files;
};

const mergeInheritedFiles = function (lintbotFile) {
  let newLintbotFile = {
    inheritFilesNotFound: [],
  };
  let templates = [];

  if (typeof lintbotFile.inherit === 'string') lintbotFile.inherit = [lintbotFile.inherit];

  lintbotFile.inherit.forEach((templateId) => {
    let inheritPath = path.resolve(`${__dirname}/../templates/${templateId}.yml`);

    if (exists.check(inheritPath)) {
      try {
        let y = yaml.safeLoad(fs.readFileSync(inheritPath, 'utf8'));
        if (y) templates.push(y);
      } catch (e) {
        let ln = (e.mark && e.mark.line) ? e.mark.line + 1 : '?';
        lintbotMain.debug(`Error in the \`${templateId}\` template LintbotFile, line ${ln}: ${e.message}`);
      }
    } else {
      newLintbotFile.inheritFilesNotFound.push(templateId);
    }
  });

  templates.forEach((file) => {
    if (file.allFiles && file.allFiles.functionality && !Array.isArray(file.allFiles.functionality)) file.allFiles.functionality = [file.allFiles.functionality];

    newLintbotFile = merge(newLintbotFile, file);
  });

  newLintbotFile = merge(newLintbotFile, lintbotFile);

  return newLintbotFile;
};

const bindFunctionalityToHtmlFiles = function (lintbotFile) {
  if (lintbotFile.allFiles && lintbotFile.allFiles.functionality && lintbotFile.html) {
    if (!lintbotFile.functionality) lintbotFile.functionality = [];

    lintbotFile.html.forEach((file) => {
      lintbotFile.allFiles.functionality.forEach((func) => {
        lintbotFile.functionality.push(merge({ path: file.path }, func));
      })
    });
  }

  return lintbotFile;
};

const bindScreenshotsToHtmlFiles = function (lintbotFile) {
  if (lintbotFile.allFiles && lintbotFile.allFiles.html && lintbotFile.allFiles.html.screenshots) {
    if (!lintbotFile.screenshots) lintbotFile.screenshots = [];

    lintbotFile.html.forEach((item, i) => {
      lintbotFile.screenshots.push({
        path: item.path,
        sizes: lintbotFile.allFiles.html.screenshots,
      });
    });
  }

  return lintbotFile;
};

const mergeAllFilesProperties = function (lintbotFile, key) {
  if (!lintbotFile[key]) return lintbotFile;

  lintbotFile[key].forEach((item, i) => {
    if (!lintbotFile.allFiles[key]) return;

    if ('path' in lintbotFile[key][i] && lintbotFile.allFiles[key].except) {
      if (lintbotFile.allFiles[key].except.includes(lintbotFile[key][i].path)) return;
    }

    lintbotFile[key][i] = merge(Object.assign({}, lintbotFile.allFiles[key]), item);
  });

  return lintbotFile;
};

const bindAllFilesProperties = function (folderpath, ignoreFiles, lintbotFile, next) {
  const keys = ['html', 'css', 'js', 'md', 'yml', 'files', 'functionality', 'performance', 'unittests'];

  keys.forEach((key) => {
    if (!lintbotFile[key] && !lintbotFile.allFiles[key]) return;

    if (lintbotFile.allFiles[key] && !lintbotFile[key]) {
      let files = findCompatibleFiles(folderpath, ignoreFiles, getAlternativeExtensions(key));

      if (!files) next(lintbotFile);

      files.forEach((file) => {
        if (!lintbotFile[key]) lintbotFile[key] = [];

        lintbotFile[key].push({ path: stripPath(file, folderpath), });
      });
    }

    lintbotFile = mergeAllFilesProperties(lintbotFile, key);
  });

  next(lintbotFile);
};

const removeDuplicateScreenshotSizes = function (lintbotFile) {
  if (!lintbotFile.screenshots) return lintbotFile;

  lintbotFile.screenshots.forEach((item, i) => {
    if (Array.isArray(lintbotFile.screenshots[i].sizes)) {
      lintbotFile.screenshots[i].sizes = [...new Set(lintbotFile.screenshots[i].sizes)];
    }
  });

  return lintbotFile;
};

const mergeDuplicateFiles = function (lintbotFile) {
  const keys = ['html', 'css', 'js', 'md', 'yml', 'files', 'performance', 'unittests'];

  keys.forEach((key) => {
    let paths = {};
    let dirs = {};

    if (!lintbotFile[key]) return;

    lintbotFile[key].forEach((item, i) => {
      if (!item.path) return;

      if (item.path in paths) {
        paths[item.path] = merge(paths[item.path], item);
      } else {
        paths[item.path] = item;
      }
    });

    lintbotFile[key].forEach((item, i) => {
      if (!item.directory) return;

      if (item.directory in dirs) {
        dirs[item.directory] = merge(dirs[item.directory], item);
      } else {
        dirs[item.directory] = item;
      }
    });

    lintbotFile[key] = [];

    Object.keys(paths).forEach((path) => {
      lintbotFile[key].push(paths[path]);
    });

    Object.keys(dirs).forEach((path) => {
      lintbotFile[key].push(dirs[path]);
    });
  });

  return removeDuplicateScreenshotSizes(lintbotFile);
};

const populateDefaults = function (folderpath, ignoreFiles, lintbotFile, next) {
  const lintbotFileOriginal = JSON.parse(JSON.stringify(lintbotFile));

  if (isCheckingAccessibility(lintbotFile)) {
    if (lintbotFile.inherit) {
      lintbotFile.inherit = [...new Set(lintbotFile.inherit.concat(accessibilityTemplates))];
    } else {
      lintbotFile.inherit = accessibilityTemplates;
    }

    lintbotFile = bindAccessibilityProperties(lintbotFile);
  }

  if (!lintbotFile.allFiles && !lintbotFile.inherit) return next(lintbotFile, ignoreFiles, lintbotFileOriginal);
  if (lintbotFile.inherit) lintbotFile = mergeInheritedFiles(lintbotFile);

  if (lintbotFile.allFiles) {
    bindAllFilesProperties(folderpath, ignoreFiles, lintbotFile, (mf) => {
      next(mergeDuplicateFiles(bindScreenshotsToHtmlFiles(bindFunctionalityToHtmlFiles(mf))), ignoreFiles, lintbotFileOriginal);
    });
  } else {
    next(mergeDuplicateFiles(lintbotFile), ignoreFiles, lintbotFileOriginal);
  }
}

const getLintbotFile = function (lintbotFilePath, next) {
  let lintbotFile, folderpath;

  try {
    lintbotFile = yaml.safeLoad(fs.readFileSync(lintbotFilePath, 'utf8'));
  } catch (e) {
    let ln = (e.mark && e.mark.line) ? e.mark.line + 1 : '?';
    lintbotMain.debug(`Error in the folder’s LintbotFile, line ${ln}: ${e.message}`);
  }

  folderpath = path.parse(lintbotFilePath).dir;

  lintbotIgnoreParser.parse(folderpath, (ignoreFiles) => {
    populateDefaults(folderpath, ignoreFiles, lintbotFile, next);
  });
};

const buildFromFolder = function (folderpath, next) {
  let lintbotFile;

  try {
    lintbotFile = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname + '/../templates/basic-dropped-folder.yml'), 'utf8'));
  } catch (e) {
    let ln = (e.mark && e.mark.line) ? e.mark.line + 1 : '?';
    lintbotMain.debug(`Error in the \`basic-dropped-folder\` LintbotFile, line ${ln}: ${e.message}`);
  }

  lintbotIgnoreParser.parse(folderpath, (ignoreFiles) => {
    populateDefaults(folderpath, ignoreFiles, lintbotFile, next);
  });
};

module.exports = {
  get: getLintbotFile,
  buildFromFolder: buildFromFolder
};
