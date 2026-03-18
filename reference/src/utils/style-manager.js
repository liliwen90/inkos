// style-manager.js - 人性化写作风格管理
const fs = require('fs');
const path = require('path');
const { getInstance: getLLM } = require('./llm-manager');

class StyleManager {
    constructor() {
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
        this.llm = getLLM();
    }

    // 默认人性化设置
    getDefaultSettings() {
        return {
            pov: 'third-limited',
            tense: 'past',
            creativity: 5,
            pacing: 'balanced',
            mood: 'neutral',
            showDontTell: 'medium',
            dialogue: 'natural',
            density: 'medium'
        };
    }

    loadHumanizationSettings(name) {
        const filePath = path.join(this.projectsDir, name, 'configs', 'humanization.json');
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {}
        return this.getDefaultSettings();
    }

    saveHumanizationSettings(name, settings) {
        const configDir = path.join(this.projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'humanization.json'), JSON.stringify(settings, null, 2), 'utf-8');
    }

    // 构建风格指导文本
    buildStyleGuidance(settings) {
        if (!settings) return '';
        const povMap = { 'first': '第一人称视角', 'third-limited': '第三人称有限视角', 'third-omniscient': '第三人称全知视角' };
        const tenseMap = { 'past': '过去时态', 'present': '现在时态' };
        const pacingMap = { 'fast': '快节奏，动作密集', 'balanced': '均衡节奏', 'slow': '慢节奏，沉浸式' };
        const moodMap = { 'neutral': '中性客观', 'tense': '紧张悬疑', 'warm': '温馨治愈', 'dark': '黑暗沉重', 'humorous': '幽默诙谐', 'epic': '史诗恢宏' };
        const showMap = { 'low': '适度展示', 'medium': '优先展示代替告知', 'high': '严格展示，禁用情感标签' };
        const dialogueMap = { 'formal': '正式措辞', 'natural': '自然对话', 'colloquial': '口语化' };
        const densityMap = { 'sparse': '简洁惜墨', 'medium': '适中详略', 'rich': '丰富沉浸' };

        let guide = '\n\n【人性化写作风格要求】\n';
        guide += `- 叙事视角：${povMap[settings.pov] || '第三人称有限视角'}\n`;
        guide += `- 叙事时态：${tenseMap[settings.tense] || '过去时态'}\n`;
        guide += `- 创意度：${settings.creativity || 5}/10\n`;
        guide += `- 叙事节奏：${pacingMap[settings.pacing] || '均衡节奏'}\n`;
        guide += `- 情感基调：${moodMap[settings.mood] || '中性客观'}\n`;
        guide += `- Show Don't Tell：${showMap[settings.showDontTell] || '优先展示代替告知'}\n`;
        guide += `- 对话风格：${dialogueMap[settings.dialogue] || '自然对话'}\n`;
        guide += `- 描写密度：${densityMap[settings.density] || '适中详略'}\n`;

        return guide;
    }

    // 构建风格指纹指导
    buildFingerprintGuidance(name) {
        const fpPath = path.join(this.projectsDir, name, 'data', 'fingerprint.json');
        try {
            if (fs.existsSync(fpPath)) {
                const fp = JSON.parse(fs.readFileSync(fpPath, 'utf-8'));
                if (fp.enabled === false) return '';
                const strength = fp.strength || 7;
                let guide = `\n\n【风格指纹指导（模仿强度：${strength}/10）】\n`;
                guide += fp.fingerprint || '';
                return guide;
            }
        } catch (e) {}
        return '';
    }

    // 加载声音卡片
    loadVoiceCards(name) {
        const filePath = path.join(this.projectsDir, name, 'data', 'voice-cards.json');
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {}
        return [];
    }

    saveVoiceCards(name, cards) {
        const dataDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'voice-cards.json'), JSON.stringify(cards, null, 2), 'utf-8');
    }

    buildVoiceCardsGuidance(name) {
        const cards = this.loadVoiceCards(name);
        if (!cards || cards.length === 0) return '';
        let guide = '\n\n【角色声音卡片】\n';
        cards.forEach(card => {
            guide += `\n角色：${card.name}\n`;
            if (card.speech) guide += `说话风格：${card.speech}\n`;
            if (card.tone) guide += `语调特征：${card.tone}\n`;
            if (card.quirks) guide += `口癖/习惯：${card.quirks}\n`;
        });
        return guide;
    }

    // 加载风格样本
    loadStyleSamples(name) {
        const filePath = path.join(this.projectsDir, name, 'data', 'style-samples.txt');
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch (e) {}
        return '';
    }

    saveStyleSamples(name, text) {
        const dataDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'style-samples.txt'), text, 'utf-8');
    }

    buildStyleSamplesGuidance(name) {
        const samples = this.loadStyleSamples(name);
        if (!samples || samples.trim().length < 100) return '';
        const truncated = samples.substring(0, 6000);
        return `\n\n【风格参考样本】\n请模仿以下文风进行写作：\n${truncated}\n`;
    }

    // 场景节拍
    loadSceneBeats(name, chapterIndex) {
        const filePath = path.join(this.projectsDir, name, 'data', `beats-ch${chapterIndex}.json`);
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {}
        return null;
    }

    saveSceneBeats(name, chapterIndex, beats) {
        const dataDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, `beats-ch${chapterIndex}.json`), JSON.stringify(beats, null, 2), 'utf-8');
    }

    buildSceneBeatsGuidance(name, chapterIndex) {
        const beats = this.loadSceneBeats(name, chapterIndex);
        if (!beats || beats.length === 0) return '';
        let guide = '\n\n【本章场景节拍】\n请按照以下节拍安排章节内容：\n';
        const list = Array.isArray(beats) ? beats : [beats];
        list.forEach((b, i) => {
            guide += `${i + 1}. ${b}\n`;
        });
        return guide;
    }

    // 汇总所有风格指导
    buildAllStyleGuidance(projectName, chapterIndex) {
        let guidance = '';
        const settings = this.loadHumanizationSettings(projectName);
        guidance += this.buildStyleGuidance(settings);
        guidance += this.buildFingerprintGuidance(projectName);
        guidance += this.buildVoiceCardsGuidance(projectName);
        guidance += this.buildStyleSamplesGuidance(projectName);
        guidance += this.buildSceneBeatsGuidance(projectName, chapterIndex);
        return guidance;
    }

    // 创意度 → 温度值映射（封顶1.0，防止输出不连贯）
    creativityToTemperature(creativity) {
        const c = parseInt(creativity) || 5;
        return Math.min(1.0, 0.3 + (c - 1) * 0.08); // 1→0.3, 5→0.62, 10→1.0
    }

    // 多书风格分析
    async analyzeMultiBookStyle(name, progressCallback) {
        const styleBooksDir = path.join(this.projectsDir, name, 'style-books');
        if (!fs.existsSync(styleBooksDir)) return null;

        const books = fs.readdirSync(styleBooksDir).filter(f => f.endsWith('.txt'));
        if (books.length === 0) return null;

        if (progressCallback) progressCallback('正在采样文本...', 10);

        // 从每本书采样
        let samples = '';
        books.forEach(bookFile => {
            const content = fs.readFileSync(path.join(styleBooksDir, bookFile), 'utf-8');
            const totalLen = content.length;
            if (totalLen < 500) return;

            // 采样3个片段：开头、中间、结尾
            const sampleLen = Math.min(1500, Math.floor(totalLen / 3));
            const start = content.substring(0, sampleLen);
            const mid = content.substring(Math.floor(totalLen / 2) - sampleLen / 2, Math.floor(totalLen / 2) + sampleLen / 2);
            const end = content.substring(totalLen - sampleLen);
            samples += `\n\n--- 来自《${bookFile.replace('.txt', '')}》---\n`;
            samples += `【开头段落】\n${start}\n\n【中间段落】\n${mid}\n\n【结尾段落】\n${end}\n`;
        });

        if (progressCallback) progressCallback('AI正在深度分析风格...', 40);

        const analysisPrompt = `请深度分析以下多本小说的文风特征，提炼出精准的"风格指纹"。

分析维度：
1. 句式节奏（长短句比例、断句习惯）
2. 用词偏好（常用词汇、文化程度、口语vs书面）
3. 叙事距离（紧贴角色 vs 远景俯瞰）
4. 修辞习惯（比喻、排比、夸张的使用倾向）
5. 情感表达方式（直接抒情 vs 景物寄情 vs 动作暗示）
6. 对话处理（对话占比、说话标签习惯、口语程度）
7. 场景转换方式（硬切 vs 过渡 vs 蒙太奇）
8. 独特标志（作者的个人特色手法、独特expression）

请输出一份详细的风格指纹报告，后续AI将根据此报告模仿该文风写作。

${samples}`;

        const messages = [
            { role: 'system', content: '你是一位资深的文学风格分析专家。请用中文详细分析给定文本的写作风格特征。' },
            { role: 'user', content: analysisPrompt }
        ];

        const result = await this.llm.callLLM(messages, 'analysis');

        if (progressCallback) progressCallback('保存风格指纹...', 90);

        // 保存指纹结果
        const fpData = {
            fingerprint: result,
            enabled: true,
            strength: 7,
            analyzedBooks: books.map(b => b.replace('.txt', '')),
            analyzedAt: new Date().toISOString()
        };

        const dataDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'fingerprint.json'), JSON.stringify(fpData, null, 2), 'utf-8');

        if (progressCallback) progressCallback('风格指纹生成完成！', 100);

        return fpData;
    }

    // 加载指纹数据
    loadFingerprint(name) {
        const fpPath = path.join(this.projectsDir, name, 'data', 'fingerprint.json');
        try {
            if (fs.existsSync(fpPath)) {
                return JSON.parse(fs.readFileSync(fpPath, 'utf-8'));
            }
        } catch (e) {}
        return null;
    }

    saveFingerprint(name, data) {
        const dataDir = path.join(this.projectsDir, name, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'fingerprint.json'), JSON.stringify(data, null, 2), 'utf-8');
    }

    deleteFingerprint(name) {
        const fpPath = path.join(this.projectsDir, name, 'data', 'fingerprint.json');
        if (fs.existsSync(fpPath)) fs.unlinkSync(fpPath);
    }

    // 获取风格书列表
    getStyleBooks(name) {
        const dir = path.join(this.projectsDir, name, 'style-books');
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
    }

    addStyleBook(name, filePath) {
        const dir = path.join(this.projectsDir, name, 'style-books');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fileName = path.basename(filePath);
        fs.copyFileSync(filePath, path.join(dir, fileName));
    }

    removeStyleBook(name, bookName) {
        const filePath = path.join(this.projectsDir, name, 'style-books', bookName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // ========== AI内容建议系统 ==========

    // 基于学习的小说生成全方位内容建议
    async generateContentSuggestions(name, progressCallback) {
        const styleBooksDir = path.join(this.projectsDir, name, 'style-books');
        if (!fs.existsSync(styleBooksDir)) return null;

        const books = fs.readdirSync(styleBooksDir).filter(f => f.endsWith('.txt'));
        if (books.length === 0) return null;

        if (progressCallback) progressCallback('正在采样文本用于内容分析...', 10);

        // 从每本书采样（与指纹分析相同策略）
        let samples = '';
        books.forEach(bookFile => {
            const content = fs.readFileSync(path.join(styleBooksDir, bookFile), 'utf-8');
            const totalLen = content.length;
            if (totalLen < 500) return;

            const sampleLen = Math.min(2000, Math.floor(totalLen / 3));
            const start = content.substring(0, sampleLen);
            const mid = content.substring(Math.floor(totalLen / 2) - sampleLen / 2, Math.floor(totalLen / 2) + sampleLen / 2);
            const end = content.substring(totalLen - sampleLen);
            samples += `\n--- 来自《${bookFile.replace('.txt', '')}》---\n`;
            samples += `【开头】\n${start}\n\n【中间】\n${mid}\n\n【结尾】\n${end}\n`;
        });

        if (progressCallback) progressCallback('AI正在生成全方位创作建议...', 30);

        const prompt = `你是一位资深小说顾问。你已经深入阅读了以下小说文本样本。
现在，请基于这些小说的类型、风格、结构特征，为创作同类型新小说提供完整的创作建议。

请严格按以下JSON格式输出，不要输出任何JSON以外的内容：

{
  "storyIdeas": [
    {"title": "创意标题1", "content": "200字以内的完整故事创意描述，包含核心冲突和主角设定"},
    {"title": "创意标题2", "content": "200字以内，不同方向的创意"},
    {"title": "创意标题3", "content": "200字以内，又一个不同方向"}
  ],
  "writerRole": "基于原著写作风格生成的作者角色定义（200字以内，描述AI应扮演的角色身份和专业能力）",
  "writingRules": "基于原著特征生成的创作规则（300字以内，包含具体的写作要求和约束）",
  "humanizeSettings": {
    "pov": "first或third-limited或third-omniscient",
    "tense": "past或present",
    "creativity": 5,
    "pacing": "fast或balanced或slow",
    "mood": "neutral或tense或warm或dark或humorous或epic",
    "showDontTell": "low或medium或high",
    "dialogue": "formal或natural或colloquial",
    "density": "sparse或medium或rich",
    "reasons": {
      "pov": "为什么推荐这个视角",
      "tense": "为什么推荐这个时态",
      "pacing": "为什么推荐这个节奏",
      "mood": "为什么推荐这个基调",
      "dialogue": "为什么推荐这个对话风格",
      "density": "为什么推荐这个密度"
    }
  },
  "voiceCards": [
    {"name": "角色类型1", "speech": "说话风格描述", "tone": "语调特征", "quirks": "口癖或习惯"},
    {"name": "角色类型2", "speech": "说话风格", "tone": "语调", "quirks": "口癖"}
  ],
  "characterState": {
    "protagonist": {"name": "主角名示例", "identity": "身份", "personality": "性格特点", "abilities": "能力", "relationships": []},
    "supporting": [{"name": "配角名", "role": "角色定位", "personality": "性格"}]
  },
  "worldBible": {
    "setting": "世界观背景描述",
    "era": "时代背景",
    "rules": ["世界规则1", "世界规则2"],
    "locations": ["主要地点1", "主要地点2"],
    "factions": ["势力/组织1", "势力/组织2"]
  },
  "sceneBeats": [
    {"title": "紧张开场型", "beats": ["节拍1", "节拍2", "节拍3", "节拍4"]},
    {"title": "日常切入型", "beats": ["节拍1", "节拍2", "节拍3", "节拍4"]},
    {"title": "悬念推进型", "beats": ["节拍1", "节拍2", "节拍3", "节拍4"]}
  ],
  "storyArc": {
    "phases": [
      {"name": "阶段名", "chapters": "1-N", "goal": "该阶段的目标"}
    ]
  }
}

注意：
- storyIdeas: 参考原著类型和风格，生成3个全新的、不同方向的故事创意
- writerRole: 分析原著作者的写作身份特征来定义
- writingRules: 从原著中提炼出的写作规则和技巧
- humanizeSettings: 分析原著实际使用的视角/时态/节奏等，推荐最匹配的值
- voiceCards: 提取原著中最有代表性的角色类型（不用原名，用类型描述）
- characterState/worldBible: 生成适合该类型小说的初始模板
- sceneBeats: 生成3种不同风格的章节节拍模板
- storyArc: 按20章规模生成故事弧线建议

以下是小说文本样本：
${samples}`;

        const messages = [
            { role: 'system', content: '你是一位精通各类型小说创作的资深顾问。请严格按要求的JSON格式输出内容建议，不要输出任何JSON以外的文字。' },
            { role: 'user', content: prompt }
        ];

        if (progressCallback) progressCallback('正在等待AI分析结果...', 50);

        const result = await this.llm.callLLM(messages, 'analysis');

        if (progressCallback) progressCallback('正在解析建议结果...', 85);

        // 解析JSON
        let suggestions = null;
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // 如果JSON解析失败，保存原始文本
            suggestions = { raw: result, parseError: true };
        }

        // 保存
        const configDir = path.join(this.projectsDir, name, 'configs');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

        const savedData = {
            ...suggestions,
            generatedAt: new Date().toISOString(),
            fromBooks: books.map(b => b.replace('.txt', ''))
        };

        fs.writeFileSync(
            path.join(configDir, 'ai-suggestions.json'),
            JSON.stringify(savedData, null, 2),
            'utf-8'
        );

        if (progressCallback) progressCallback('内容建议生成完成！', 100);

        return savedData;
    }

    // 加载已保存的建议
    loadSuggestions(name) {
        const sugFile = path.join(this.projectsDir, name, 'configs', 'ai-suggestions.json');
        try {
            if (fs.existsSync(sugFile)) {
                return JSON.parse(fs.readFileSync(sugFile, 'utf-8'));
            }
        } catch (e) {}
        return null;
    }
}

module.exports = StyleManager;
