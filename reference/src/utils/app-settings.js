// app-settings.js - 持久化应用设置
const fs = require('fs');
const path = require('path');

class AppSettings {
    constructor() {
        this.settingsPath = path.join(__dirname, '../../userdata/app-settings.json');
        this.settings = this._load();
    }

    _load() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                return JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
            }
        } catch (e) {}
        return {};
    }

    _save() {
        try {
            const dir = path.dirname(this.settingsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
        } catch (e) {
            console.error('保存设置失败:', e.message);
        }
    }

    get(key, defaultValue) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    set(key, value) {
        this.settings[key] = value;
        this._save();
    }
}

module.exports = new AppSettings();
