const __LintbotInjectedFunctions = {

  failed: false,

  $: function (sel, trgt = document) {
    try {
      const result = trgt.querySelector(sel);

      if (!result) __LintbotInjectedFunctions.fail(`The element, \`${sel}\`, doesn’t exist on the page`);

      return result;
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  $$: function (sel, trgt = document) {
    try {
      const results = trgt.querySelectorAll(sel);

      if (!results) __LintbotInjectedFunctions.fail(`The \`${sel}\` elements don’t exist on the page`);

      return results;
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  css: function (elem) {
    try {
      return getComputedStyle(elem);
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  bounds: function (elem) {
    try {
      return elem.getBoundingClientRect();
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  offset: function (elem) {
    try {
      let bounds = elem.getBoundingClientRect();

      return {
        left: bounds.left + window.scrollX,
        top: bounds.top + window.scrollY,
      };
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  on: function (sel, evt, next, timeoutLength = 2000) {
    try {
      let eventHandlerTimeout;

      document.addEventListener(evt, function (e) {
        try {
          if ((typeof sel != 'string' && e.target === sel) || (typeof sel == 'string' && e.target.matches(sel))) {
            clearTimeout(eventHandlerTimeout);
            next(false, e);
          }
        } catch (e) {
          __LintbotInjectedFunctions.debugFail(e);
        }
      });

      eventHandlerTimeout = setTimeout(function () {
        clearTimeout(eventHandlerTimeout);
        next(true);
      }, timeoutLength);
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  ev: function (eventStr, opts = {}) {
    try {
      let defaultOpts = { bubbles: true, cancelable: true };
      let allOpts = Object.assign(defaultOpts, opts);

      switch (eventStr) {
        case 'click':
        case 'dblclick':
        case 'mouseup':
        case 'mousedown':
        case 'mouseover':
        case 'mouseout':
        case 'mouseenter':
        case 'mouseleave':
        case 'mousemove':
          return new MouseEvent(eventStr, allOpts);
          break;
        case 'keypress':
        case 'keydown':
        case 'keyup':
          return new KeyboardEvent(eventStr, allOpts);
          break;
        default:
          return new Event(eventStr, allOpts);
          break;
      }
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  send: function (eventStr, opts = {}, next = null) {
    try {
      let defaultOpts = { type: eventStr, isTrusted: true };
      let allOpts = Object.assign(defaultOpts, opts);

      window.__lintbot.sendInputEventToWindow(__LintbotInjectedFunctions.browserWindowId, allOpts);

      if (next) {
        setTimeout(function () {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(function () {
                next();
              });
            });
          });
        }, 50);
      }
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  sendTrustedMouseEvent: function (sel, ev, errType, next) {
    try {
      const elem = (typeof sel === 'string') ? __LintbotInjectedFunctions.$(sel) : sel;
      let rect, x, y;

      elem.scrollIntoView();

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          rect = elem.getBoundingClientRect();
          x = Math.round(rect.left + (rect.width / 2));
          y = Math.round(rect.top + (rect.height / 2));

          // if (window.outerHeight < y) window.resizeTo(window.outerWidth, y + 100);
          // if (window.outerWidth < x) window.resizeTo(x + 100, window.outerHeight);
          if (rect.width <= 0) return __LintbotInjectedFunctions.fail(`Lintbot can’t ${errType} the element \`${sel}\` because its width is \`0px\``);
          if (rect.height <= 0) return __LintbotInjectedFunctions.fail(`Lintbot can’t ${errType} the element \`${sel}\` because its height is \`0px\``);

          __LintbotInjectedFunctions.send(ev, {
            x: (x < 0) ? 0 : x,
            y: (y < 0) ? 0 : y,
          }, next);
        });
      });
    } catch (e) {
      __LintbotInjectedFunctions.debugFail(e);
    }
  },

  hover: function (sel, next) {
    __LintbotInjectedFunctions.sendTrustedMouseEvent(sel, 'mouseMove', 'hover', next);
  },

  activate: function (sel, next) {
    __LintbotInjectedFunctions.sendTrustedMouseEvent(sel, 'mouseDown', 'activate', next);
  },

  done: function () {
    window.__lintbot.sendMessageToWindow(__LintbotInjectedFunctions.taskRunnerId, __LintbotInjectedFunctions.doneLabel, __LintbotInjectedFunctions.browserWindowId);
  },

  pass: function () {
    if (!__LintbotInjectedFunctions.failed) window.__lintbot.sendMessageToWindow(__LintbotInjectedFunctions.taskRunnerId, __LintbotInjectedFunctions.passLabel, __LintbotInjectedFunctions.browserWindowId);
  },

  fail: function (reason) {
    __LintbotInjectedFunctions.failed = true;
    window.__lintbot.sendMessageToWindow(__LintbotInjectedFunctions.taskRunnerId, __LintbotInjectedFunctions.failLabel, reason, __LintbotInjectedFunctions.browserWindowId);
  },

  convertElementToString: function (elem) {
    const id = (elem.id) ? `#${elem.id}` : '';
    let classes = [];

    if (elem.classList.length > 0) {
      for (let theClass of elem.classList) {
        classes.push(`.${theClass}`);
      }
    }

    return '&lt;' + elem.tagName.toLowerCase() + id + classes.join('') + '&gt;';
  },

  convertNodeListToString: function (elems) {
    const prettyElems = [];

    for (let elem of elems) {
      prettyElems.push(__LintbotInjectedFunctions.convertElementToString(elem));
    }

    return `[${prettyElems.join(', ')}]`;
  },

  debug: function (...message) {
    let args = message.map((arg) => {
      if (arg instanceof NodeList) return __LintbotInjectedFunctions.convertNodeListToString(arg);
      if (arg instanceof HTMLElement) return __LintbotInjectedFunctions.convertElementToString(arg);
      if (arg === null) return 'null';
      if (arg === void 0) return 'undefined';
      if (typeof arg === 'object' && arg.toString) return arg.toString();

      return arg;
    });

    window.__lintbot.sendMessageToWindow(__LintbotInjectedFunctions.taskRunnerId, __LintbotInjectedFunctions.debugLabel, ...args);
  },

  debugFail: function (e) {
    if (e.message) __LintbotInjectedFunctions.debug(`Functionality testing error, test #${__LintbotInjectedFunctions.testIndex} —`, e.message);
    __LintbotInjectedFunctions.fail('Double check the Javascript');
  },

};
