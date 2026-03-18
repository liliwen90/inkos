// novel-generator.js - 核心小说生成引擎
const fs = require('fs');
const path = require('path');
const { getInstance: getLLM } = require('./llm-manager');
const NovelManager = require('./novel-manager');
const PromptManager = require('./prompt-manager');
const PromptTemplateLoader = require('./prompt-template-loader');
const TemplateLoader = require('./template-loader');
const StyleManager = require('./style-manager');
const StoryIdeaManager = require('./story-idea-manager');

class NovelGenerator {
    constructor() {
        this.llm = getLLM();
        this.novelManager = new NovelManager();
        this.promptManager = new PromptManager();
        this.styleManager = new StyleManager();
        this.storyIdeaManager = new StoryIdeaManager();
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
    }

    countWords(text) {
        if (!text) return 0;
        const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const english = (text.match(/[a-zA-Z]+/g) || []).length;
        return chinese + english;
    }

    loadPreviousChapters(name, currentIndex, count) {
        const cap = 12000;
        let result = '';
        const startIndex = Math.max(1, currentIndex - count);
        for (let i = startIndex; i < currentIndex; i++) {
            const fileName = `第${i}章.txt`;
            const content = this.novelManager.readChapter(name, fileName);
            if (content) {
                const truncated = content.length > cap / count ? content.substring(content.length - Math.floor(cap / count)) : content;
                result += `\n--- 第${i}章 ---\n${truncated}\n`;
            }
        }
        if (result.length > cap) {
            result = result.substring(result.length - cap);
        }
        return result;
    }

    loadChapterSummaries(name, maxCount) {
        const summariesDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(summariesDir)) return '';

        let summaries = '';
        const max = maxCount || 10;

        // 动态扫描摘要文件
        const files = fs.readdirSync(summariesDir)
            .filter(f => /^summary-ch(\d+)\.txt$/.test(f))
            .sort((a, b) => {
                const numA = parseInt(a.match(/(\d+)/)[1]);
                const numB = parseInt(b.match(/(\d+)/)[1]);
                return numA - numB;
            });

        for (const file of files) {
            const content = fs.readFileSync(path.join(summariesDir, file), 'utf-8');
            const chNum = file.match(/(\d+)/)[1];
            summaries += `\n第${chNum}章摘要：${content}\n`;
        }

        const lines = summaries.split('\n').filter(l => l.trim());
        if (lines.length > max * 3) {
            return lines.slice(-max * 3).join('\n');
        }
        return summaries;
    }

    async generateChapter(name, options = {}) {
        const prompts = this.promptManager.loadPrompts(name);
        if (!prompts) throw new Error('未找到提示词配置');

        const chapterIndex = options.chapterIndex || (this.novelManager.getChapterCount(name) + 1);
        const signal = options.signal;

        // 加载大纲
        const outlinesDir = path.join(this.projectsDir, name, 'storylines');
        const outlineFile = path.join(outlinesDir, `第${chapterIndex}章大纲.txt`);
        let outline = '';
        if (fs.existsSync(outlineFile)) {
            outline = fs.readFileSync(outlineFile, 'utf-8');
        }

        // 加载设定
        let characterState = '';
        let worldBible = '';
        if (options.useState !== false) {
            const stateFile = path.join(this.projectsDir, name, 'configs', 'character-state.json');
            if (fs.existsSync(stateFile)) characterState = fs.readFileSync(stateFile, 'utf-8');
        }
        if (options.useWorld !== false) {
            const worldFile = path.join(this.projectsDir, name, 'configs', 'world-bible.json');
            if (fs.existsSync(worldFile)) worldBible = fs.readFileSync(worldFile, 'utf-8');
        }

        // 前面章节
        let previousChapters = '';
        if (options.usePrevious !== false && chapterIndex > 1) {
            const count = options.previousCount || 1;
            previousChapters = this.loadPreviousChapters(name, chapterIndex, count);
        }

        // 构建用户消息
        let userContent = PromptTemplateLoader.buildGenerationMessages({
            outline: outline,
            chapterIndex: chapterIndex,
            useState: options.useState !== false,
            characterState: characterState,
            useWorld: options.useWorld !== false,
            worldBible: worldBible,
            previousChapters: previousChapters
        });

        // 故事创意
        const storyIdea = this.storyIdeaManager.loadStoryIdea(name);
        if (storyIdea) {
            userContent += `\n\n【故事核心创意】\n${storyIdea}`;
        }

        // 故事弧线
        const arc = this.loadStoryArc(name);
        if (arc && arc.phases) {
            let arcContext = '\n\n【故事弧线位置】\n';
            arc.phases.forEach(phase => {
                const range = phase.chapters || '';
                arcContext += `${phase.name} (${range}): ${phase.goal}\n`;
            });
            arcContext += `\n当前是第${chapterIndex}章，请据此安排情节节奏。`;
            userContent += arcContext;
        }

        // 章节摘要
        const summaries = this.loadChapterSummaries(name);
        if (summaries) {
            userContent += `\n\n【前文摘要】\n${summaries}`;
        }

        // 人性化风格指导
        const styleGuidance = this.styleManager.buildAllStyleGuidance(name, chapterIndex);
        if (styleGuidance) {
            userContent += styleGuidance;
        }

        // 温度
        const settings = this.styleManager.loadHumanizationSettings(name);
        const temperature = this.styleManager.creativityToTemperature(settings.creativity);

        // 反AI核心规则（从模板库加载）
        const antiAiRules = TemplateLoader.getAntiAiRules();

        const systemPrompt = `${prompts.authorRole || ''}\n\n${prompts.creationRules || ''}${antiAiRules}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];

        let content = await this.llm.callLLM(messages, 'generation', { temperature, signal });

        // 检查字数，不足则扩写
        const wordCount = this.countWords(content);
        if (wordCount < 2500) {
            content = await this.expandChapter(content, name, prompts);
        }

        // 保存章节
        this.novelManager.saveChapter(name, chapterIndex, content);

        return { content, chapterIndex, wordCount: this.countWords(content) };
    }

    async expandChapter(content, name, prompts) {
        const currentWords = this.countWords(content);
        const targetWords = Math.max(500, 3000 - currentWords);

        const userContent = PromptTemplateLoader.buildExpansionMessages(content, targetWords);

        const systemPrompt = `${prompts.authorRole || ''}\n\n${prompts.creationRules || ''}`;

        const messages = [
            { role: 'system', content: systemPrompt + '\n\n【重要】当前章节字数不足，需要你仔细扩写本章节的细节内容！' },
            { role: 'user', content: userContent }
        ];

        const expanded = await this.llm.callLLM(messages, 'expansion');
        return expanded || content;
    }

    checkContentQuality(content) {
        const result = { aiOpening: false, aiWordCount: 0, rhythmIssue: false, details: [] };
        if (!content) return result;

        // 检测AI开头模式
        const aiOpenings = ['在那个', '随着', '不知不觉', '就在这时', '阳光洒在', '夜幕降临', '清晨的', '时间飞逝'];
        aiOpenings.forEach(o => {
            if (content.trim().startsWith(o)) {
                result.aiOpening = true;
                result.details.push(`AI式开头：${o}`);
            }
        });

        // AI典型词汇计数（扩展到30+）
        const aiWords = [
            '不禁', '目光中闪过', '嘴角微微上扬', '一股莫名的', '心中暗想', '不由自主', '缓缓说道', '淡淡地说',
            '心中暗道', '仿佛一般', '宛如般', '如同潮水般', '像万花筒般', '一颗石子投入平静的湖面',
            '就这样', '总之', '不知不觉间', '时光荏苒',
            '眼中闪过一丝', '眉头微皱', '嘴角勾起一抹', '目光如炬', '眼神中带着',
            '深吸一口气', '攥紧了拳头', '浑身一震', '倒吸一口冷气',
            '他感到', '她感到', '心中涌起', '一阵暖流',
            '他非常', '她非常', '极其', '无比',
            '不得不承认', '毫无疑问', '事实上', '众所周知'
        ];
        aiWords.forEach(w => {
            const regex = new RegExp(w, 'g');
            const matches = content.match(regex);
            if (matches) {
                result.aiWordCount += matches.length;
                if (matches.length >= 2) {
                    result.details.push(`"${w}" 出现${matches.length}次`);
                }
            }
        });

        // 段落节奏分析
        const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
        if (paragraphs.length > 5) {
            const lengths = paragraphs.map(p => p.length);
            const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            const variation = lengths.map(l => Math.abs(l - avg)).reduce((a, b) => a + b, 0) / lengths.length;
            if (variation < avg * 0.15) {
                result.rhythmIssue = true;
                result.details.push('段落长度过于均匀（AI特征）');
            }
        }

        // 连续相似句式检测（连续3+句以相同字数开头）
        const sentences = content.replace(/\n/g, '').split(/[。！？]/).filter(s => s.trim().length > 5);
        let samePatternCount = 0;
        for (let i = 1; i < sentences.length; i++) {
            const prevLen = sentences[i - 1].trim().length;
            const currLen = sentences[i].trim().length;
            if (Math.abs(prevLen - currLen) < 5) {
                samePatternCount++;
            } else {
                samePatternCount = 0;
            }
            if (samePatternCount >= 3) {
                result.rhythmIssue = true;
                break;
            }
        }

        return result;
    }

    // 自动去AI味重写
    async deAiRewrite(content, name) {
        const prompts = this.promptManager.loadPrompts(name);
        const antiAiRules = TemplateLoader.getAntiAiRules();

        const messages = [
            {
                role: 'system',
                content: `你是一位资深小说编辑，专门负责去除AI痕迹。请对以下内容进行润色改写，消除所有AI典型用语和模式，使其读起来像人类作家的手笔。${antiAiRules}\n\n注意：只改写有AI味的部分，保持情节和对话含义不变，保持总字数基本不变。`
            },
            {
                role: 'user',
                content: `请去除以下小说章节中的AI味，直接输出改写后的完整内容：\n\n${content}`
            }
        ];

        return await this.llm.callLLM(messages, 'rewrite');
    }

    async reviewChapter(name, chapterIndex) {
        const fileName = `第${chapterIndex}章.txt`;
        const content = this.novelManager.readChapter(name, fileName);
        if (!content) throw new Error('章节不存在');

        const messages = [
            {
                role: 'system',
                content: '你是一位严格的小说审稿专家。请从以下5个维度对章节进行打分（1-10分），并给出改进建议。输出JSON格式的分数，然后给出文字评价。'
            },
            {
                role: 'user',
                content: `请审阅以下小说章节：

${content}

请从以下5个维度打分（1-10分），并给出具体改进建议：
1. ai_taste（AI味轻重，10分=完全没有AI味）
2. coherence（连贯性）
3. character（角色塑造）
4. literary（文学性）
5. immersion（沉浸感）

请先输出JSON格式的分数如：{"ai_taste":7,"coherence":8,"character":6,"literary":7,"immersion":8}
然后给出详细的文字评价和改进建议。`
            }
        ];

        return await this.llm.callLLM(messages, 'analysis');
    }

    // 章节一致性校验 — 检查新章节与角色状态/前文是否有矛盾
    async checkConsistency(name, chapterIndex, content) {
        // 加载角色状态
        const stateFile = path.join(this.projectsDir, name, 'configs', 'character-state.json');
        let characterState = '';
        if (fs.existsSync(stateFile)) characterState = fs.readFileSync(stateFile, 'utf-8');

        // 加载前一章摘要
        const prevSummary = this.loadChapterSummaries(name, 5);

        // 如果没有参照信息，跳过
        if (!characterState && !prevSummary) return null;

        const messages = [
            {
                role: 'system',
                content: '你是一位专业的小说连续性审查员。请检查新章节是否与已有设定/前文存在矛盾。只关注事实性错误（角色名字写错、性别矛盾、已死角色复活、地点不一致等），不要评价文学质量。'
            },
            {
                role: 'user',
                content: `【角色状态】\n${characterState || '无'}\n\n【前文摘要】\n${prevSummary || '无'}\n\n【新章节（第${chapterIndex}章）】\n${content}\n\n请检查新章节是否有与已有设定或前文矛盾的地方。输出JSON格式：\n{"consistent": true/false, "issues": ["问题1", "问题2"]}\n如果没有矛盾，issues为空数组。只输出JSON，不要其他文字。`
            }
        ];

        try {
            const result = await this.llm.callLLM(messages, 'analysis');
            const jsonMatch = result.match(/\{[\s\S]*"consistent"[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('一致性校验失败:', e.message);
        }
        return null;
    }

    async generateAndSaveSummary(name, chapterIndex, content) {
        const messages = [
            { role: 'system', content: '请用100字以内概括这一章的关键剧情要点，包括：重要事件、角色变化、伏笔。只输出摘要，不要其他文字。' },
            { role: 'user', content: content }
        ];

        try {
            const summary = await this.llm.callLLM(messages, 'analysis');
            const dataDir = path.join(this.projectsDir, name, 'data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, `summary-ch${chapterIndex}.txt`), summary, 'utf-8');
            return summary;
        } catch (e) {
            console.error('生成摘要失败:', e.message);
            return null;
        }
    }

    // 故事弧线 CRUD
    loadStoryArc(name) {
        const arcFile = path.join(this.projectsDir, name, 'configs', 'story-arc.json');
        try {
            if (fs.existsSync(arcFile)) {
                return JSON.parse(fs.readFileSync(arcFile, 'utf-8'));
            }
        } catch (e) {}
        return null;
    }

    saveStoryArc(name, arcData) {
        const configDir = path.join(this.projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'story-arc.json'), JSON.stringify(arcData, null, 2), 'utf-8');
    }

    async generateStoryArc(name, storyIdea, totalChapters) {
        const messages = [
            {
                role: 'system',
                content: '你是一位经验丰富的小说策划师。请为小说规划完整的故事弧线。输出标准JSON格式。'
            },
            {
                role: 'user',
                content: `请为以下小说规划故事弧线：

故事创意：${storyIdea}
计划总章节数：${totalChapters}

请按以下JSON格式输出故事弧线：
{
  "phases": [
    { "name": "开篇", "chapters": "1-3", "goal": "建立世界观，主角登场，初始冲突" },
    { "name": "发展", "chapters": "4-10", "goal": "冲突升级，主角成长" },
    ...
  ]
}

要求：
1. 划分3-6个阶段
2. 每个阶段有明确的章节范围和目标
3. 包含经典的"起承转合"结构
4. 安排至少1个重大转折点`
            }
        ];

        const result = await this.llm.callLLM(messages, 'analysis');

        // 尝试解析JSON
        try {
            const jsonMatch = result.match(/\{[\s\S]*"phases"[\s\S]*\}/);
            if (jsonMatch) {
                const arc = JSON.parse(jsonMatch[0]);
                this.saveStoryArc(name, arc);
                return arc;
            }
        } catch (e) {}

        // 直接保存原始结果
        const fallback = { phases: [], raw: result };
        this.saveStoryArc(name, fallback);
        return fallback;
    }

    // 状态更新
    async generateStateUpdate(name, chapterIndex, content) {
        const stateFile = path.join(this.projectsDir, name, 'configs', 'character-state.json');
        let oldState = '{}';
        if (fs.existsSync(stateFile)) {
            oldState = fs.readFileSync(stateFile, 'utf-8');
        }

        const userContent = PromptTemplateLoader.buildStateUpdateMessages(oldState, content);
        const messages = [
            { role: 'system', content: '你是一个精确的角色状态追踪助手。请根据小说章节内容更新角色状态JSON。只输出JSON，不要其他文字。' },
            { role: 'user', content: userContent }
        ];

        const result = await this.llm.callLLM(messages, 'analysis');
        return result;
    }

    async generateWorldUpdate(name, content) {
        const worldFile = path.join(this.projectsDir, name, 'configs', 'world-bible.json');
        let oldWorld = '{}';
        if (fs.existsSync(worldFile)) {
            oldWorld = fs.readFileSync(worldFile, 'utf-8');
        }

        const data = PromptTemplateLoader.buildWorldUpdateMessages(oldWorld, content);
        const messages = [
            { role: 'system', content: data.system + '\n\n规则：\n' + data.rules.join('\n') },
            { role: 'user', content: data.user }
        ];

        const result = await this.llm.callLLM(messages, 'analysis');
        return result;
    }
}

module.exports = NovelGenerator;
