'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.unittests) {
    let task = {
      group: `unittests-${Date.now()}`,
      groupLabel: 'Unit Tests',
      options: {
        path: lintbotFile.unittests.path,
        urls: lintbotFile.unittests.urls,
        labels: lintbotFile.unittests.labels,
        displayLabel:[],
        listenerLabel:[],
      },
    };
    tasks.push(task);
  }
  return tasks;
};
