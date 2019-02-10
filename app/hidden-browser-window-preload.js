/*!
 * =============================================================================
 * Internal abilities required for Lintbot to function
 * Isolates all the Node.js functionality away from the user scripts for security
 * =============================================================================
 */
window.__lintbot = (function () {
  'use strict';

  let fontsLoadedInterval;
  let animationPauseStyleTag;

  const getCurrentTaskWindowId = () => {
    if (window.__lintbotHiddenTestingWindowId) return window.__lintbotHiddenTestingWindowId;

    return document.referrer.replace(/^https:\/\//, '').replace(/\.running-task-windows\.lintbot\.web\-dev\.tools\/$/, '');
  };

  const sendMessageToWindow = function (windowId, messageId, ...message) {
    if (typeof windowId === 'string') windowId = parseInt(windowId, 10);

    if (windowId) require('electron').remote.BrowserWindow.fromId(windowId).webContents.send(messageId, ...message);
  };

  const sendInputEventToWindow = function (windowId, inputEvent) {
    if (typeof windowId === 'string') windowId = parseInt(windowId, 10);

    if (windowId) require('electron').remote.BrowserWindow.fromId(windowId).webContents.sendInputEvent(inputEvent);
  };

  const getTestingService = function (service) {
    switch (service) {
      case 'perf':
        return require('webcoach');
        break;
      case 'a11y':
        return require('axe-core');
        break;
      default:
        return false;
    }
  };

  const checkIfFontsDoneLoading = function () {
    if (document.fonts.status === 'loaded') {
      clearInterval(fontsLoadedInterval);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              process.nextTick(() => {
                setTimeout(() => {
                  sendMessageToWindow(getCurrentTaskWindowId(), '__lintbot-hidden-browser-window-fonts-loaded', {location: window.location.href});
                }, 100);
              });
            });
          });
        });
      });
    }
  };

  const pauseAnimations = function () {
    animationPauseStyleTag = document.createElement('style');
    animationPauseStyleTag.id = '__lintbot-style-chunk-animation-pause';
    animationPauseStyleTag.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
      }
    `;

    document.body.appendChild(animationPauseStyleTag);
  };

  const playAnimations = function () {
    if (animationPauseStyleTag) animationPauseStyleTag.remove();
  };

  fontsLoadedInterval = setInterval(checkIfFontsDoneLoading, 100);

  return {
    getCurrentTaskWindowId: getCurrentTaskWindowId,
    getTestingService: getTestingService,
    sendMessageToWindow: sendMessageToWindow,
    sendInputEventToWindow: sendInputEventToWindow,
    pauseAnimations: pauseAnimations,
    playAnimations: playAnimations,
  };
}());

/*!
 * =============================================================================
 * Document & window event catchers for events Lintbot needs to know about
 * =============================================================================
 */
window.addEventListener('error', (err) => {
  window.__lintbot.sendMessageToWindow(window.__lintbot.getCurrentTaskWindowId(), '__lintbot-functionality-error', err.message, err.lineno, err.filename);
});

window.addEventListener('load', (ev) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          process.nextTick(() => {
            window.__lintbot.sendMessageToWindow(window.__lintbot.getCurrentTaskWindowId(), '__lintbot-hidden-browser-window-loaded', {location: window.location.href});
          });
        });
      });
    });
  });
});

/*!
 * =============================================================================
 * Default to pausing the animations for more consistent screenshots
 * & functionality tests
 * =============================================================================
 */
document.addEventListener('DOMContentLoaded', (ev) => {
  window.__lintbot.pauseAnimations();
});

/*!
 * =============================================================================
 * Overwrite some Javascript functions so they can be better tested
 * =============================================================================
 */
window.alert = function (str) {
  return true;
};

window.confirm = function (str) {
  return true;
};

window.prompt = function (str) {
  return str;
};
