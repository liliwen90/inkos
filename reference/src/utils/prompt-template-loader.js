// prompt-template-loader.js - 加载生成提示词和大纲模板
const fs = require('fs');
const path = require('path');

class PromptTemplateLoader {
    constructor() {
        this.templatesDir = path.join(__dirname, '../templates');
        this._generationPrompts = null;
        this._outlineTemplates = null;
    }

    loadGenerationPrompts() {
        if (!this._generationPrompts) {
            const filePath = path.join(this.templatesDir, 'generation-prompts.json');
            this._generationPrompts = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return this._generationPrompts;
    }

    loadOutlineTemplates() {
        if (!this._outlineTemplates) {
            const filePath = path.join(this.templatesDir, 'outline-templates.json');
            this._outlineTemplates = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return this._outlineTemplates;
    }

    buildGenerationMessages(options) {
        const prompts = this.loadGenerationPrompts();
        const gen = prompts.novel_generation;
        let userContent = gen.user_request_prefix + (options.outline || '');

        userContent += gen.chapter_title_requirement;

        if (options.chapterIndex === 1) {
            userContent += gen.first_chapter_character_setup;
        }

        if (options.useState && options.characterState) {
            userContent += gen.state_prefix + options.characterState;
        }

        if (options.useWorld && options.worldBible) {
            userContent += gen.world_bible_prefix + options.worldBible;
        }

        if (options.previousChapters) {
            userContent += gen.previous_chapters_prefix + options.previousChapters;
        }

        return userContent;
    }

    buildExpansionMessages(content, targetWords) {
        const prompts = this.loadGenerationPrompts();
        const exp = prompts.chapter_expansion;

        let userContent = exp.user_request_prefix.replace('{target_words}', targetWords);
        userContent += exp.content_prefix + content;
        userContent += exp.requirements_title;
        userContent += exp.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n');
        userContent += exp.anti_ai_taste;
        userContent += exp.anti_ai_rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
        userContent += exp.warning_suffix;

        return userContent;
    }

    buildStateUpdateMessages(oldState, chapterContent) {
        const prompts = this.loadGenerationPrompts();
        const tmpl = prompts.state_update.user_request_template;
        return tmpl.replace('{old_state}', oldState).replace('{chapter_content}', chapterContent);
    }

    buildWorldUpdateMessages(oldWorld, chapterContent) {
        const prompts = this.loadGenerationPrompts();
        const wb = prompts.world_bible_update;
        const userMsg = wb.user_request_template
            .replace('{old_world}', oldWorld)
            .replace('{chapter_content}', chapterContent);
        return { system: wb.system_prompt, user: userMsg, rules: wb.rules };
    }

    buildOutlineMessages(options) {
        const prompts = this.loadGenerationPrompts();
        const ol = prompts.outline_generation;

        let userContent = ol.user_request_prefix
            .replace('{category_name}', options.categoryName || '小说')
            .replace(/\{chapter_index\}/g, options.chapterIndex)
            .replace('{story_idea}', options.storyIdea || '未提供')
            .replace('{character_state}', options.characterState || '默认')
            .replace('{world_bible}', options.worldBible || '默认');

        if (options.previousOutlines && options.previousOutlines.length > 0) {
            userContent += ol.previous_outlines_prefix;
            options.previousOutlines.forEach((o, i) => {
                userContent += ol.previous_outline_item
                    .replace('{index}', i + 1)
                    .replace('{content}', o);
            });
            userContent += ol.previous_outlines_suffix;
        }

        if (options.chapterIndex === 1) {
            userContent += ol.first_chapter_requirements;
        }

        userContent += ol.generation_suffix.replace('{chapter_index}', options.chapterIndex);

        return userContent;
    }
}

module.exports = new PromptTemplateLoader();
