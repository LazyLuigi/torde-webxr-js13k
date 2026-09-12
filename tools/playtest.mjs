import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {engineFixture} from './engine-fixture.mjs';

// Standalone desktop test copy, with shortcuts and the official engine embedded.
// Never writes to dist or changes the contest archive.
const riding=process.argv.includes('--ride');
const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',target:'es2020',define:{DEV:'true',RIDE:String(riding)}});
const engine=await readFile(await engineFixture());
const template=await readFile('src/index.html','utf8');
const script=`<script type="module">import * as T from 'data:text/javascript;base64,${engine.toString('base64')}';globalThis.T=T;${result.outputFiles[0].text}</script>`;
const dir=riding?'.dream-loop/playtest-ride':'.dream-loop/playtest';await mkdir(dir,{recursive:true});
const file=resolve(dir,'index.html');
await writeFile(file,template.replace(/<!-- GAME -->[\s\S]*?<!-- END GAME -->/,()=>script));
console.log(file+' — 1: village, 2: road + bow, 3: unicorn, 4: mount now');
if(!process.argv.includes('--no-open'))execFileSync('open',[file]);
