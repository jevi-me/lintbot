'use strict';

const pkg = require('../package');

module.exports.get = function () {
  return `Lintbot/${pkg.version} (+https://github.com/jevi-me/lintbot)`;
};
