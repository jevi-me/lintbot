'use strict';

module.exports.generateTaskList = function (lintbotFile, isCheater) {
  var tasks = [];

  if (lintbotFile.yml) {
    lintbotFile.yml.forEach(function (file) {
      let task = {
        group: `yml-${file.path}-${Date.now()}`,
        groupLabel: file.path,
        options: {
          file: file,
          cheater: (isCheater.matches[file.path]) ? !isCheater.matches[file.path].equal : (isCheater.cheated) ? true : false,
        },
      };

      tasks.push(task);
    });
  }

  return tasks;
};
