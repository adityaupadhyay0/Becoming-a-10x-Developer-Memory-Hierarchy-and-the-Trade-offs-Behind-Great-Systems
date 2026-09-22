const fs = require('fs');
let content = fs.readFileSync('packages/experimental/systems-map/src/analyzer/index.ts', 'utf8');
content = content.replace(/split\('[\n\r]+'\)/g, "split('\\n')");
content = content.replace(/\.join\('[\n\r]+'\)/g, ".join('\\n')");
fs.writeFileSync('packages/experimental/systems-map/src/analyzer/index.ts', content);
