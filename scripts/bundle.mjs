import { readFile, writeFile, mkdir } from 'node:fs/promises';
const css=await readFile('styles.css','utf8');
let code='';
for(const path of ['catalog.js','icons.js','data.js','model.js','app.js']){
  code+=(await readFile(path,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'')+'\n';
}
let html=await readFile('index.html','utf8');
const svg=await readFile('favicon.svg','utf8');
html=html.replace('href="./favicon.svg"',`href="data:image/svg+xml,${encodeURIComponent(svg)}"`)
  .replace('<link rel="stylesheet" href="./styles.css">',`<style>${css}</style>`)
  .replace('<script type="module" src="./app.js"></script>',`<script>\n(()=>{\n${code}\n})();\n</script>`);
const design=await readFile('docs/notification-design.md','utf8');
html=html.replace('href="https://github.com/ewgftju/saq-notification-test/blob/main/docs/notification-design.md" target="_blank" rel="noopener"',`href="data:text/markdown;charset=utf-8,${encodeURIComponent(design)}" download="SAQ_notification_concept.md"`);
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/SAQ_Notifications_Prototype.html',html);
console.log('Standalone prototype created; no external resources required.');
