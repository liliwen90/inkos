// settings-handler.js - 设定管理（角色状态/世界设定）
(function() {
    const fs = require('fs');
    const path = require('path');
    const NovelManager = require('../utils/novel-manager');
    const NovelGenerator = require('../utils/novel-generator');
    const TemplateLoader = require('../utils/template-loader');
    const AppState = require('../utils/app-state');

    const novelManager = new NovelManager();
    const generator = new NovelGenerator();
    const projectsDir = path.join(__dirname, '../../userdata/projects');

    const novelSelect = document.getElementById('settings-novel-select');
    const characterTextarea = document.getElementById('settings-character');
    const worldTextarea = document.getElementById('settings-world');
    const categoryDisplay = document.getElementById('current-category-display');

    // 加载项目列表
    function loadProjects() {
        const projects = novelManager.listProjects();
        novelSelect.innerHTML = '<option value="">默认设定</option>';
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            novelSelect.appendChild(opt);
        });
        const saved = AppState.getNovel();
        if (saved && novelSelect.querySelector(`option[value="${saved}"]`)) {
            novelSelect.value = saved;
            loadSettings(saved);
        }
    }

    function loadSettings(name) {
        if (!name) return;
        const configDir = path.join(projectsDir, name, 'configs');

        // 角色状态
        const stateFile = path.join(configDir, 'character-state.json');
        if (fs.existsSync(stateFile)) {
            characterTextarea.value = fs.readFileSync(stateFile, 'utf-8');
        } else {
            // 尝试加载默认模板
            const category = AppState.getCategory();
            if (category) {
                const defaults = TemplateLoader.getDefaultSettings(category);
                if (defaults && defaults.character_state_template) {
                    characterTextarea.value = JSON.stringify(defaults.character_state_template, null, 2);
                }
            }
        }

        // 世界设定
        const worldFile = path.join(configDir, 'world-bible.json');
        if (fs.existsSync(worldFile)) {
            worldTextarea.value = fs.readFileSync(worldFile, 'utf-8');
        } else {
            const category = AppState.getCategory();
            if (category) {
                const defaults = TemplateLoader.getDefaultSettings(category);
                if (defaults && defaults.world_bible_template) {
                    worldTextarea.value = JSON.stringify(defaults.world_bible_template, null, 2);
                }
            }
        }

        categoryDisplay.textContent = AppState.getCategory() || '未选择';
    }

    novelSelect.addEventListener('change', () => {
        loadSettings(novelSelect.value);
    });

    // 刷新设定
    document.getElementById('btn-load-settings').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        loadSettings(name);
        alert('设定已刷新');
    });

    // 保存角色状态
    document.getElementById('btn-save-character').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        const configDir = path.join(projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'character-state.json'), characterTextarea.value, 'utf-8');
        alert('角色状态已保存');
    });

    // 保存世界设定
    document.getElementById('btn-save-world').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        const configDir = path.join(projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'world-bible.json'), worldTextarea.value, 'utf-8');
        alert('世界设定已保存');
    });

    // AI状态建议
    document.getElementById('btn-generate-suggestion').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        const chIdx = parseInt(document.getElementById('suggest-chapter-index').value);
        if (!chIdx) { alert('请输入章节编号'); return; }

        const fileName = `第${chIdx}章.txt`;
        const content = novelManager.readChapter(name, fileName);
        if (!content) { alert('该章节不存在'); return; }

        try {
            const result = await generator.generateStateUpdate(name, chIdx, content);
            showEditModal('AI状态建议（确认后可保存到角色状态）', result, (edited) => {
                characterTextarea.value = edited;
            });
        } catch (e) {
            alert('生成失败: ' + e.message);
        }
    });

    loadProjects();
})();
