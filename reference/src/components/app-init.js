// app-init.js - 应用初始化
(function() {
    const fs = require('fs');
    const path = require('path');

    // 显示版本号
    try {
        const verPath = path.join(__dirname, '../ver.json');
        const ver = JSON.parse(fs.readFileSync(verPath, 'utf-8'));
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = 'v' + ver.version;
    } catch (e) {
        console.error('读取版本信息失败:', e.message);
    }
})();
