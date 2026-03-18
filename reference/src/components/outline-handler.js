// outline-handler.js - 大纲生成页面交互
(function() {
    const OutlineGenerator = require('../utils/outline-generator');
    const NovelManager = require('../utils/novel-manager');
    const StoryIdeaManager = require('../utils/story-idea-manager');
    const AppState = require('../utils/app-state');

    const outlineGen = new OutlineGenerator();
    const novelManager = new NovelManager();
    const storyIdeaManager = new StoryIdeaManager();

    const novelSelect = document.getElementById('outline-novel-select');
    const storyIdeaTextarea = document.getElementById('outline-story-idea');
    const currentCountInput = document.getElementById('outline-current-count');
    const progressContainer = document.getElementById('outline-progress-container');
    const progressBar = document.getElementById('outline-progress-bar');
    const progressText = document.getElementById('outline-progress-text');

    // 加载项目列表
    function loadProjects() {
        const projects = novelManager.listProjects();
        novelSelect.innerHTML = '<option value="">选择小说...</option>';
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            novelSelect.appendChild(opt);
        });
        const saved = AppState.getNovel();
        if (saved && novelSelect.querySelector(`option[value="${saved}"]`)) {
            novelSelect.value = saved;
            loadProjectData(saved);
        }
    }

    function loadProjectData(name) {
        if (!name) return;
        currentCountInput.value = outlineGen.getOutlineCount(name);
        const idea = storyIdeaManager.loadStoryIdea(name);
        if (idea) storyIdeaTextarea.value = idea;
    }

    novelSelect.addEventListener('change', () => {
        loadProjectData(novelSelect.value);
    });

    // 生成大纲（支持批量）
    document.getElementById('btn-generate-outline').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择小说'); return; }

        // 保存故事创意
        const idea = storyIdeaTextarea.value.trim();
        if (idea) storyIdeaManager.saveStoryIdea(name, idea);

        const batchCount = parseInt(document.getElementById('outline-chapter-count').value) || 1;
        const btnGenerate = document.getElementById('btn-generate-outline');
        btnGenerate.disabled = true;

        progressContainer.style.display = 'block';

        try {
            for (let i = 0; i < batchCount; i++) {
                const currentChapter = outlineGen.getOutlineCount(name) + 1;
                progressBar.style.width = ((i / batchCount) * 100) + '%';
                progressText.textContent = `正在生成第${currentChapter}章大纲（${i + 1}/${batchCount}）...`;

                const result = await outlineGen.generateOutlines(name, { storyIdea: idea });
                currentCountInput.value = outlineGen.getOutlineCount(name);

                progressBar.style.width = (((i + 1) / batchCount) * 100) + '%';
            }
            progressText.textContent = batchCount > 1
                ? `✅ ${batchCount}章大纲全部生成完成！当前共${outlineGen.getOutlineCount(name)}章`
                : `✅ 第${outlineGen.getOutlineCount(name)}章大纲生成完成！`;
        } catch (e) {
            progressText.textContent = '生成失败: ' + e.message;
            progressText.style.color = '#e53e3e';
        }

        btnGenerate.disabled = false;
    });

    // 查看大纲列表
    document.getElementById('btn-refresh-outline-list').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择小说'); return; }

        const listContainer = document.getElementById('outline-list-container');
        const filesList = document.getElementById('outline-files-list');
        const contentDisplay = document.getElementById('outline-content-display');
        const contentTitle = document.getElementById('outline-content-title');
        const actions = document.getElementById('outline-actions');

        listContainer.style.display = 'block';
        const files = outlineGen.getOutlineFiles(name);
        filesList.innerHTML = '';

        files.forEach(f => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:6px;font-size:13px;margin-bottom:4px;transition:background 0.2s;';
            item.textContent = f.replace('.txt', '');
            item.addEventListener('mouseover', () => item.style.background = '#edf2f7');
            item.addEventListener('mouseout', () => item.style.background = '');
            item.addEventListener('click', () => {
                contentDisplay.value = outlineGen.readOutline(name, f);
                contentDisplay.readOnly = false;
                contentTitle.textContent = f.replace('.txt', '');
                actions.style.display = 'flex';
                contentDisplay.dataset.currentFile = f;
            });
            filesList.appendChild(item);
        });
    });

    // 保存大纲编辑
    document.getElementById('btn-save-outline-edit').addEventListener('click', () => {
        const name = novelSelect.value;
        const contentDisplay = document.getElementById('outline-content-display');
        const currentFile = contentDisplay.dataset.currentFile;
        if (!name || !currentFile) return;

        const match = currentFile.match(/第(\d+)章/);
        if (match) {
            outlineGen.saveOutline(name, parseInt(match[1]), contentDisplay.value);
            document.getElementById('outline-save-status').textContent = '✅ 已保存';
            setTimeout(() => document.getElementById('outline-save-status').textContent = '', 3000);
        }
    });

    // 删除大纲
    document.getElementById('btn-delete-outline').addEventListener('click', async () => {
        const name = novelSelect.value;
        const contentDisplay = document.getElementById('outline-content-display');
        const currentFile = contentDisplay.dataset.currentFile;
        if (!name || !currentFile) return;

        const confirmed = await showConfirm(`确定要删除 ${currentFile} 吗？`);
        if (confirmed) {
            outlineGen.deleteOutline(name, currentFile);
            contentDisplay.value = '';
            document.getElementById('outline-actions').style.display = 'none';
            document.getElementById('btn-refresh-outline-list').click();
            currentCountInput.value = outlineGen.getOutlineCount(name);
        }
    });

    loadProjects();
})();
