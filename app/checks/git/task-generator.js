'use strict';

let config = require(__dirname + '/../../../config.json');

module.exports.generateTaskList = function (lintbotFile) {
  var tasks = [];

  if (lintbotFile.commits || lintbotFile.git) {
    let task = {
      group: `git-${Date.now()}`,
      groupLabel: 'Git & GitHub',
      options: {},
    };

    if (!lintbotFile.git && lintbotFile.commits) {
      task.options = {
        numCommits: lintbotFile.commits,
      };
    } else {
      task.options = lintbotFile.git;
    }

    task.options.ignoreCommitEmails = config.ignoreCommitEmails;

    tasks.push(task);
  }

  return tasks;
};
