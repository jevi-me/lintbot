'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.naming || lintbotFile.restrictFileTypes) {
    let task = {
      group: `naming-${Date.now()}`,
      groupLabel: 'Naming & file restrictions',
      options: {},
    };

    if (lintbotFile.naming) task.options.naming = true;
    if (lintbotFile.restrictFileTypes) task.options.restrictFileTypes = true;
    if (lintbotFile.namingIgnore) task.options.namingIgnore = lintbotFile.namingIgnore;

    tasks.push(task);
  }

  return tasks;
};
