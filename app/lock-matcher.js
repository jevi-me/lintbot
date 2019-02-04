'use strict';

module.exports.match = function (primary, secondary, lintbotIgnoreFile) {
  let isCheater = false;
  let matches = {};

  if (primary) {
    for (let key in primary) {
      if (secondary[key] && primary[key] == secondary[key]) {
        matches[key] = {
          equal: true,
          expectedHash: primary[key],
          actualHash: secondary[key],
        };
      } else {
        matches[key] = {
          equal: false,
          expectedHash: primary[key],
          actualHash: secondary[key],
        };
        isCheater = true;
      }
    }
  } else {
    isCheater = true;
  }

  if (!matches.lintbot) {
    isCheater = true;
    matches.lintbot = {
      equal: false,
      expectedHash: false,
      actualHash: false,
    };
  }

  if (!matches.lintbotignore && lintbotIgnoreFile.length > 0) {
    isCheater = true;
    matches.lintbotignore = {
      equal: false,
      expectedHash: false,
      actualHash: false,
    };
  }

  return {
    cheated: isCheater,
    matches: matches
  };
};
