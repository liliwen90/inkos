const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, 'src');
const backupDir = path.join(__dirname, 'src_backup');
const lockFile = path.join(__dirname, '.build-lock');

// 防止并发构建（上次灾难的根源）
function acquireLock() {
    if (fs.existsSync(lockFile)) {
        const lockContent = fs.readFileSync(lockFile, 'utf-8');
        console.error(`❌ 构建锁已存在！另一个构建进程可能正在运行。`);
        console.error(`   锁信息: ${lockContent}`);
        console.error(`   如果确认没有其他构建进程，请删除 .build-lock 文件后重试。`);
        process.exit(1);
    }
    fs.writeFileSync(lockFile, `PID=${process.pid} TIME=${new Date().toISOString()}`, 'utf-8');
}

function releaseLock() {
    try { fs.unlinkSync(lockFile); } catch (e) {}
}

function getAllJsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            results = results.concat(getAllJsFiles(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    });

    return results;
}

function backupFiles() {
    // 备份前检查：确保源码不是已混淆状态
    const mainJs = path.join(srcDir, 'main.js');
    if (fs.existsSync(mainJs)) {
        const content = fs.readFileSync(mainJs, 'utf-8');
        const obfCount = (content.match(/_0x[a-f0-9]{4,}/g) || []).length;
        if (obfCount > 5) {
            console.error('❌ 源码已是混淆状态，拒绝备份！请先恢复源码。');
            releaseLock();
            process.exit(1);
        }
    }

    console.log('正在备份JS文件...');
    
    if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
    }

    fs.mkdirSync(backupDir, { recursive: true });

    const copyRecursive = (src, dest) => {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            files.forEach(file => {
                copyRecursive(path.join(src, file), path.join(dest, file));
            });
        } else if (src.endsWith('.js')) {
            fs.copyFileSync(src, dest);
        }
    };

    copyRecursive(srcDir, backupDir);
    console.log('备份完成');
}

function obfuscateFiles() {
    console.log('正在混淆JS文件...');
    
    const jsFiles = getAllJsFiles(srcDir);
    
    jsFiles.forEach(file => {
        try {
            const code = fs.readFileSync(file, 'utf-8');
            
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.5,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.2,
                debugProtection: false,
                debugProtectionInterval: 0,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 5,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 4,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.75,
                transformObjectKeys: true,
                unicodeEscapeSequence: false
            });

            fs.writeFileSync(file, obfuscationResult.getObfuscatedCode(), 'utf-8');
            console.log(`混淆完成: ${path.relative(__dirname, file)}`);
        } catch (error) {
            console.error(`混淆失败: ${file}`, error.message);
        }
    });

    console.log('所有文件混淆完成');
}

function restoreFiles() {
    console.log('正在恢复JS文件...');
    
    if (!fs.existsSync(backupDir)) {
        console.error('备份目录不存在');
        return;
    }

    const copyRecursive = (src, dest) => {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            files.forEach(file => {
                copyRecursive(path.join(src, file), path.join(dest, file));
            });
        } else if (src.endsWith('.js')) {
            fs.copyFileSync(src, dest);
        }
    };

    copyRecursive(backupDir, srcDir);
    console.log('恢复完成');
}

function cleanupBackup() {
    console.log('正在清理备份...');
    
    if (fs.existsSync(backupDir)) {
        try {
            if (process.platform === 'win32') {
                execSync(`rmdir /s /q "${backupDir}"`, { stdio: 'inherit' });
            } else {
                execSync(`rm -rf "${backupDir}"`, { stdio: 'inherit' });
            }
            console.log('备份清理完成');
        } catch (error) {
            console.error('清理备份失败:', error.message);
        }
    }
}

function verifyRestore() {
    // 验证恢复是否成功：检查至少一个JS文件是否为可读源码（非混淆）
    const testFile = path.join(srcDir, 'main.js');
    if (!fs.existsSync(testFile)) return false;
    const content = fs.readFileSync(testFile, 'utf-8');
    // 混淆后的代码包含大量 _0x 变量名，如果发现大量此类模式则恢复失败
    const obfuscatedPattern = (content.match(/_0x[a-f0-9]{4,}/g) || []).length;
    if (obfuscatedPattern > 5) {
        console.error('⚠️ 警告：检测到恢复后的文件仍然是混淆代码！不清理备份。');
        return false;
    }
    return true;
}

function build() {
    acquireLock();
    try {
        backupFiles();
        
        obfuscateFiles();
        
        console.log('正在打包应用...');
        execSync('npx electron-builder --win', { stdio: 'inherit' });
        console.log('打包完成');
        
        restoreFiles();
        
        if (!verifyRestore()) {
            console.error('❌ 恢复验证失败！备份保留在 src_backup/ 中，请手动恢复。');
            releaseLock();
            process.exit(1);
        }

        cleanupBackup();
        releaseLock();
        
        console.log('构建流程全部完成！');
    } catch (error) {
        console.error('构建过程出错:', error.message);
        
        console.log('尝试恢复文件...');
        restoreFiles();
        cleanupBackup();
        releaseLock();
        
        process.exit(1);
    }
}

build();

