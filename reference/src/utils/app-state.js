// app-state.js - 全局状态单例（持久化到 app-settings）
const AppSettings = require('./app-settings');

class AppState {
    constructor() {
        this._novel = AppSettings.get('lastNovel', '');
        this._category = AppSettings.get('lastCategory', '');
    }

    getNovel() {
        return this._novel;
    }

    setNovel(name) {
        this._novel = name || '';
        AppSettings.set('lastNovel', this._novel);
    }

    getCategory() {
        return this._category;
    }

    setCategory(category) {
        this._category = category || '';
        AppSettings.set('lastCategory', this._category);
    }
}

module.exports = new AppState();
