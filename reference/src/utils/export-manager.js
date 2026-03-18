// export-manager.js - 导出管理
const fs = require('fs');
const path = require('path');
const NovelManager = require('./novel-manager');

class ExportManager {
    constructor() {
        this.novelManager = new NovelManager();
    }

    _escapeHtml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    exportTxt(name) {
        const chapters = this.novelManager.getChapterFiles(name);
        if (chapters.length === 0) return null;

        let fullText = `${name}\n\n`;
        chapters.forEach(f => {
            const content = this.novelManager.readChapter(name, f);
            fullText += content + '\n\n';
        });

        return fullText;
    }

    exportHtml(name) {
        const chapters = this.novelManager.getChapterFiles(name);
        if (chapters.length === 0) return null;

        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${this._escapeHtml(name)}</title>
    <style>
        body { max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: 'Microsoft YaHei', sans-serif; line-height: 1.8; color: #333; }
        h1 { text-align: center; color: #2d3748; }
        .chapter { margin: 40px 0; }
        .chapter p { text-indent: 2em; margin: 0.8em 0; }
    </style>
</head>
<body>
    <h1>${this._escapeHtml(name)}</h1>
`;
        chapters.forEach(f => {
            const content = this.novelManager.readChapter(name, f);
            const paragraphs = content.split('\n').filter(p => p.trim());
            html += '    <div class="chapter">\n';
            paragraphs.forEach(p => {
                html += `        <p>${this._escapeHtml(p)}</p>\n`;
            });
            html += '    </div>\n';
        });

        html += '</body>\n</html>';
        return html;
    }
}

module.exports = ExportManager;
