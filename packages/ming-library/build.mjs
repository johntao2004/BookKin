import {build} from 'esbuild';
import {readFile, writeFile, mkdir, readdir, rm, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(root, '../../apps/web/public/assets/ming-library');
const result = await build({entryPoints: [path.join(root, 'src/app.js')], bundle: true, write: false,
  minify: true, format: 'iife', target: ['es2020'], legalComments: 'inline'});
const script = result.outputFiles[0].text;
const name = `app-${createHash('sha256').update(script).digest('hex').slice(0,12)}.js`;
await mkdir(out, {recursive: true});
for (const file of await readdir(out)) if (/^app-[a-f0-9]{12}\.js$/.test(file) && file !== name) await rm(path.join(out, file));
await writeFile(path.join(out, name), script);
await writeFile(path.join(out, 'index.html'), (await readFile(path.join(root, 'index.template.html'), 'utf8')).replace('__APP_SCRIPT_URL__', `./${name}`));
await copyFile(path.join(root, 'interface.css'), path.join(out, 'interface.css'));
console.log(`Built local Ming library 2.14.0: ${name}`);
