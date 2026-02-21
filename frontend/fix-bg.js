const fs = require('fs');
const path = require('path');

const targetDirs = [
    path.join(__dirname, 'src', 'pages'),
    path.join(__dirname, 'src', 'components'),
    path.join(__dirname, 'src', 'styles')
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Simple direct replacements for assignments ending in semicolon
    content = content.replace(/background(-color)?:\s*(#fff|#ffffff|white)\s*(!important)?\s*;/gi, 'background$1: var(--surface)$3;');

    // Replace inline shorthand backgrounds like "background: #fff url(...)" 
    // We'll just be careful and capture just the color part if it's the only thing
    content = content.replace(/background:\s*(#fff|#ffffff|white)\s+/gi, 'background: var(--surface) ');

    // CSS mappings like --card-bg: #ffffff;
    content = content.replace(/--[a-zA-Z0-9_-]+:\s*(#fff|#ffffff|white)\s*;/gi, (match) => {
        return match.replace(/(#fff|#ffffff|white)/i, 'var(--surface)');
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[FIXED] ${filePath}`);
    }
}

function traverseDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.scss')) {
            processFile(fullPath);
        }
    }
}

targetDirs.forEach(traverseDir);
console.log('Background scrub complete.');
