// rewrite-tool.js - 改写工具
const { getInstance: getLLM } = require('./llm-manager');
const PromptManager = require('./prompt-manager');

class RewriteTool {
    constructor() {
        this.llm = getLLM();
        this.promptManager = new PromptManager();
    }

    async rewrite(text, mode, options = {}) {
        const modePrompts = {
            polish: '请对以下段落进行润色，提升文笔质量，保持原意不变。使句子更加流畅优美，同时消除AI味：',
            vivid: '请将以下段落改写得更加生动形象。增加动态描写、感官细节、比喻修辞，让画面感更强：',
            concise: '请将以下段落精简。删除冗余词句，保留核心信息，使表达更加干练有力：',
            emotional: '请深化以下段落的情感表达。加强角色的内心世界描写，让读者更能感同身受：',
            dialogue: '请优化以下段落中的对话，使其更加自然真实。人物对话应该有个性差异，像真实人类交流：',
            sensory: this._buildSensoryPrompt(options.senses)
        };

        const prompt = modePrompts[mode] || modePrompts.polish;

        const messages = [
            {
                role: 'system',
                content: '你是一位经验丰富的小说编辑。请按照要求改写以下内容。只输出改写后的内容，不要输出其他说明文字。'
            },
            {
                role: 'user',
                content: `${prompt}\n\n${text}`
            }
        ];

        return await this.llm.callLLM(messages, 'rewrite');
    }

    _buildSensoryPrompt(senses) {
        const senseMap = {
            sight: '视觉（色彩、光影、形态）',
            sound: '听觉（声音、音调、节奏）',
            smell: '嗅觉（气味、芳香）',
            touch: '触觉（温度、质感、压力）',
            taste: '味觉（味道、口感）'
        };

        const selected = senses || ['sight', 'sound', 'touch'];
        const senseList = selected.map(s => senseMap[s] || s).join('、');

        return `请为以下段落增强五感描写，重点增强：${senseList}。为关键场景补充具体的感官细节：`;
    }
}

module.exports = RewriteTool;
