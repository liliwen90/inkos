// suggestion-handler.js - AI内容建议交互系统
// 在风格指纹分析完成后，加载AI建议并为所有手填字段提供选项
(function() {
    const fs = require('fs');
    const path = require('path');
    const StyleManager = require('../utils/style-manager');
    const PromptManager = require('../utils/prompt-manager');
    const StoryIdeaManager = require('../utils/story-idea-manager');
    const AppState = require('../utils/app-state');
    const suggestMgr = new StyleManager();
    const promptMgr = new PromptManager();
    const storyIdeaMgr = new StoryIdeaManager();
    const projectsDir = path.join(__dirname, '../../userdata/projects');

    let currentSuggestions = null;

    // 自动保存工具函数：chip点击后同时持久化到文件
    function autoSaveToFile(targetIds, value) {
        const name = AppState.getNovel();
        if (!name) return;
        const configDir = path.join(projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

        targetIds.forEach(tid => {
            switch(tid) {
                case 'settings-character':
                    fs.writeFileSync(path.join(configDir, 'character-state.json'), value, 'utf-8');
                    break;
                case 'settings-world':
                    fs.writeFileSync(path.join(configDir, 'world-bible.json'), value, 'utf-8');
                    break;
                case 'arc-editor':
                    try {
                        JSON.parse(value);
                        fs.writeFileSync(path.join(configDir, 'story-arc.json'), value, 'utf-8');
                    } catch (e) {}
                    break;
                case 'outline-story-idea':
                    storyIdeaMgr.saveStoryIdea(name, value);
                    break;
                case 'prompt-writer-role': {
                    const existing = promptMgr.loadPrompts(name) || { category: AppState.getCategory() };
                    existing.authorRole = value;
                    promptMgr.savePrompts(name, existing);
                    break;
                }
                case 'prompt-writing-rules': {
                    const existing = promptMgr.loadPrompts(name) || { category: AppState.getCategory() };
                    existing.creationRules = value;
                    promptMgr.savePrompts(name, existing);
                    break;
                }
            }
        });
    }

    // 所有需要建议的字段映射
    const fieldMap = {
        storyIdea: {
            targets: ['outline-story-idea', 'wizard-idea'],
            type: 'textarea-multi' // 多个选项
        },
        writerRole: {
            targets: ['prompt-writer-role'],
            type: 'textarea-single'
        },
        writingRules: {
            targets: ['prompt-writing-rules'],
            type: 'textarea-single'
        },
        characterState: {
            targets: ['settings-character'],
            type: 'textarea-json'
        },
        worldBible: {
            targets: ['settings-world'],
            type: 'textarea-json'
        },
        sceneBeats: {
            targets: ['beats-editor'],
            type: 'textarea-multi'
        },
        storyArc: {
            targets: ['arc-editor'],
            type: 'textarea-json'
        }
    };

    // 初始化：检查当前项目是否有建议
    function checkAndLoadSuggestions(projectName) {
        if (!projectName) {
            hideSuggestionPanels();
            currentSuggestions = null;
            return;
        }

        const suggestions = suggestMgr.loadSuggestions(projectName);
        if (suggestions && !suggestions.parseError) {
            currentSuggestions = suggestions;
            showSuggestionPanels(suggestions);
        } else {
            currentSuggestions = null;
            hideSuggestionPanels();
        }
    }

    // 显示所有建议面板
    function showSuggestionPanels(sug) {
        // 1. 故事创意建议
        if (sug.storyIdeas && sug.storyIdeas.length > 0) {
            const ideaChips = sug.storyIdeas.map(idea => ({
                label: idea.title,
                value: idea.content,
                tooltip: idea.content.substring(0, 80) + '...'
            }));
            showChips('suggest-storyIdea', ideaChips, ['outline-story-idea', 'wizard-idea']);
            // 同步到新建向导的建议面板
            showChips('suggest-wizardIdea', ideaChips, ['wizard-idea']);
        }

        // 2. 作者角色定义
        if (sug.writerRole) {
            showChips('suggest-writerRole', [{
                label: '🤖 采用AI推荐的角色定义',
                value: sug.writerRole,
                tooltip: sug.writerRole.substring(0, 80) + '...'
            }], ['prompt-writer-role']);
        }

        // 3. 创作规则
        if (sug.writingRules) {
            showChips('suggest-writingRules', [{
                label: '🤖 采用AI推荐的创作规则',
                value: sug.writingRules,
                tooltip: sug.writingRules.substring(0, 80) + '...'
            }], ['prompt-writing-rules']);
        }

        // 4. 人性化设置 — 自动推荐+标记
        if (sug.humanizeSettings) {
            applyHumanizeRecommendations(sug.humanizeSettings);
        }

        // 5. 角色声音卡片
        if (sug.voiceCards && sug.voiceCards.length > 0) {
            showVoiceCardSuggestion(sug.voiceCards);
        }

        // 6. 角色状态
        if (sug.characterState) {
            const json = JSON.stringify(sug.characterState, null, 2);
            showChips('suggest-characterState', [{
                label: '🤖 采用AI推荐的角色模板',
                value: json,
                tooltip: '基于学习的小说类型生成'
            }], ['settings-character']);
        }

        // 7. 世界设定
        if (sug.worldBible) {
            const json = JSON.stringify(sug.worldBible, null, 2);
            showChips('suggest-worldBible', [{
                label: '🤖 采用AI推荐的世界模板',
                value: json,
                tooltip: '基于学习的小说类型生成'
            }], ['settings-world']);
        }

        // 8. 场景节拍
        if (sug.sceneBeats && sug.sceneBeats.length > 0) {
            showChips('suggest-sceneBeats', sug.sceneBeats.map(bt => ({
                label: bt.title,
                value: bt.beats.map((b, i) => `${i + 1}. ${b}`).join('\n'),
                tooltip: bt.beats[0] + '...'
            })), ['beats-editor']);
        }

        // 9. 故事弧线
        if (sug.storyArc) {
            const json = JSON.stringify(sug.storyArc, null, 2);
            showChips('suggest-storyArc', [{
                label: '🤖 采用AI推荐的故事弧线',
                value: json,
                tooltip: `${(sug.storyArc.phases || []).length}个阶段`
            }], ['arc-editor']);
        }

        // 显示全局状态栏
        const statusBar = document.getElementById('ai-suggestions-status');
        if (statusBar) {
            statusBar.style.display = 'block';
            statusBar.querySelector('.suggest-status-text').textContent =
                `AI建议已就绪（基于${(sug.fromBooks || []).join('、')}）`;
        }
    }

    // 创建/更新建议面板的chips
    function showChips(panelId, chips, targetIds) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        panel.style.display = 'block';
        const chipsContainer = panel.querySelector('.ai-suggest-chips');
        if (!chipsContainer) return;

        chipsContainer.innerHTML = '';

        chips.forEach(chip => {
            const btn = document.createElement('button');
            btn.className = 'ai-suggest-chip';
            btn.title = chip.tooltip || '';
            btn.innerHTML = `<span class="chip-label">${chip.label}</span>`;
            btn.addEventListener('click', () => {
                // 填充到所有目标字段
                targetIds.forEach(tid => {
                    const el = document.getElementById(tid);
                    if (el) {
                        el.value = chip.value;
                        el.readOnly = false;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
                // 自动保存到文件
                autoSaveToFile(targetIds, chip.value);
                // 高亮当前选中的chip
                chipsContainer.querySelectorAll('.ai-suggest-chip').forEach(c => c.classList.remove('chip-active'));
                btn.classList.add('chip-active');
            });
            chipsContainer.appendChild(btn);
        });

        // 添加"自定义"选项
        const customBtn = document.createElement('button');
        customBtn.className = 'ai-suggest-chip chip-custom';
        customBtn.innerHTML = '<span class="chip-label">✏️ 自定义输入</span>';
        customBtn.addEventListener('click', () => {
            chipsContainer.querySelectorAll('.ai-suggest-chip').forEach(c => c.classList.remove('chip-active'));
            customBtn.classList.add('chip-active');
            // 聚焦到第一个目标字段
            const firstTarget = document.getElementById(targetIds[0]);
            if (firstTarget) {
                firstTarget.value = '';
                firstTarget.readOnly = false;
                firstTarget.focus();
            }
        });
        chipsContainer.appendChild(customBtn);
    }

    // 人性化设置推荐 — 自动选中AI推荐值+添加推荐标记
    function applyHumanizeRecommendations(settings) {
        const reasons = settings.reasons || {};

        // POV
        if (settings.pov) {
            markRadioRecommended('human-pov', settings.pov, reasons.pov);
        }

        // Tense
        if (settings.tense) {
            markRadioRecommended('human-tense', settings.tense, reasons.tense);
        }

        // Creativity
        if (settings.creativity) {
            const slider = document.getElementById('human-creativity');
            const valueEl = document.getElementById('human-creativity-value');
            if (slider) {
                slider.value = settings.creativity;
                if (valueEl) valueEl.textContent = settings.creativity;
            }
        }

        // Select dropdowns
        const selectFields = {
            'human-pacing': { value: settings.pacing, reason: reasons.pacing },
            'human-mood': { value: settings.mood, reason: reasons.mood },
            'human-show': { value: settings.showDontTell, reason: reasons.showDontTell },
            'human-dialogue': { value: settings.dialogue, reason: reasons.dialogue },
            'human-density': { value: settings.density, reason: reasons.density }
        };

        Object.entries(selectFields).forEach(([id, info]) => {
            if (!info.value) return;
            const sel = document.getElementById(id);
            if (sel) {
                sel.value = info.value;
                // 添加推荐标记
                addRecommendBadge(sel, info.reason);
            }
        });

        // 自动保存人性化设置到文件
        const name = AppState.getNovel();
        if (name) {
            suggestMgr.saveHumanizationSettings(name, {
                pov: settings.pov || 'third-limited',
                tense: settings.tense || 'past',
                creativity: settings.creativity || 5,
                pacing: settings.pacing || 'balanced',
                mood: settings.mood || 'neutral',
                showDontTell: settings.showDontTell || 'medium',
                dialogue: settings.dialogue || 'natural',
                density: settings.density || 'medium'
            });
        }

        // 显示人性化建议面板
        const panel = document.getElementById('suggest-humanize');
        if (panel) {
            panel.style.display = 'block';
            const reasonsList = panel.querySelector('.humanize-reasons');
            if (reasonsList) {
                reasonsList.innerHTML = '';
                Object.entries(reasons).forEach(([key, reason]) => {
                    if (!reason) return;
                    const li = document.createElement('li');
                    li.textContent = reason;
                    li.style.cssText = 'font-size:12px; color:#6d28d9; line-height:1.8;';
                    reasonsList.appendChild(li);
                });
            }
        }
    }

    // 在radio button旁添加推荐标记
    function markRadioRecommended(radioName, value, reason) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        radios.forEach(radio => {
            const label = radio.closest('label');
            if (!label) return;
            // 移除旧标记
            const oldBadge = label.querySelector('.ai-recommend-badge');
            if (oldBadge) oldBadge.remove();

            if (radio.value === value) {
                radio.checked = true;
                const badge = document.createElement('span');
                badge.className = 'ai-recommend-badge';
                badge.textContent = '🤖推荐';
                badge.title = reason || 'AI推荐此选项';
                label.appendChild(badge);
            }
        });
    }

    // 在select旁添加推荐标记
    function addRecommendBadge(selectEl, reason) {
        const parent = selectEl.parentElement;
        if (!parent) return;
        const oldBadge = parent.querySelector('.ai-recommend-badge');
        if (oldBadge) oldBadge.remove();

        if (reason) {
            const badge = document.createElement('span');
            badge.className = 'ai-recommend-badge';
            badge.textContent = '🤖推荐';
            badge.title = reason;
            badge.style.marginLeft = '8px';
            const label = parent.querySelector('.form-label');
            if (label) label.appendChild(badge);
        }
    }

    // 声音卡片建议
    function showVoiceCardSuggestion(voiceCards) {
        const panel = document.getElementById('suggest-voiceCards');
        if (!panel) return;
        panel.style.display = 'block';

        const btn = panel.querySelector('.btn-apply-voice-cards');
        if (btn) {
            btn.onclick = () => {
                const listEl = document.getElementById('character-voice-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                voiceCards.forEach(card => {
                    // 模拟点击"添加声音卡片"按钮并填充
                    const addBtn = document.getElementById('btn-add-voice-card');
                    if (addBtn) addBtn.click();

                    // 填充最后添加的卡片
                    const allCards = listEl.querySelectorAll(':scope > div');
                    const lastCard = allCards[allCards.length - 1];
                    if (lastCard) {
                        const nameInput = lastCard.querySelector('.voice-name');
                        const speechInput = lastCard.querySelector('.voice-speech');
                        const toneInput = lastCard.querySelector('.voice-tone');
                        const quirksInput = lastCard.querySelector('.voice-quirks');
                        if (nameInput) nameInput.value = card.name || '';
                        if (speechInput) speechInput.value = card.speech || '';
                        if (toneInput) toneInput.value = card.tone || '';
                        if (quirksInput) quirksInput.value = card.quirks || '';
                    }
                });

                // 自动保存声音卡片到文件
                const name = AppState.getNovel();
                if (name) suggestMgr.saveVoiceCards(name, voiceCards);

                btn.textContent = '✅ 已应用并保存';
                setTimeout(() => { btn.textContent = '🤖 使用AI建议的角色'; }, 2000);
            };
        }
    }

    // 隐藏所有建议面板
    function hideSuggestionPanels() {
        document.querySelectorAll('.ai-suggest-panel').forEach(p => p.style.display = 'none');
        const statusBar = document.getElementById('ai-suggestions-status');
        if (statusBar) statusBar.style.display = 'none';
        // 移除所有推荐标记
        document.querySelectorAll('.ai-recommend-badge').forEach(b => b.remove());
    }

    // 监听项目切换（多个select都要监听）
    const projectSelectors = [
        'prompt-novel-select', 'human-novel-select', 'arc-novel-select',
        'outline-novel-select', 'gen-novel-select', 'settings-novel-select'
    ];

    projectSelectors.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.addEventListener('change', () => {
                if (sel.value) checkAndLoadSuggestions(sel.value);
            });
        }
    });

    // 一键应用全部AI建议
    function applyAllSuggestions() {
        const name = AppState.getNovel();
        if (!name || !currentSuggestions) return;
        const sug = currentSuggestions;
        const configDir = path.join(projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

        let applied = [];

        // 1. 故事创意（取第一个）
        if (sug.storyIdeas && sug.storyIdeas.length > 0) {
            const idea = sug.storyIdeas[0].content;
            storyIdeaMgr.saveStoryIdea(name, idea);
            const el = document.getElementById('outline-story-idea');
            if (el) el.value = idea;
            applied.push('故事创意');
        }

        // 2. 作者角色 + 创作规则
        if (sug.writerRole || sug.writingRules) {
            const existing = promptMgr.loadPrompts(name) || { category: AppState.getCategory() };
            if (sug.writerRole) {
                existing.authorRole = sug.writerRole;
                const el = document.getElementById('prompt-writer-role');
                if (el) el.value = sug.writerRole;
            }
            if (sug.writingRules) {
                existing.creationRules = sug.writingRules;
                const el = document.getElementById('prompt-writing-rules');
                if (el) el.value = sug.writingRules;
            }
            promptMgr.savePrompts(name, existing);
            applied.push('提示词');
        }

        // 3. 人性化设置
        if (sug.humanizeSettings) {
            applyHumanizeRecommendations(sug.humanizeSettings);
            applied.push('人性化设置');
        }

        // 4. 声音卡片
        if (sug.voiceCards && sug.voiceCards.length > 0) {
            suggestMgr.saveVoiceCards(name, sug.voiceCards);
            const voiceBtn = document.querySelector('#suggest-voiceCards .btn-apply-voice-cards');
            if (voiceBtn) voiceBtn.click();
            applied.push('声音卡片');
        }

        // 5. 角色状态
        if (sug.characterState) {
            const json = JSON.stringify(sug.characterState, null, 2);
            fs.writeFileSync(path.join(configDir, 'character-state.json'), json, 'utf-8');
            const el = document.getElementById('settings-character');
            if (el) el.value = json;
            applied.push('角色状态');
        }

        // 6. 世界设定
        if (sug.worldBible) {
            const json = JSON.stringify(sug.worldBible, null, 2);
            fs.writeFileSync(path.join(configDir, 'world-bible.json'), json, 'utf-8');
            const el = document.getElementById('settings-world');
            if (el) el.value = json;
            applied.push('世界设定');
        }

        // 7. 故事弧线
        if (sug.storyArc) {
            const json = JSON.stringify(sug.storyArc, null, 2);
            fs.writeFileSync(path.join(configDir, 'story-arc.json'), json, 'utf-8');
            const el = document.getElementById('arc-editor');
            if (el) el.value = json;
            applied.push('故事弧线');
        }

        // 8. 场景节拍（取第一个模板）
        if (sug.sceneBeats && sug.sceneBeats.length > 0) {
            const beats = sug.sceneBeats[0].beats;
            const el = document.getElementById('beats-editor');
            if (el) el.value = beats.map((b, i) => `${i + 1}. ${b}`).join('\n');
            applied.push('场景节拍');
        }

        return applied;
    }

    // 暴露全局方法供其他组件调用
    window.AISuggestions = {
        reload: function(projectName) {
            checkAndLoadSuggestions(projectName);
        },
        getCurrent: function() {
            return currentSuggestions;
        },
        applyAll: function() {
            return applyAllSuggestions();
        }
    };

    // 初始加载
    const saved = AppState.getNovel();
    if (saved) {
        setTimeout(() => checkAndLoadSuggestions(saved), 500);
    }
})();
