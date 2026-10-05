import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html', 'styles.css', 'workflow.css', 'saq-logo.png', 'app.js', 'model.js', 'data.js', 'catalog.js', 'icons.js', 'favicon.svg']) {
  await cp(file, `dist/${file}`);
}
console.log('Static application built in dist/');
