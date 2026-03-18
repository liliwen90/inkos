// novel-manager.js - 项目管理
const fs = require('fs');
const path = require('path');

class NovelManager {
    constructor() {
        this.projectsDir = path.join(__dirname, '../../userdata/projects');
        if (!fs.existsSync(this.projectsDir)) {
            fs.mkdirSync(this.projectsDir, { recursive: true });
        }
    }

    listProjects() {
        try {
            return fs.readdirSync(this.projectsDir).filter(f => {
                return fs.statSync(path.join(this.projectsDir, f)).isDirectory();
            });
        } catch (e) {
            return [];
        }
    }

    createProject(name) {
        const projectDir = path.join(this.projectsDir, name);
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'configs'), { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'data'), { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'chapters'), { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'storylines'), { recursive: true });
            fs.mkdirSync(path.join(projectDir, 'style-books'), { recursive: true });
        }
        return projectDir;
    }

    getProjectPath(name) {
        return path.join(this.projectsDir, name);
    }

    getChaptersDir(name) {
        return path.join(this.projectsDir, name, 'chapters');
    }

    getConfigsDir(name) {
        return path.join(this.projectsDir, name, 'configs');
    }

    getDataDir(name) {
        return path.join(this.projectsDir, name, 'data');
    }

    getChapterCount(name) {
        const chaptersDir = this.getChaptersDir(name);
        if (!fs.existsSync(chaptersDir)) return 0;
        return fs.readdirSync(chaptersDir).filter(f => /第(\d+)章\.txt$/.test(f)).length;
    }

    getChapterFiles(name) {
        const chaptersDir = this.getChaptersDir(name);
        if (!fs.existsSync(chaptersDir)) return [];
        return fs.readdirSync(chaptersDir)
            .filter(f => /第(\d+)章\.txt$/.test(f))
            .sort((a, b) => {
                const numA = parseInt(a.match(/第(\d+)章/)[1]);
                const numB = parseInt(b.match(/第(\d+)章/)[1]);
                return numA - numB;
            });
    }

    readChapter(name, fileName) {
        const filePath = path.join(this.getChaptersDir(name), fileName);
        if (!fs.existsSync(filePath)) return '';
        return fs.readFileSync(filePath, 'utf-8');
    }

    saveChapter(name, chapterIndex, content) {
        const chaptersDir = this.getChaptersDir(name);
        if (!fs.existsSync(chaptersDir)) fs.mkdirSync(chaptersDir, { recursive: true });
        const fileName = `第${chapterIndex}章.txt`;
        fs.writeFileSync(path.join(chaptersDir, fileName), content, 'utf-8');
    }

    deleteChapter(name, fileName) {
        const filePath = path.join(this.getChaptersDir(name), fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    getProjectInfo(name) {
        const chapters = this.getChapterFiles(name);
        let totalWords = 0;
        chapters.forEach(f => {
            const content = this.readChapter(name, f);
            totalWords += this._countWords(content);
        });
        return {
            chapterCount: chapters.length,
            totalWords: totalWords,
            avgWords: chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0
        };
    }

    _countWords(text) {
        if (!text) return 0;
        const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const english = (text.match(/[a-zA-Z]+/g) || []).length;
        return chinese + english;
    }

    deleteProject(name) {
        const projectDir = path.join(this.projectsDir, name);
        if (!fs.existsSync(projectDir)) return false;
        fs.rmSync(projectDir, { recursive: true, force: true });
        return true;
    }
}

module.exports = NovelManager;
