'use strict';

const
  electron = require('electron'),
  dialog = electron.dialog
;

module.exports.getMenuTemplate = function (app, mainWindow, listener, cbs) {
  var template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Repository…',
          accelerator: 'CmdOrCtrl+O',
          click: function (item, focusedWindow) {
            dialog.showOpenDialog({ title: 'Open Repository…', properties: ['openDirectory']}, function (paths) {
              if (paths && paths.length > 0) {
                listener.send('app:open-repo', paths[0]);
              } else {
                listener.send('app:file-missing');
              }
            });
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Run Checks',
          accelerator: 'CmdOrCtrl+R',
          click: function (item, focusedWindow) {
            listener.send('app:re-run');
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Reveal Folder',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: function (item, focusedWindow) {
            cbs.revealFolder();
          }
        },
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        },
      ]
    },
  ];

  if (process.platform == 'darwin') {
    template.unshift({
      label: 'Markbot',
      submenu: [
        {
          label: 'About Markbot',
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Sign Out',
          click:  function(item, focusedWindow) {
            listener.send('app:sign-out');
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Alt+R',
          click: function(item, focusedWindow) {
            listener.send('app:force-reload');
          }
        },
        {
          label: 'Debug',
          accelerator: (function() {
            if (process.platform == 'darwin') {
              return 'Alt+Command+I';
            } else {
              return 'Ctrl+Shift+I';
            }
          })(),
          click: function(item, focusedWindow) {
            mainWindow.toggleDevTools();
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide Markbot',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() { app.quit(); }
        },
      ]
    });
    // Window menu.
    template[2].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    );
  }

  if (process.platform == 'win32') {
    template[0].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Sign Out',
        click:  function(item, focusedWindow) {
          listener.send('app:sign-out');
        }
      },
      {
        label: 'Quit',
        accelerator: 'Ctrl+Q',
        click: function() { app.quit(); }
      }
    );
    template.splice(1, 0, {
      label: 'Develop',
      submenu: [
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Alt+R',
          click: function(item, focusedWindow) {
            listener.send('app:force-reload');
          }
        },
        {
          label: 'Debug',
          accelerator: (function() {
            if (process.platform == 'darwin') {
              return 'Alt+Command+I';
            } else {
              return 'Ctrl+Shift+I';
            }
          })(),
          click: function(item, focusedWindow) {
            mainWindow.toggleDevTools();
          }
        }
      ]
    });
  }

  return template;
};