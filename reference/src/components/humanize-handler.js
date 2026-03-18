// humanize-handler.js - 人性化设置交互
(function() {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const StyleManager = require('../utils/style-manager');
    const NovelManager = require('../utils/novel-manager');
    const AppState = require('../utils/app-state');

    const styleMgr = new StyleManager();
    const novelManager = new NovelManager();

    const novelSelect = document.getElementById('human-novel-select');
    const creativitySlider = document.getElementById('human-creativity');
    const creativityValue = document.getElementById('human-creativity-value');

    // 加载项目列表
    function loadProjects() {
        const projects = novelManager.listProjects();
        novelSelect.innerHTML = '<option value="">选择项目...</option>';
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
        const settings = styleMgr.loadHumanizationSettings(name);

        // POV
        const povRadios = document.querySelectorAll('input[name="human-pov"]');
        povRadios.forEach(r => { r.checked = r.value === settings.pov; });

        // Tense
        const tenseRadios = document.querySelectorAll('input[name="human-tense"]');
        tenseRadios.forEach(r => { r.checked = r.value === settings.tense; });

        // 滑块
        creativitySlider.value = settings.creativity || 5;
        creativityValue.textContent = settings.creativity || 5;

        // 下拉
        document.getElementById('human-pacing').value = settings.pacing || 'balanced';
        document.getElementById('human-mood').value = settings.mood || 'neutral';
        document.getElementById('human-show').value = settings.showDontTell || 'medium';
        document.getElementById('human-dialogue').value = settings.dialogue || 'natural';
        document.getElementById('human-density').value = settings.density || 'medium';

        // 加载风格书列表
        loadStyleBooks(name);

        // 加载指纹状态
        loadFingerprintStatus(name);

        // 加载声音卡片
        loadVoiceCards(name);

        // 加载风格样本
        const samples = styleMgr.loadStyleSamples(name);
        document.getElementById('human-style-samples').value = samples || '';
    }

    novelSelect.addEventListener('change', () => {
        loadSettings(novelSelect.value);
    });

    // 创意度滑块
    creativitySlider.addEventListener('input', () => {
        creativityValue.textContent = creativitySlider.value;
    });

    // 保存人性化设置
    document.getElementById('btn-save-humanize').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }

        const pov = document.querySelector('input[name="human-pov"]:checked').value;
        const tense = document.querySelector('input[name="human-tense"]:checked').value;

        const settings = {
            pov: pov,
            tense: tense,
            creativity: parseInt(creativitySlider.value),
            pacing: document.getElementById('human-pacing').value,
            mood: document.getElementById('human-mood').value,
            showDontTell: document.getElementById('human-show').value,
            dialogue: document.getElementById('human-dialogue').value,
            density: document.getElementById('human-density').value
        };

        styleMgr.saveHumanizationSettings(name, settings);
        alert('人性化设置已保存！');
    });

    // ========== 风格书管理 ==========
    function loadStyleBooks(name) {
        const list = document.getElementById('style-books-list');
        list.innerHTML = '';
        const books = styleMgr.getStyleBooks(name);

        if (books.length === 0) {
            list.innerHTML = '<p style="color:#999;font-size:13px;">尚未导入任何小说文件</p>';
            document.getElementById('btn-analyze-fingerprint').disabled = true;
            return;
        }

        document.getElementById('btn-analyze-fingerprint').disabled = false;

        books.forEach(book => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(255,255,255,0.6);border-radius:4px;margin-bottom:4px;';
            item.innerHTML = `<span style="font-size:13px;">📄 ${book}</span>`;
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;';
            delBtn.addEventListener('click', () => {
                styleMgr.removeStyleBook(name, book);
                loadStyleBooks(name);
            });
            item.appendChild(delBtn);
            list.appendChild(item);
        });
    }

    // 导入风格书（通过IPC对话框）
    document.getElementById('btn-import-style-books').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }

        const result = await ipcRenderer.invoke('dialog-open', {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'TXT文件', extensions: ['txt'] }]
        });

        if (!result.canceled && result.filePaths) {
            result.filePaths.forEach(fp => {
                styleMgr.addStyleBook(name, fp);
            });
            loadStyleBooks(name);
        }
    });

    // 开始分析指纹
    document.getElementById('btn-analyze-fingerprint').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) return;

        const progressDiv = document.getElementById('fingerprint-progress');
        const progressText = document.getElementById('fingerprint-progress-text');
        const progressBarEl = document.getElementById('fingerprint-progress-bar');
        progressDiv.style.display = 'block';
        progressBarEl.style.background = '#f59e0b';

        try {
            // 第一步：风格指纹分析
            await styleMgr.analyzeMultiBookStyle(name, (text, pct) => {
                progressText.textContent = text;
                progressBarEl.style.width = (pct * 0.5) + '%'; // 前50%给指纹
            });
            loadFingerprintStatus(name);

            // 第二步：自动生成内容建议
            progressText.textContent = '🧠 正在生成全方位创作建议...';
            progressBarEl.style.width = '55%';
            progressBarEl.style.background = '#8b5cf6';

            await styleMgr.generateContentSuggestions(name, (text, pct) => {
                progressText.textContent = text;
                progressBarEl.style.width = (50 + pct * 0.5) + '%'; // 后50%给建议
            });

            progressText.textContent = '✅ 风格学习 + 内容建议全部完成！';
            progressBarEl.style.width = '100%';
            progressBarEl.style.background = '#22c55e';

            // 通知建议系统刷新
            if (window.AISuggestions) {
                window.AISuggestions.reload(name);
            }

            setTimeout(() => { progressDiv.style.display = 'none'; }, 2000);
        } catch (e) {
            progressText.textContent = '分析失败: ' + e.message;
            progressBarEl.style.background = '#ef4444';
        }
    });

    // 指纹状态
    function loadFingerprintStatus(name) {
        const resultDiv = document.getElementById('fingerprint-result');
        const fp = styleMgr.loadFingerprint(name);
        if (!fp) { resultDiv.style.display = 'none'; return; }

        resultDiv.style.display = 'block';
        document.getElementById('fingerprint-enabled').checked = fp.enabled !== false;
        document.getElementById('fingerprint-strength').value = fp.strength || 7;
        document.getElementById('fingerprint-strength-value').textContent = fp.strength || 7;

        const meta = document.getElementById('fingerprint-meta');
        meta.textContent = `分析书目：${(fp.analyzedBooks || []).join('、')} | 分析时间：${fp.analyzedAt || '未知'}`;

        const preview = document.getElementById('fingerprint-preview');
        preview.textContent = (fp.fingerprint || '').substring(0, 800) + (fp.fingerprint && fp.fingerprint.length > 800 ? '...' : '');
    }

    // 指纹启用/禁用
    document.getElementById('fingerprint-enabled').addEventListener('change', (e) => {
        const name = novelSelect.value;
        if (!name) return;
        const fp = styleMgr.loadFingerprint(name);
        if (fp) { fp.enabled = e.target.checked; styleMgr.saveFingerprint(name, fp); }
    });

    // 指纹强度
    document.getElementById('fingerprint-strength').addEventListener('input', (e) => {
        document.getElementById('fingerprint-strength-value').textContent = e.target.value;
        const name = novelSelect.value;
        if (!name) return;
        const fp = styleMgr.loadFingerprint(name);
        if (fp) { fp.strength = parseInt(e.target.value); styleMgr.saveFingerprint(name, fp); }
    });

    // 重新分析
    document.getElementById('btn-reanalyze-fingerprint').addEventListener('click', () => {
        document.getElementById('btn-analyze-fingerprint').click();
    });

    // 删除指纹
    document.getElementById('btn-delete-fingerprint').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) return;
        const confirmed = await showConfirm('确定要删除风格指纹吗？');
        if (confirmed) {
            styleMgr.deleteFingerprint(name);
            loadFingerprintStatus(name);
        }
    });

    // 保存风格样本
    document.getElementById('btn-save-style-samples').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        styleMgr.saveStyleSamples(name, document.getElementById('human-style-samples').value);
        alert('风格样本已保存');
    });

    // ========== 声音卡片 ==========
    function loadVoiceCards(name) {
        const list = document.getElementById('character-voice-list');
        list.innerHTML = '';
        const cards = styleMgr.loadVoiceCards(name);

        cards.forEach((card, index) => {
            const cardDiv = document.createElement('div');
            cardDiv.style.cssText = 'padding:12px;background:#f7fafc;border-radius:8px;margin-bottom:10px;border:1px solid #e2e8f0;';
            cardDiv.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <input type="text" class="form-input voice-name" value="${card.name || ''}" placeholder="角色名称" style="max-width:200px;">
                    <button class="btn btn-danger voice-delete" style="padding:4px 10px;font-size:12px;">🗑️</button>
                </div>
                <input type="text" class="form-input voice-speech" value="${card.speech || ''}" placeholder="说话风格（如：简短有力、爱用古语）" style="margin-bottom:6px;">
                <input type="text" class="form-input voice-tone" value="${card.tone || ''}" placeholder="语调特征（如：冷淡、热情、嘲讽）" style="margin-bottom:6px;">
                <input type="text" class="form-input voice-quirks" value="${card.quirks || ''}" placeholder="口癖/习惯（如：经常说'有意思'）">
            `;
            cardDiv.querySelector('.voice-delete').addEventListener('click', () => {
                cardDiv.remove();
            });
            list.appendChild(cardDiv);
        });
    }

    document.getElementById('btn-add-voice-card').addEventListener('click', () => {
        const list = document.getElementById('character-voice-list');
        const cardDiv = document.createElement('div');
        cardDiv.style.cssText = 'padding:12px;background:#f7fafc;border-radius:8px;margin-bottom:10px;border:1px solid #e2e8f0;';
        cardDiv.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <input type="text" class="form-input voice-name" placeholder="角色名称" style="max-width:200px;">
                <button class="btn btn-danger voice-delete" style="padding:4px 10px;font-size:12px;">🗑️</button>
            </div>
            <input type="text" class="form-input voice-speech" placeholder="说话风格" style="margin-bottom:6px;">
            <input type="text" class="form-input voice-tone" placeholder="语调特征" style="margin-bottom:6px;">
            <input type="text" class="form-input voice-quirks" placeholder="口癖/习惯">
        `;
        cardDiv.querySelector('.voice-delete').addEventListener('click', () => cardDiv.remove());
        list.appendChild(cardDiv);
    });

    document.getElementById('btn-save-voice-cards').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }

        const cardDivs = document.querySelectorAll('#character-voice-list > div');
        const cards = [];
        cardDivs.forEach(div => {
            const nameInput = div.querySelector('.voice-name');
            const n = nameInput ? nameInput.value.trim() : '';
            if (!n) return;
            cards.push({
                name: n,
                speech: (div.querySelector('.voice-speech') || {}).value || '',
                tone: (div.querySelector('.voice-tone') || {}).value || '',
                quirks: (div.querySelector('.voice-quirks') || {}).value || ''
            });
        });

        styleMgr.saveVoiceCards(name, cards);
        alert('声音卡片已保存');
    });

    loadProjects();
})();
