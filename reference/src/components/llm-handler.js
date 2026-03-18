// llm-handler.js - LLM配置页面交互
(function() {
    const fs = require('fs');
    const path = require('path');
    const { getInstance: getLLM } = require('../utils/llm-manager');
    const llm = getLLM();
    const configPath = path.join(__dirname, '../config/llm-config.json');

    // 初始化路由配置UI
    function initRoutingUI() {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const routing = config.taskRouting || {};

        const tasks = ['generation', 'expansion', 'rewrite', 'analysis'];
        tasks.forEach(task => {
            const route = routing[task] || {};
            const apiKeyInput = document.getElementById(`route-${task}-apikey`);
            const baseUrlInput = document.getElementById(`route-${task}-baseurl`);
            const modelInput = document.getElementById(`route-${task}-model`);

            if (apiKeyInput) apiKeyInput.value = route.apiKey || '';
            if (baseUrlInput) baseUrlInput.value = route.baseUrl || '';
            if (modelInput) modelInput.value = route.model || '';

            // 如果有自定义配置，展开面板
            if (route.apiKey || route.baseUrl || route.model) {
                const customDiv = document.getElementById(`route-${task}-custom`);
                if (customDiv) customDiv.style.display = 'block';
            }
        });
    }

    // 展开/折叠独立配置
    document.querySelectorAll('.btn-toggle-custom').forEach(btn => {
        btn.addEventListener('click', () => {
            const task = btn.getAttribute('data-task');
            const customDiv = document.getElementById(`route-${task}-custom`);
            if (customDiv) {
                const isHidden = customDiv.style.display === 'none';
                customDiv.style.display = isHidden ? 'block' : 'none';
                btn.textContent = isHidden ? '⚙️ 收起独立配置' : '⚙️ 展开独立配置';
            }
        });
    });

    // 保存路由配置
    document.getElementById('btn-save-routing').addEventListener('click', () => {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const tasks = ['generation', 'expansion', 'rewrite', 'analysis'];

        tasks.forEach(task => {
            const apiKey = document.getElementById(`route-${task}-apikey`).value.trim();
            const baseUrl = document.getElementById(`route-${task}-baseurl`).value.trim();
            const model = document.getElementById(`route-${task}-model`).value.trim();

            if (!config.taskRouting) config.taskRouting = {};
            config.taskRouting[task] = {
                provider: '',
                apiKey: apiKey,
                baseUrl: baseUrl,
                model: model
            };
        });

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        llm.reloadConfig();
        alert('路由配置已保存');
    });

    // 健康检查
    const healthCard = document.getElementById('llm-health-card');
    const healthResults = document.getElementById('llm-health-results');

    async function runHealthCheck() {
        healthCard.style.display = 'block';
        healthResults.innerHTML = '<div style="color:#667eea;">⏳ 正在检查连通性...</div>';

        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const tasks = ['generation', 'expansion', 'rewrite', 'analysis'];
        const taskNames = { generation: '日常创作', expansion: '扩写', rewrite: '润色改写', analysis: '风格分析' };

        let html = '';
        for (const task of tasks) {
            const provider = llm.getProviderForTask(task);
            if (!provider) {
                html += `<div style="padding:8px;margin:4px 0;background:#fed7d7;border-radius:6px;">❌ ${taskNames[task]}: 未配置</div>`;
                continue;
            }

            try {
                const result = await llm.healthCheck(provider);
                if (result.success) {
                    html += `<div style="padding:8px;margin:4px 0;background:#c6f6d5;border-radius:6px;">✅ ${taskNames[task]}: ${provider.model} - 连通正常</div>`;
                } else {
                    html += `<div style="padding:8px;margin:4px 0;background:#fed7d7;border-radius:6px;">❌ ${taskNames[task]}: ${result.error}</div>`;
                }
            } catch (e) {
                html += `<div style="padding:8px;margin:4px 0;background:#fed7d7;border-radius:6px;">❌ ${taskNames[task]}: ${e.message}</div>`;
            }
        }

        healthResults.innerHTML = html;
    }

    runHealthCheck();

    const recheckBtn = document.getElementById('btn-recheck-llm');
    if (recheckBtn) recheckBtn.addEventListener('click', runHealthCheck);

    initRoutingUI();
})();
