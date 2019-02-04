'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.performance) {
    let task = {
      group: `performance-${Date.now()}`,
      groupLabel: 'Performance',
      options: {
        files: lintbotFile.performance,
      },
    };

    tasks.push(task);
  }

  return tasks;
};
