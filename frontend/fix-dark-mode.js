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

    // Background replacements
    content = content.replace(/background(-color)?:\s*#fff(fff)?\b/gi, 'background$1: var(--surface)');
    content = content.replace(/background:\s*#(f9fafb|fafafa|f3f4f6|f8fafc|eef2f6|f1f5f9|f5f7fb)\b/gi, 'background: var(--muted-surface)');

    // Border replacements (common light grays)
    content = content.replace(/border(?:-color)?:\s*([^;]*?)#(e5e7eb|d1d5db|e2e8f0|cbd5e1)/gi, 'border: $1var(--border)');
    content = content.replace(/border-(top|bottom|left|right):\s*([^;]*?)#(e5e7eb|d1d5db|e2e8f0|cbd5e1)/gi, 'border-$1: $2var(--border)');

    // Text color replacements (dark grays/blacks to dynamic text)
    // Be careful not to replace button text if the button is primary (which needs to stay white or contrast)
    // We'll mostly target generic color declarations.
    content = content.replace(/color:\s*#(111|111111|333|333333|0b1220|0f172a)\b/gi, 'color: var(--text)');
    content = content.replace(/color:\s*#(64748b|4b5563|6b7280|9ca3af|475569)\b/gi, 'color: var(--text-muted)');

    // Box shadow fixes (so dark mode doesn't get stark white shadows or hardcoded black shadows that don't look right)
    content = content.replace(/box-shadow:\s*.*?rgba.*?;/gi, 'box-shadow: var(--shadow);');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function traverseDir(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.scss')) {
            processFile(fullPath);
        }
    }
}

targetDirs.forEach(traverseDir);
console.log('Done mapping static SCSS colors to CSS variables.');
