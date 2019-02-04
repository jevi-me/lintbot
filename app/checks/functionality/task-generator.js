'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.functionality) {
    let task = {
      group: `functionality-${Date.now()}`,
      groupLabel: 'Functionality',
      options: {
        files: lintbotFile.functionality,
      },
    };

    tasks.push(task);
  }

  return tasks;
};
