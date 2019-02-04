'use strict';

module.exports.generateTaskList = function (lintbotFile, isCheater) {
  var tasks = [];

  if (lintbotFile.html && lintbotFile.allFiles && lintbotFile.allFiles.html && lintbotFile.allFiles.html.unique) {
    tasks.push({
      group: `html-unique-${Date.now()}`,
      groupLabel: 'All files',
      options: {
        files: lintbotFile.html,
        unique: lintbotFile.allFiles.html.unique,
      },
    });
  }

  return tasks;
};
