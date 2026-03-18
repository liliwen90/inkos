// window-controls.js - 窗口控制（通过IPC）
(function() {
    const { ipcRenderer } = require('electron');

    const btnMin = document.getElementById('btn-minimize');
    const btnMax = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    if (btnMin) btnMin.addEventListener('click', () => {
        ipcRenderer.send('window-minimize');
    });

    if (btnMax) btnMax.addEventListener('click', () => {
        ipcRenderer.send('window-maximize');
    });

    if (btnClose) btnClose.addEventListener('click', () => {
        ipcRenderer.send('window-close');
    });
})();
