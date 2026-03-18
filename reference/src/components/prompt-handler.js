// prompt-handler.js - 提示词管理页面交互
(function() {
    const NovelManager = require('../utils/novel-manager');
    const PromptManager = require('../utils/prompt-manager');
    const TemplateLoader = require('../utils/template-loader');
    const AppState = require('../utils/app-state');

    const novelManager = new NovelManager();
    const promptManager = new PromptManager();

    const categorySelect = document.getElementById('prompt-category-select');
    const novelSelect = document.getElementById('prompt-novel-select');
    const writerRole = document.getElementById('prompt-writer-role');
    const writingRules = document.getElementById('prompt-writing-rules');

    // 填充分类选项
    function loadCategories() {
        const categories = TemplateLoader.getAllPromptCategories();
        categorySelect.innerHTML = '<option value="">选择分类...</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
    }

    // 填充项目列表
    function loadProjects() {
        const projects = novelManager.listProjects();
        novelSelect.innerHTML = '<option value="">默认提示词</option>';
        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            novelSelect.appendChild(opt);
        });

        // 恢复上次选择
        const saved = AppState.getNovel();
        if (saved && novelSelect.querySelector(`option[value="${saved}"]`)) {
            novelSelect.value = saved;
        }
    }

    // 分类变化时加载默认模板
    categorySelect.addEventListener('change', () => {
        const categoryId = categorySelect.value;
        if (!categoryId) return;
        AppState.setCategory(categoryId);

        const template = TemplateLoader.getPromptTemplate(categoryId);
        if (template) {
            writerRole.value = template.author_role || '';
            writingRules.value = template.creation_rules || '';
        }
    });

    // 项目切换
    novelSelect.addEventListener('change', () => {
        const name = novelSelect.value;
        if (name) {
            AppState.setNovel(name);
            updateDashboard(name);
        }
    });

    // 加载提示词
    document.getElementById('btn-load-prompts').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择项目'); return; }
        const prompts = promptManager.loadPrompts(name);
        if (prompts) {
            writerRole.value = prompts.authorRole || '';
            writingRules.value = prompts.creationRules || '';
            if (prompts.category) {
                categorySelect.value = prompts.category;
                AppState.setCategory(prompts.category);
            }
            alert('提示词已加载');
        } else {
            alert('该项目没有保存的提示词');
        }
    });

    // 保存提示词
    document.getElementById('btn-save-prompts').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) {
            // 检查是否需要新建项目
            const newName = prompt('请输入项目名称：');
            if (!newName) return;
            novelManager.createProject(newName);
            AppState.setNovel(newName);
            promptManager.savePrompts(newName, {
                category: categorySelect.value,
                authorRole: writerRole.value,
                creationRules: writingRules.value
            });
            loadProjects();
            novelSelect.value = newName;
            alert('项目创建成功，提示词已保存');
            return;
        }
        promptManager.savePrompts(name, {
            category: categorySelect.value,
            authorRole: writerRole.value,
            creationRules: writingRules.value
        });
        alert('提示词已保存');
    });

    // 项目总览仪表盘
    function updateDashboard(name) {
        const dashboard = document.getElementById('project-dashboard');
        if (!name) { dashboard.style.display = 'none'; return; }

        dashboard.style.display = 'block';
        const info = novelManager.getProjectInfo(name);

        document.getElementById('dash-chapters').textContent = info.chapterCount;
        document.getElementById('dash-words').textContent = info.totalWords.toLocaleString();
        
        // 大纲数
        const OutlineGenerator = require('../utils/outline-generator');
        const og = new OutlineGenerator();
        document.getElementById('dash-outlines').textContent = og.getOutlineCount(name);

        // 指纹状态
        const StyleManager = require('../utils/style-manager');
        const sm = new StyleManager();
        const fp = sm.loadFingerprint(name);
        document.getElementById('dash-fingerprint').textContent = fp ? '✅' : '❌';

        // 详情
        document.getElementById('dash-details').textContent = info.chapterCount > 0
            ? `平均每章 ${info.avgWords} 字`
            : '尚未生成章节';
    }

    // 初始化
    loadCategories();
    loadProjects();
    const currentNovel = AppState.getNovel();
    if (currentNovel) updateDashboard(currentNovel);

    // 删除项目
    document.getElementById('btn-delete-project').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择一个项目'); return; }
        const info = novelManager.getProjectInfo(name);
        const confirmed = await showConfirm(`确定要删除项目「${name}」吗？\n\n该项目包含 ${info.chapterCount} 个章节、${info.totalWords.toLocaleString()} 字。\n此操作不可撤销！`);
        if (!confirmed) return;
        const doubleConfirm = await showConfirm(`最后确认：真的要永久删除「${name}」及其所有数据吗？`);
        if (!doubleConfirm) return;
        novelManager.deleteProject(name);
        AppState.setNovel('');
        loadProjects();
        document.getElementById('project-dashboard').style.display = 'none';
        alert(`项目「${name}」已删除`);
    });
})();
