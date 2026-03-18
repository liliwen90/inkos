// generate-handler.js - 小说生成页面交互
(function() {
    const fs = require('fs');
    const path = require('path');
    const NovelGenerator = require('../utils/novel-generator');
    const NovelManager = require('../utils/novel-manager');
    const OutlineGenerator = require('../utils/outline-generator');
    const StoryIdeaManager = require('../utils/story-idea-manager');
    const AppState = require('../utils/app-state');
    const AppSettings = require('../utils/app-settings');

    const generator = new NovelGenerator();
    const novelManager = new NovelManager();
    const outlineGen = new OutlineGenerator();
    const storyIdeaMgr = new StoryIdeaManager();

    const novelSelect = document.getElementById('gen-novel-select');
    const chapterCountInput = document.getElementById('gen-chapter-count');
    const progressContainer = document.getElementById('gen-progress-container');
    const progressBar = document.getElementById('gen-progress-bar');
    const progressText = document.getElementById('gen-progress-text');
    const logContainer = document.getElementById('gen-log');
    const summaryDiv = document.getElementById('gen-summary');

    let isGenerating = false;
    let shouldStop = false;
    let abortController = null;

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
        }
    }

    // 恢复状态更新模式
    const savedMode = AppSettings.get('stateUpdateMode', 'semi-auto');
    const modeRadios = document.querySelectorAll('input[name="state-update-mode"]');
    modeRadios.forEach(r => {
        if (r.value === savedMode) r.checked = true;
        r.addEventListener('change', () => {
            AppSettings.set('stateUpdateMode', r.value);
        });
    });

    function getStateUpdateMode() {
        const checked = document.querySelector('input[name="state-update-mode"]:checked');
        return checked ? checked.value : 'semi-auto';
    }

    function addLog(text, type) {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px 12px;margin-bottom:4px;border-radius:6px;font-size:13px;line-height:1.6;';
        if (type === 'error') div.style.background = '#fed7d7';
        else if (type === 'success') div.style.background = '#c6f6d5';
        else div.style.background = '#e2e8f0';
        div.textContent = text;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // 检测进度
    document.getElementById('btn-detect-progress').addEventListener('click', () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择小说'); return; }
        const count = novelManager.getChapterCount(name);
        document.getElementById('progress-info').textContent = `已生成 ${count} 章，下一章将是第 ${count + 1} 章`;
    });

    // 开始生成（支持连续多章）
    document.getElementById('btn-start-generate').addEventListener('click', async () => {
        const name = novelSelect.value;
        if (!name) { alert('请先选择小说'); return; }
        if (isGenerating) return;

        isGenerating = true;
        shouldStop = false;
        abortController = new AbortController();
        document.getElementById('btn-start-generate').disabled = true;
        document.getElementById('btn-stop-generate').disabled = false;
        logContainer.innerHTML = '';
        summaryDiv.style.display = 'none';

        const useState = document.getElementById('gen-use-state').checked;
        const useWorld = document.getElementById('gen-use-world').checked;
        const usePrevious = document.getElementById('gen-use-previous').checked;
        const previousCount = parseInt(document.getElementById('gen-previous-count').value) || 1;
        const totalChapters = parseInt(document.getElementById('gen-chapter-count').value) || 1;

        const startTime = Date.now();
        let totalWords = 0;
        let chaptersGenerated = 0;

        progressContainer.style.display = 'block';

        try {
            for (let ch = 0; ch < totalChapters; ch++) {
                if (shouldStop) break;

                const chapterIndex = novelManager.getChapterCount(name) + 1;
                const overallPct = (ch / totalChapters) * 100;

                // === 阶段1：检查/自动生成大纲 ===
                const outlineFile = path.join(__dirname, '../../userdata/projects', name, 'storylines', `第${chapterIndex}章大纲.txt`);
                if (!fs.existsSync(outlineFile)) {
                    progressBar.style.width = (overallPct + 5) + '%';
                    progressText.textContent = `[${ch + 1}/${totalChapters}] 🗂️ 自动生成第${chapterIndex}章大纲...`;
                    addLog(`🗂️ 第${chapterIndex}章无大纲，自动生成中...`);

                    const idea = storyIdeaMgr.loadStoryIdea(name) || '';
                    await outlineGen.generateOutlines(name, { storyIdea: idea });
                    addLog(`✅ 第${chapterIndex}章大纲已自动生成`, 'success');
                }

                // === 阶段2：生成章节 ===
                progressBar.style.width = (overallPct + 15) + '%';
                progressText.textContent = `[${ch + 1}/${totalChapters}] ⏳ 正在生成第${chapterIndex}章...`;
                addLog(`⏳ 开始生成第${chapterIndex}章...`);

                const result = await generator.generateChapter(name, {
                    chapterIndex: chapterIndex,
                    useState: useState,
                    useWorld: useWorld,
                    usePrevious: usePrevious,
                    previousCount: previousCount,
                    signal: abortController.signal
                });

                chaptersGenerated++;
                totalWords += result.wordCount;
                addLog(`✅ 第${result.chapterIndex}章生成完成，${result.wordCount}字`, 'success');

                // 质量检查 + 自动去AI味
                const quality = generator.checkContentQuality(result.content);
                if (quality.aiWordCount > 5 || quality.aiOpening || quality.rhythmIssue) {
                    const issues = [];
                    if (quality.aiOpening) issues.push('AI式开头');
                    if (quality.aiWordCount > 5) issues.push(`${quality.aiWordCount}处AI典型表达`);
                    if (quality.rhythmIssue) issues.push('段落节奏单一');
                    addLog(`⚠️ 检测到AI痕迹: ${issues.join('、')}，自动去味中...`);

                    try {
                        const rewritten = await generator.deAiRewrite(result.content, name);
                        const newWordCount = rewritten ? generator.countWords(rewritten) : 0;
                        if (rewritten && newWordCount > result.wordCount * 0.7) {
                            // 重写后内容有效（字数不低于原文70%），替换保存
                            novelManager.saveChapter(name, result.chapterIndex, rewritten);
                            totalWords = totalWords - result.wordCount + newWordCount;
                            result.content = rewritten;
                            result.wordCount = newWordCount;
                            addLog(`✅ 去AI味完成，最终${result.wordCount}字`, 'success');
                        } else {
                            addLog(`⚠️ 去味结果异常，保留原文`, 'error');
                        }
                    } catch (e) {
                        addLog(`⚠️ 去味失败: ${e.message}，保留原文`, 'error');
                    }
                } else if (quality.aiWordCount > 0) {
                    addLog(`ℹ️ 检测到${quality.aiWordCount}处AI表达（可接受范围）`);
                } else {
                    addLog(`✨ AI味检测通过`, 'success');
                }

                // === 阶段3：一致性校验 ===
                if (chapterIndex > 1) {
                    progressText.textContent = `[${ch + 1}/${totalChapters}] 🔍 一致性校验...`;
                    addLog('🔍 正在检查与前文的一致性...');
                    try {
                        const consistency = await generator.checkConsistency(name, result.chapterIndex, result.content);
                        if (consistency && !consistency.consistent && consistency.issues && consistency.issues.length > 0) {
                            addLog(`⚠️ 发现${consistency.issues.length}个一致性问题:`, 'error');
                            consistency.issues.forEach(issue => addLog(`  • ${issue}`, 'error'));
                        } else {
                            addLog('✅ 一致性校验通过', 'success');
                        }
                    } catch (e) {
                        addLog('ℹ️ 一致性校验跳过: ' + e.message);
                    }
                }

                // === 阶段4：自动生成摘要 ===
                progressBar.style.width = (overallPct + 60 / totalChapters) + '%';
                progressText.textContent = `[${ch + 1}/${totalChapters}] 📝 生成第${chapterIndex}章摘要...`;
                addLog('📝 正在生成章节摘要...');
                await generator.generateAndSaveSummary(name, result.chapterIndex, result.content);
                addLog('✅ 章节摘要已生成', 'success');

                // === 阶段5：自动状态更新 ===
                const mode = getStateUpdateMode();
                if (mode !== 'manual') {
                    progressBar.style.width = (overallPct + 80 / totalChapters) + '%';
                    progressText.textContent = `[${ch + 1}/${totalChapters}] 🔄 更新角色状态...`;
                    addLog('🔄 正在更新角色状态和世界设定...');

                    try {
                        const stateResult = await generator.generateStateUpdate(name, result.chapterIndex, result.content);
                        const worldResult = await generator.generateWorldUpdate(name, result.content);

                        if (mode === 'auto' || totalChapters > 1) {
                            // 连续生成时强制自动模式（不弹窗打断）
                            const configDir = path.join(__dirname, '../../userdata/projects', name, 'configs');
                            fs.writeFileSync(path.join(configDir, 'character-state.json'), stateResult, 'utf-8');
                            fs.writeFileSync(path.join(configDir, 'world-bible.json'), worldResult, 'utf-8');
                            addLog('✅ 状态已自动更新', 'success');
                        } else {
                            // 单章半自动模式
                            showEditModal('📝 角色状态更新（确认后保存）', stateResult, (edited) => {
                                const configDir = path.join(__dirname, '../../userdata/projects', name, 'configs');
                                fs.writeFileSync(path.join(configDir, 'character-state.json'), edited, 'utf-8');
                            });
                            setTimeout(() => {
                                showEditModal('🌍 世界设定更新（确认后保存）', worldResult, (edited) => {
                                    const configDir = path.join(__dirname, '../../userdata/projects', name, 'configs');
                                    fs.writeFileSync(path.join(configDir, 'world-bible.json'), edited, 'utf-8');
                                });
                            }, 500);
                        }
                    } catch (e) {
                        addLog('⚠️ 状态更新失败: ' + e.message, 'error');
                    }
                }

                addLog(`────── 第${chapterIndex}章完成 ──────`);
            }

            progressBar.style.width = '100%';
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const elapsedMin = Math.floor(elapsed / 60);
            const elapsedSec = elapsed % 60;
            const timeStr = elapsedMin > 0 ? `${elapsedMin}分${elapsedSec}秒` : `${elapsed}秒`;
            progressText.textContent = shouldStop
                ? `已停止，共生成${chaptersGenerated}章`
                : `🎉 全部完成！共生成${chaptersGenerated}章`;

            summaryDiv.style.display = 'block';
            document.getElementById('gen-time').textContent = timeStr;
            document.getElementById('gen-words').textContent = totalWords.toLocaleString();
            document.getElementById('gen-chapters-done').textContent = chaptersGenerated;

        } catch (e) {
            if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || shouldStop) {
                addLog(`⏹️ 生成已停止，共完成${chaptersGenerated}章`, 'error');
                progressText.textContent = `已停止（完成${chaptersGenerated}章）`;
            } else {
                addLog('❌ 生成失败: ' + e.message, 'error');
                progressText.textContent = '生成失败';
            }

            if (chaptersGenerated > 0) {
                summaryDiv.style.display = 'block';
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                document.getElementById('gen-time').textContent = elapsed + '秒';
                document.getElementById('gen-words').textContent = totalWords.toLocaleString();
                document.getElementById('gen-chapters-done').textContent = chaptersGenerated;
            }
        }

        isGenerating = false;
        abortController = null;
        document.getElementById('btn-start-generate').disabled = false;
        document.getElementById('btn-stop-generate').disabled = true;
    });

    // 停止生成
    document.getElementById('btn-stop-generate').addEventListener('click', () => {
        shouldStop = true;
        if (abortController) abortController.abort();
        addLog('⏹️ 正在停止生成...');
    });

    loadProjects();
})();
