'use strict';

const ipcRenderer = require('electron').ipcRenderer;
const lintbotMain = require('electron').remote.require('./app/lintbot-main');
const webLoader = require(`${__dirname}/../../web-loader`);

const warningRules = [
  'href-no-hash',
];

const axeRules = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'section508', 'best-practice']
  },
};

const makeJs = function () {
  return `
    (function () {
      const axeRules = JSON.parse('${JSON.stringify(axeRules)}');
      const axe = window.__lintbot.getTestingService('a11y');

      axe.run(document, axeRules, (err, results) => {
        if (err) {
          window.__lintbot.sendMessageToWindow(${taskRunnerId}, '__lintbot-hidden-browser-a11y-error-${taskRunnerId}', 'There was an error running the accessibility tests—try running Lintbot again');
        } else {
          window.__lintbot.sendMessageToWindow(${taskRunnerId}, '__lintbot-hidden-browser-a11y-advice-${taskRunnerId}', JSON.stringify(results));
        }
      });
    }());
  `;
};

const isErrorWarning = function (err) {
  if (warningRules.includes(err.id)) return true;

  return false;
};

const isValidSkipLink = function (node) {
  return /\<a[^>]+href\=\"\#.+(skip|jump)/i.test(node.html);
};

const isAriaRoleRedudant = function (node) {
  const roleTests = [
    /\<header[^>]+role\s*=\s*"\s*banner/i,
    /\<nav[^>]+role\s*=\s*"\s*navigation/i,
    /\<main[^>]+role\s*=\s*"\s*main/i,
    /\<footer[^>]+role\s*=\s*"\s*contentinfo/i,
  ];
  let isRoleRedudant = false;
  let i = 0, t = roleTests.length;

  for (i; i < t; i++) {
    if (roleTests[i].test(node.html)) {
      isRoleRedudant = true;
      break;
    }
  }

  return isRoleRedudant;
};

const shouldIgnoreError = function (err) {
  // Ignore aria-details warnings while they're not supported by axe-core
  if (err.id === 'aria-valid-attr') {
    let numNodes = err.nodes.length;

    err.nodes.forEach((node) => {
      if (/aria-details/.test(node.failureSummary)) {
        numNodes--;
      }
    });

    if (numNodes <= 0) return true;
  }

  // Ignore role warnings when they denote roles are redundant
  if (err.id === 'aria-allowed-role') {
    let numNodes = err.nodes.length;

    err.nodes.forEach((node) => {
      if (isAriaRoleRedudant(node)) numNodes--;
    });

    if (numNodes <= 0) return true;
  }

  // Ignore region warnings when they're only concerned with the skip links outside a region
  if (err.id === 'region') {
    if (err.nodes.length > 0 && /\<html/.test(err.nodes[0].html)) {
      let numNodes = 0;

      if (err.nodes[0].any.length > 0 && err.nodes[0].any[0].relatedNodes.length > 0){
        numNodes = err.nodes[0].any[0].relatedNodes.length;

        err.nodes[0].any[0].relatedNodes.forEach((node) => {
          if (isValidSkipLink(node)) numNodes--;
        });

        if (numNodes <= 0) return true;
      }
    }
  }

  return false;
};

const shouldIncludeNode = function (node) {
  if (/aria-details/.test(node.failureSummary)) return false;
  if (/\<html/.test(node.html)) return false;
  if (isValidSkipLink(node)) return false;
  if (isAriaRoleRedudant(node)) return false;

  return true;
};

const constructErrorMessage = function (err) {
  let allTheNodes = err.nodes.map((node) => {
    if (shouldIncludeNode(node)) return `\`${node.html}\``;
  });
  let errMsg = err.help;
  let message = '';
  let relatedNodes = [];

  if (/\<html/.test(err.nodes[0].html)) {
    if (err.nodes[0].any[0] && err.nodes[0].any[0].relatedNodes) {
      err.nodes[0].any[0].relatedNodes.forEach((node) => {
        if (shouldIncludeNode(node)) relatedNodes.push(`\`${node.html}\``);
      });

      allTheNodes = allTheNodes.concat(relatedNodes);
    }
  }

  allTheNodes = allTheNodes.filter((item) => item != undefined);

  switch (err.id) {
    // Helpfully remind users that `tabindex="0"` is necessary on the element skip links point to
    case 'skip-link':
      errMsg += ', the element the skip link points must be focusable, try adding `tabindex="0"` to the element with the matching `id`';
      break;

    case 'region':
      errMsg += ', if the element is a skip link double check the text inside the `<a>` tag starts with exactly “skip” or “jump” (case insensitive)';
      break;
  }

  if (allTheNodes.length > 0) {
    message = `${errMsg}; the following elements are affected: ---+++${allTheNodes.join('+++')}---`;
  } else {
    message = errMsg;
  }

  return message;
};

const constructPositiveMessage = function (numPass, numFail) {
  const total = numPass + numFail;
  const percent = Math.round(100 - ((numFail / total) * 100));
  const passPlural = (numPass === 1) ? '' : 's';
  const failPlural = (numFail === 1) ? '' : 's';

  return {
    type: 'big-number',
    message: 'The website passes many accessibility tests, but there’s always room for improvement — make sure to do some real user testing',
    number: `${percent}%`,
    title: `Passed ${numPass} test${passPlural}`,
    desc: `Failed ${numFail} test${failPlural}`,
    grade: percent,
  };
};

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, taskRunnerId, file, next) {
  let win;

  const cleanup = function () {
    ipcRenderer.removeAllListeners(`__lintbot-hidden-browser-a11y-advice-${taskRunnerId}`);
    ipcRenderer.removeAllListeners(`__lintbot-hidden-browser-a11y-error-${taskRunnerId}`);
    webLoader.destroy(win);
    win = null;
  };

  ipcRenderer.on(`__lintbot-hidden-browser-a11y-advice-${taskRunnerId}`, (event, results) => {
    const a11yResults = JSON.parse(results);
    let errors = [];
    let messages = [];
    let warnings = [];
    let numPasses = a11yResults.passes.length;
    let numFails = a11yResults.violations.length;
    let positiveMessage;

    const introError = {
      type: 'intro',
      message: 'Refer to the accessibility checklist to help understand these errors:',
      link: 'https://learn-the-web.algonquindesign.ca/topics/accessibility-checklist/', //TODO: Fix link to algonquindesign
      linkText: 'https://mkbt.io/a11y-checklist/',
    };

    cleanup();

    if (numFails <= 0) {
      messages.push(constructPositiveMessage(numPasses, numFails));
      lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors, messages, warnings);
      return next();
    }

    a11yResults.violations.forEach((item) => {
      // DEBUG!
console.log(item);
      if (shouldIgnoreError(item)) {
        numPasses++;
        numFails--;
        return;
      }

      if (isErrorWarning(item)) {
        warnings.push(constructErrorMessage(item));
      } else {
        errors.push(constructErrorMessage(item));
      }
    });

    if (warnings.length > 0) warnings.unshift(introError);
    if (errors.length > 0) errors.unshift(introError);

    positiveMessage = constructPositiveMessage(numPasses, numFails);

    if (positiveMessage.grade >= 75) messages.push(positiveMessage);

    lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors, messages, warnings);
    next();
  });

  ipcRenderer.on(`__lintbot-hidden-browser-a11y-error-${taskRunnerId}`, (event, errMsg) => {
    cleanup();
    lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, [errMsg]);
    next();
  });

  lintbotMain.send('check-group:item-computing', checkGroup, checkId);

  webLoader.load(taskRunnerId, file.path, {}, (theWindow) => {
    win = theWindow;
    win.webContents.executeJavaScript(makeJs());
  });
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkLabel = 'Accessibility';
    const checkId = 'a11y';

    lintbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (taskRunnerId, file, next) {
        check(checkGroup, checkId, checkLabel, taskRunnerId, file, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
