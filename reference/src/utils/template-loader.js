// template-loader.js - 加载提示词模板和默认设定
const fs = require('fs');
const path = require('path');

class TemplateLoader {
    constructor() {
        this.templatesDir = path.join(__dirname, '../templates');
        this._promptTemplates = null;
        this._defaultSettings = null;
    }

    _loadPromptTemplates() {
        if (!this._promptTemplates) {
            const filePath = path.join(this.templatesDir, 'prompt-templates.json');
            this._promptTemplates = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return this._promptTemplates;
    }

    _loadDefaultSettings() {
        if (!this._defaultSettings) {
            const filePath = path.join(this.templatesDir, 'default-settings.json');
            this._defaultSettings = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return this._defaultSettings;
    }

    getAllPromptCategories() {
        const templates = this._loadPromptTemplates();
        const categories = templates.categories || templates;
        return Object.keys(categories)
            .filter(id => categories[id] && typeof categories[id] === 'object' && categories[id].name)
            .map(id => ({
                id: id,
                name: categories[id].name || id
            }));
    }

    getPromptTemplate(categoryId) {
        const templates = this._loadPromptTemplates();
        const categories = templates.categories || templates;
        return categories[categoryId] || null;
    }

    getAntiAiRules() {
        const templates = this._loadPromptTemplates();
        return templates.anti_ai_taste_rules || '';
    }

    getDefaultSettings(categoryId) {
        const settings = this._loadDefaultSettings();
        const categories = settings.categories || settings;
        return categories[categoryId] || null;
    }
}

module.exports = new TemplateLoader();
