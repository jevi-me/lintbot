(function () {
  'use strict';

  const path = require('path');
  const lintbotMain = require('electron').remote.require('./app/lintbot-main');
  const htmlUnique = require(__dirname + '/checks/all-files/html-unique');

  const group = taskDetails.group;
  const id = 'html-unique';
  const label = 'HTML unique content';

  let uniqueCapture = {};
  let uniqueErrors = [];

  lintbotMain.send('check-group:item-new', group, id, label);
  lintbotMain.send('check-group:item-computing', group, id, label);

  taskDetails.options.files.forEach(function (file) {
    let uniqueFinds = htmlUnique.find(taskDetails.cwd, file, taskDetails.options.unique);

    if (uniqueFinds === false) uniqueErrors.push(`The \`${file.path}\` file cannot be found`);

    for (let uniq in uniqueFinds) {
      if (!uniqueCapture[uniq]) uniqueCapture[uniq] = {};
      if (!uniqueCapture[uniq][uniqueFinds[uniq]]) uniqueCapture[uniq][uniqueFinds[uniq]] = [];
      uniqueCapture[uniq][uniqueFinds[uniq]].push(file.path);
    }
  });

  for (let uniq in uniqueCapture) {
    for (let content in uniqueCapture[uniq]) {
      if (uniqueCapture[uniq][content].length > 1) {
        uniqueErrors.push(`These files share the same \`${uniq}\` but they all should be unique: \`${uniqueCapture[uniq][content].join('`, `')}\``);
      }
    }
  }

  lintbotMain.send('check-group:item-complete', group, id, label, uniqueErrors);
  done();
}());
