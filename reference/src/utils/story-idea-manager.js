// story-idea-manager.js - 故事创意管理
const fs = require('fs');
const path = require('path');

class StoryIdeaManager {
    constructor() {
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
    }

    loadStoryIdea(name) {
        const filePath = path.join(this.projectsDir, name, 'configs', 'story-idea.json');
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                return data.idea || '';
            }
        } catch (e) {}
        return '';
    }

    saveStoryIdea(name, idea) {
        const configDir = path.join(this.projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            path.join(configDir, 'story-idea.json'),
            JSON.stringify({ idea: idea }, null, 2),
            'utf-8'
        );
    }
}

module.exports = StoryIdeaManager;
