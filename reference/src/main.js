const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'assets/icons/icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'pages/index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 窗口控制 IPC
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// 对话框 IPC
ipcMain.handle('dialog-open', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('dialog-save', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
