// prompt-manager.js - 提示词管理
const fs = require('fs');
const path = require('path');

class PromptManager {
    constructor() {
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
    }

    loadPrompts(name) {
        const filePath = path.join(this.projectsDir, name, 'configs', 'prompts.json');
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {}
        return null;
    }

    savePrompts(name, prompts) {
        const configDir = path.join(this.projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'prompts.json'), JSON.stringify(prompts, null, 2), 'utf-8');
    }
}

module.exports = PromptManager;
