(function () {
  'use strict';

  const https = require('https');
  const lintbotMain = require('electron').remote.require('./app/lintbot-main');
  const userAgentService = require(`${__dirname}/user-agent-service`);

  const group = taskDetails.group;
  const repo = taskDetails.options.repo;
  const username = taskDetails.options.username;
  const id = 'live-website';
  const label = 'Online';
  const errors = [`**Your website is not online.** Double check that all the commits have been pushed & that the \`index.html\` file, on GitHub’s website, follows the naming conventions. @@https://${username.toLowerCase()}.github.io/${repo}/@@`];
  const dtNow = Date.now();
  const opts = {
    method: 'HEAD',
    host: `${username.toLowerCase()}.github.io`,
    path: `/${repo}/?dt=${dtNow}`,
    headers: {
      'User-Agent': userAgentService.get(),
    }
  };

  lintbotMain.send('check-group:item-new', group, id, label);
  lintbotMain.send('check-group:item-computing', group, id, label);

  https.get(opts, function (res) {
    if(res.statusCode >= 200 && res.statusCode <= 299) {
      lintbotMain.send('check-group:item-complete', group, id, label, false, [`**Your website is online!** Check it out in your browser or on your mobile device:  @@https://${username.toLowerCase()}.github.io/${repo}/@@`]);
    } else {
      lintbotMain.send('check-group:item-complete', group, id, label, errors);
    }

    done();
  }).on('error', function (e) {
    lintbotMain.send('check-group:item-complete', group, id, label, errors);
    done();
  });
}());
