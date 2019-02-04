'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.screenshots) {
    let task = {
      group: `screenshots-${Date.now()}`,
      groupLabel: 'Screenshots',
      options: {
        files: lintbotFile.screenshots,
      },
    };

    tasks.push(task);
  }

  return tasks;
};
