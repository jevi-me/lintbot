'use strict';

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.liveWebsite && lintbotFile.repo) {
    let task = {
      group: `live-website-${Date.now()}`,
      groupLabel: 'Live website',
      options: {
        repo: lintbotFile.repo,
        username: lintbotFile.username,
      },
    };

    tasks.push(task);
  }

  return tasks;
};
