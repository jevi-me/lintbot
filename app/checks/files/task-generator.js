'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.files) {
    let task = {
      group: `files-${Date.now()}`,
      groupLabel: 'Files & images',
      options: {
        files: lintbotFile.files,
      },
    };

    tasks.push(task);
  }

  return tasks;
};
