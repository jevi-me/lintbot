'use strict';
const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const enav = new (require('electron-navigation'))({
    showAddTabButton: false,
    showBackButton: false,
    showArrowButtons: false,
    showReloadButton: false,
    showForwardButton: false,
    closableTabs : false
    //showUrlBar: false
});


let placeholder = enav.newTab(`file://${__dirname}/no-reports.html`, {title:'No Reports', id:'placeholder'});

ipcRenderer.on('make-reports-window-tab', function (e, path, label) {
    if(placeholder){ enav.closeTab('placeholder'); }
    enav.newTab('file://' + path, {title: label, id: label});
    enav.prevTab();
});
