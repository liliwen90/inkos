// outline-generator.js - 大纲生成器
const fs = require('fs');
const path = require('path');
const { getInstance: getLLM } = require('./llm-manager');
const NovelManager = require('./novel-manager');
const PromptManager = require('./prompt-manager');
const PromptTemplateLoader = require('./prompt-template-loader');
const TemplateLoader = require('./template-loader');
const StoryIdeaManager = require('./story-idea-manager');

class OutlineGenerator {
    constructor() {
        this.llm = getLLM();
        this.novelManager = new NovelManager();
        this.promptManager = new PromptManager();
        this.storyIdeaManager = new StoryIdeaManager();
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
    }

    getOutlineCount(name) {
        const outlinesDir = path.join(this.projectsDir, name, 'storylines');
        if (!fs.existsSync(outlinesDir)) return 0;
        return fs.readdirSync(outlinesDir).filter(f => /第(\d+)章大纲\.txt$/.test(f)).length;
    }

    getOutlineFiles(name) {
        const outlinesDir = path.join(this.projectsDir, name, 'storylines');
        if (!fs.existsSync(outlinesDir)) return [];
        return fs.readdirSync(outlinesDir)
            .filter(f => /第(\d+)章大纲\.txt$/.test(f))
            .sort((a, b) => {
                const numA = parseInt(a.match(/第(\d+)章/)[1]);
                const numB = parseInt(b.match(/第(\d+)章/)[1]);
                return numA - numB;
            });
    }

    readOutline(name, fileName) {
        const filePath = path.join(this.projectsDir, name, 'storylines', fileName);
        if (!fs.existsSync(filePath)) return '';
        return fs.readFileSync(filePath, 'utf-8');
    }

    saveOutline(name, chapterIndex, content) {
        const outlinesDir = path.join(this.projectsDir, name, 'storylines');
        if (!fs.existsSync(outlinesDir)) fs.mkdirSync(outlinesDir, { recursive: true });
        fs.writeFileSync(path.join(outlinesDir, `第${chapterIndex}章大纲.txt`), content, 'utf-8');
    }

    deleteOutline(name, fileName) {
        const filePath = path.join(this.projectsDir, name, 'storylines', fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    async generateOutlines(name, options = {}) {
        const prompts = this.promptManager.loadPrompts(name);
        const category = prompts ? prompts.category : '';
        const categoryName = category ? (TemplateLoader.getPromptTemplate(category) || {}).name || category : '小说';

        const chapterIndex = this.getOutlineCount(name) + 1;

        // 加载故事创意
        const storyIdea = options.storyIdea || this.storyIdeaManager.loadStoryIdea(name) || '未提供';

        // 加载设定
        let characterState = '默认';
        let worldBible = '默认';
        const stateFile = path.join(this.projectsDir, name, 'configs', 'character-state.json');
        const worldFile = path.join(this.projectsDir, name, 'configs', 'world-bible.json');
        if (fs.existsSync(stateFile)) characterState = fs.readFileSync(stateFile, 'utf-8');
        if (fs.existsSync(worldFile)) worldBible = fs.readFileSync(worldFile, 'utf-8');

        // 加载前面的大纲
        const previousOutlines = [];
        const maxPrev = Math.min(5, chapterIndex - 1);
        for (let i = Math.max(1, chapterIndex - maxPrev); i < chapterIndex; i++) {
            const content = this.readOutline(name, `第${i}章大纲.txt`);
            if (content) previousOutlines.push(content);
        }

        // 构建消息
        let userContent = PromptTemplateLoader.buildOutlineMessages({
            categoryName: categoryName,
            chapterIndex: chapterIndex,
            storyIdea: storyIdea,
            characterState: characterState,
            worldBible: worldBible,
            previousOutlines: previousOutlines
        });

        // 注入故事弧线，让大纲知道当前章节在全书中的位置
        const arcFile = path.join(this.projectsDir, name, 'configs', 'story-arc.json');
        if (fs.existsSync(arcFile)) {
            try {
                const arc = JSON.parse(fs.readFileSync(arcFile, 'utf-8'));
                if (arc && arc.phases && arc.phases.length > 0) {
                    let arcContext = '\n\n【故事弧线位置】\n';
                    arc.phases.forEach(phase => {
                        arcContext += `${phase.name} (第${phase.chapters}章): ${phase.goal}\n`;
                    });
                    arcContext += `\n当前要生成的是第${chapterIndex}章大纲，请根据该章在弧线中的位置来安排情节方向和节奏。`;
                    userContent += arcContext;
                }
            } catch (e) {}
        }

        // 加载大纲模板的系统提示词
        const outlineTemplates = PromptTemplateLoader.loadOutlineTemplates();
        const spt = outlineTemplates.system_prompt_template || {};
        let systemPrompt = spt.system_role || '你是一位专业的小说策划师。';

        // 注入通用大纲格式要求
        if (spt.task_description) {
            systemPrompt += '\n\n' + spt.task_description;
        }
        if (spt.outline_components) {
            systemPrompt += '\n\n大纲应包含以下内容：\n' + spt.outline_components.map((c, i) => `${i + 1}. ${c}`).join('\n');
        }
        if (spt.output_format) {
            systemPrompt += '\n\n输出格式：\n' + spt.output_format;
        }
        if (spt.format_instruction) {
            systemPrompt += '\n\n' + spt.format_instruction;
        }

        // 注入分类专用的大纲要求（直接位于顶层，非categories子对象）
        const categoryTemplate = outlineTemplates[category];
        if (categoryTemplate) {
            if (categoryTemplate.system_role) {
                systemPrompt = categoryTemplate.system_role + '\n\n' + systemPrompt;
            }
            if (categoryTemplate.outline_requirements) {
                systemPrompt += '\n\n【' + (categoryTemplate.name || category) + '大纲要求】\n';
                systemPrompt += categoryTemplate.outline_requirements.map((r, i) => `${i + 1}. ${r}`).join('\n');
            }
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];

        const result = await this.llm.callLLM(messages, 'generation');

        this.saveOutline(name, chapterIndex, result);

        return { content: result, chapterIndex: chapterIndex };
    }
}

module.exports = OutlineGenerator;
