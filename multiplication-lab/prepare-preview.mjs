import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
for(const f of ['index.html','style.css','app.js','math.mjs'])await copyFile(new URL('./'+f,import.meta.url),new URL('./dist/'+f,import.meta.url));
console.log('Static preview prepared. GitHub Pages serves the original files directly.');
