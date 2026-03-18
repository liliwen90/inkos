// tools-handler.js - 工具箱交互（改写工具、章节管理、导出）
(function() {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const RewriteTool = require('../utils/rewrite-tool');
    const NovelManager = require('../utils/novel-manager');
    const ExportManager = require('../utils/export-manager');

    const rewriteTool = new RewriteTool();
    const novelManager = new NovelManager();
    const exportManager = new ExportManager();

    // ========== 改写工具 ==========
    const toolNovelSelect = document.getElementById('tool-novel-select');
    let currentMode = 'polish';

    function loadToolProjects() {
        const projects = novelManager.listProjects();
        [toolNovelSelect, document.getElementById('chapter-mgr-novel-select'), document.getElementById('export-novel-select')].forEach(sel => {
            if (!sel) return;
            sel.innerHTML = '<option value="">选择项目...</option>';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p; opt.textContent = p;
                sel.appendChild(opt);
            });
        });
    }

    // 改写模式切换
    document.querySelectorAll('.tool-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.getAttribute('data-mode');

            const sensoryOpts = document.getElementById('sensory-options');
            sensoryOpts.style.display = currentMode === 'sensory' ? 'block' : 'none';
        });
    });

    // 执行改写
    document.getElementById('btn-run-rewrite').addEventListener('click', async () => {
        const inputText = document.getElementById('tool-input-text').value.trim();
        if (!inputText) { alert('请输入要改写的文字'); return; }

        const loadingDiv = document.getElementById('rewrite-loading');
        loadingDiv.style.display = 'block';
        document.getElementById('tool-output-text').value = '';

        try {
            let options = {};
            if (currentMode === 'sensory') {
                const checked = document.querySelectorAll('.sense-check:checked');
                options.senses = Array.from(checked).map(c => c.value);
            }

            const result = await rewriteTool.rewrite(inputText, currentMode, options);
            document.getElementById('tool-output-text').value = result;
        } catch (e) {
            alert('改写失败: ' + e.message);
        } finally {
            loadingDiv.style.display = 'none';
        }
    });

    // 复制结果
    document.getElementById('btn-copy-result').addEventListener('click', () => {
        const output = document.getElementById('tool-output-text');
        if (!output.value) return;
        navigator.clipboard.writeText(output.value);
        const btn = document.getElementById('btn-copy-result');
        btn.textContent = '✅ 已复制';
        setTimeout(() => { btn.textContent = '📋 复制结果'; }, 2000);
    });

    // ========== 章节管理器 ==========
    let currentChapterProject = '';
    let currentChapterFile = '';

    document.getElementById('btn-load-chapters').addEventListener('click', () => {
        const name = document.getElementById('chapter-mgr-novel-select').value;
        if (!name) { alert('请选择项目'); return; }
        currentChapterProject = name;
        loadChapterList(name);
    });

    function loadChapterList(name) {
        const files = novelManager.getChapterFiles(name);
        const listContainer = document.getElementById('chapter-list-container');
        const fileList = document.getElementById('chapter-file-list');
        const statsDiv = document.getElementById('chapter-stats');

        if (files.length === 0) {
            listContainer.style.display = 'none';
            statsDiv.style.display = 'none';
            alert('该项目还没有生成任何章节');
            return;
        }

        // 统计
        let totalWords = 0;
        files.forEach(f => {
            const content = novelManager.readChapter(name, f);
            totalWords += content.length;
        });

        document.getElementById('stat-total-chapters').textContent = files.length;
        document.getElementById('stat-total-words').textContent = totalWords.toLocaleString();
        document.getElementById('stat-avg-words').textContent = Math.round(totalWords / files.length).toLocaleString();
        statsDiv.style.display = 'block';

        // 章节列表
        fileList.innerHTML = '';
        files.forEach(f => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px; cursor:pointer; border-radius:4px; margin-bottom:4px; font-size:13px; transition:background 0.2s;';
            item.textContent = f.replace('.txt', '');
            item.addEventListener('mouseenter', () => { item.style.background = '#e2e8f0'; });
            item.addEventListener('mouseleave', () => { if (currentChapterFile !== f) item.style.background = ''; });
            item.addEventListener('click', () => {
                fileList.querySelectorAll('div').forEach(d => d.style.background = '');
                item.style.background = '#e2e8f0';
                loadChapter(name, f);
            });
            fileList.appendChild(item);
        });

        listContainer.style.display = 'block';
        // 重置编辑器
        document.getElementById('chapter-content-editor').value = '';
        document.getElementById('chapter-content-editor').readOnly = true;
        document.getElementById('chapter-content-title').textContent = '选择一个章节查看';
        document.getElementById('chapter-actions').style.display = 'none';
    }

    function loadChapter(name, file) {
        currentChapterFile = file;
        const content = novelManager.readChapter(name, file);
        const editor = document.getElementById('chapter-content-editor');
        editor.value = content;
        editor.readOnly = false;
        document.getElementById('chapter-content-title').textContent = file.replace('.txt', '');
        document.getElementById('chapter-actions').style.display = 'flex';
        document.getElementById('chapter-word-count').textContent = `字数: ${content.length.toLocaleString()}`;
        document.getElementById('chapter-save-status').textContent = '';
    }

    // 保存章节修改
    document.getElementById('btn-save-chapter-edit').addEventListener('click', () => {
        if (!currentChapterProject || !currentChapterFile) return;
        const content = document.getElementById('chapter-content-editor').value;
        // 从文件名提取章节索引
        const match = currentChapterFile.match(/第(\d+)章/);
        if (match) {
            novelManager.saveChapter(currentChapterProject, parseInt(match[1]), content);
        }
        document.getElementById('chapter-save-status').textContent = '✅ 已保存';
        document.getElementById('chapter-word-count').textContent = `字数: ${content.length.toLocaleString()}`;
    });

    // 删除章节
    document.getElementById('btn-delete-chapter').addEventListener('click', async () => {
        if (!currentChapterProject || !currentChapterFile) return;
        const confirmed = await showConfirm(`确定要删除「${currentChapterFile}」吗？此操作不可撤销。`);
        if (confirmed) {
            novelManager.deleteChapter(currentChapterProject, currentChapterFile);
            currentChapterFile = '';
            loadChapterList(currentChapterProject);
        }
    });

    // ========== 导出功能 ==========
    document.getElementById('btn-export-txt').addEventListener('click', async () => {
        const name = document.getElementById('export-novel-select').value;
        if (!name) { alert('请选择项目'); return; }

        const content = exportManager.exportTxt(name);
        if (!content) { alert('该项目还没有章节可导出'); return; }

        const result = await ipcRenderer.invoke('dialog-save', {
            defaultPath: `${name}.txt`,
            filters: [{ name: 'TXT文件', extensions: ['txt'] }]
        });

        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, content, 'utf-8');
            document.getElementById('export-result').textContent = `✅ 已导出至: ${result.filePath}`;
        }
    });

    document.getElementById('btn-export-html').addEventListener('click', async () => {
        const name = document.getElementById('export-novel-select').value;
        if (!name) { alert('请选择项目'); return; }

        const content = exportManager.exportHtml(name);
        if (!content) { alert('该项目还没有章节可导出'); return; }

        const result = await ipcRenderer.invoke('dialog-save', {
            defaultPath: `${name}.html`,
            filters: [{ name: 'HTML文件', extensions: ['html'] }]
        });

        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, content, 'utf-8');
            document.getElementById('export-result').textContent = `✅ 已导出至: ${result.filePath}`;
        }
    });

    loadToolProjects();
})();
