'use strict';

const util = require('util');
const cheerio = require('cheerio');
const parse5 = require('parse5');
const htmlparser2Adapter = require('parse5-htmlparser2-tree-adapter');
const merge = require('merge-objects');
const lintbotMain = require('electron').remote.require('./app/lintbot-main');
const messageGroup = require(`${__dirname}/../message-group`);

const convertToCheckObject = function (sel, defaultMessage) {
  let obj = {
    check: false,
    selector: false,
    limit: false,
    message: '',
    customMessage: '',
    lines: false,
    type: 'error',
  };

  if (typeof sel === 'string') {
    obj.selector = sel;
  } else {
    if (Array.isArray(sel)) {
      if (sel.length > 1) obj.customMessage = sel[1];
      obj.selector = sel[0];
    } else {
      obj = Object.assign(obj, sel);

      if (obj.message) {
        obj.customMessage = obj.message;
        obj.message = '';
      }

      if (obj.check) obj.selector = obj.check;

      if (Array.isArray(obj.selector)) {
        if (obj.selector.length > 1) obj.customMessage = obj.selector[1];
        obj.selector = obj.selector[0];
      }
    }
  }

  if (!obj.message) obj.message = defaultMessage.replace(/\{\{sel\}\}/g, obj.selector);

  return obj;
};

const convertToHasObject = function (sel) {
  return convertToCheckObject(sel, 'Expected to see this element: `{{sel}}`');
};

const convertToHasNotObject = function (sel) {
  return convertToCheckObject(sel, 'The `{{sel}}` element should not be used');
};

const bypass = function (checkGroup, checkId, checkLabel) {
  lintbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const checkHasElements = function (code, sels) {
  var allMessages = messageGroup.new();

  sels.forEach(function (sel) {
    let check = convertToHasObject(sel);

    try {
      let results = code(check.selector);

      if (results.length <= 0) {
        allMessages = messageGroup.bind(check, allMessages);
      }

      if (check.limit && results.length > check.limit) {
        let plural = (check.limit === 1) ? '' : 's';
        check.message = `Expected to see the \`${check.selector}\` element at most ${check.limit} time${plural}`;
        allMessages = messageGroup.bind(check, allMessages);
      }
    } catch (e) {
      allMessages = messageGroup.bind(check, allMessages);
    }
  });

  return allMessages;
};

const checkHasNotElements = function (code, sels) {
  var allMessages = messageGroup.new();

  sels.forEach(function (sel) {
    let check = convertToHasNotObject(sel);

    try {
      let results = code(check.selector);

      if (results.length > 0) {
        let lines = [];

        results.each((i, elem) => lines.push(elem.sourceCodeLocation.startLine));
        check.lines = lines;
        allMessages = messageGroup.bind(check, allMessages);
      }
    } catch (e) {
      lintbotMain.debug(`Line ${e.lineNumber}: ${e.message}`);
      allMessages = messageGroup.bind(check, allMessages);
    }
  });

  return allMessages;
};

const check = function (checkGroup, checkId, checkLabel, fileContents, hasSels, hasNotSels, next) {
  let code = {};
  let allMessages;
  const parsedHtml = parse5.parse(fileContents, {
    treeAdapter: htmlparser2Adapter,
    sourceCodeLocationInfo: true,
  });

  lintbotMain.send('check-group:item-computing', checkGroup, checkId);

  code = cheerio.load(parsedHtml.children);
  allMessages = merge(checkHasElements(code, hasSels), checkHasNotElements(code, hasNotSels));

  lintbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, allMessages.errors, allMessages.messages, allMessages.warnings);
  next();
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkLabel = 'Required elements';
    const checkId = 'elements';

    lintbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fileContents, hasSels, hasNotSels, next) {
        check(checkGroup, checkId, checkLabel, fileContents, hasSels, hasNotSels, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
