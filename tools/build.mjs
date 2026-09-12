import {build,transform} from 'esbuild';
import {minify} from 'terser';
import {Packer} from 'roadroller';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {roadrollerOptionsFor,gameHTML,archiveHTML} from './roadroller-build.mjs';

const engine='https://play.js13kgames.com/2026/webxr/three.js';
const riding=process.argv.includes('--ride'),packing=process.argv.includes('--pack'),output=riding?(packing?'.dream-loop/ride-release':'.dream-loop/ride-fast'):packing?'dist':'.dream-loop/fast';
const prepareIndex=process.argv.indexOf('--prepare-roadroller');
if(prepareIndex>=0&&(!packing||!process.argv[prepareIndex+1]||process.argv[prepareIndex+1].startsWith('--')))throw Error('--prepare-roadroller requires --pack and an output directory');
const prepare=prepareIndex>=0?resolve(process.argv[prepareIndex+1]):null,work=prepare||resolve('.dream-loop/build');
const desktop=!packing&&!process.argv.includes('--vr-only');
if(!prepare)await mkdir(output,{recursive:true});
await mkdir(work,{recursive:true});
// Build-only transforms keep the source and desktop diagnostics readable.
const soundNames=['shot','hit','hurt','wolf','magic','heal','win','talk','step'];
const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:packing?'esm':'iife',target:packing?'es2021':'es2020',define:{DEV:String(desktop),RIDE:String(riding)},legalComments:'none',plugins:[{name:'release-fields',setup(b){b.onLoad({filter:/src\/(main|audio|models)\.js$/},async({path})=>{
 let contents=await readFile(path,'utf8');
 if(packing){
  // Separate game fields from document.body and Three.js material.side.
  if(path.endsWith('/models.js'))contents=contents.replaceAll('root.userData={body,','root.userData={torso:body,').replace(/\bd\.body\b/g,'d.torso');
  if(path.endsWith('/main.js'))contents=contents.replace(/\bw\.side\b/g,'w.flank')
   .replace(/taught\|=\d+/g,'0').replace(/walked\+=speed\*Math.hypot\(x,z\)/g,'0').replace(/walked\+=speed/g,'0')
   .replace(/kills\+\+|misses\+\+|frameCount\+\+/g,'0').replace(/frameTotal\+=\(ms-lastFrameReal\)\/1000\|\|\.016/g,'0');
 }
 for(const [i,name]of soundNames.entries()){
  if(path.endsWith('/main.js'))contents=contents.replaceAll("sound('"+name+"')",'sound('+i+')');
  if(path.endsWith('/audio.js'))contents=contents.replaceAll("kind==='"+name+"'",'kind==='+i);
 }
 return{contents,loader:'js'};
});}}]});
// Only game-owned properties: never rename Three.js, DOM or WebXR API fields.
const privateProperties=/^(shaman|rainbow|scenery|colliders|obstacles|horn|legs|tail|knee|back|facets|hand|source|string|dead|attack|pause|seed|life|magic|hit|hp|speed|sun|sky|marker|head|cone|eye|ring|ridge|ambush|slot|charging|rejoin|torso|flank)$/;
// builtins is safe ONLY with this audited list; never include body or side.
const {code}=await minify(result.outputFiles[0].text,{ecma:2020,toplevel:true,module:packing,compress:{passes:5,unsafe:true,unsafe_arrows:true,unsafe_methods:true,...(packing?{sequences:false}:{})},mangle:{properties:{builtins:packing,regex:privateProperties}},format:{comments:false}});
let template=await readFile('src/index.html','utf8');
if(packing)template=template.replace('width:76px;height:76px;','').replace('width:42px;height:42px;','');
if(!desktop)template=template.replace(/#aim\{[^}]*\}#charge\{[^}]*\}/,'').replace('<div id="aim"></div><div id="charge"></div>','').replace(/(?:\.playing )?#hud\{[^}]*\}|#guide\{[^}]*\}|#fade\{[^}]*\}/g,'').replace(/<div id="hud">(<canvas[^>]+)><\/canvas><\/div>/,'$1 hidden></canvas>').replace('<div id="fade"></div>','');
if(packing){const css=template.match(/<style>([\s\S]*?)<\/style>/)[1];template=template.replace(css,(await transform(css,{loader:'css',minify:true})).code.trim());}
template=template.replace(/>\s+</g,'><').replace(/="([\w-]+)"/g,'=$1');
await writeFile(resolve(work,'game.min.js'),code);
const ui=template.slice(template.indexOf('<style>'),template.indexOf('<!-- GAME -->')).trim();
const shell=template.slice(0,template.indexOf('<style>'))+'<body><!-- GAME --><!-- END GAME -->';
const plans=[['packed',code,template],['all-packed','document.body.innerHTML='+JSON.stringify(ui)+';'+code,shell]];
if(prepare){
 await writeFile(resolve(prepare,'manifest.json'),JSON.stringify({engine,minifiedJSBytes:Buffer.byteLength(code),plans}));
 console.log('Prepared exact release inputs in '+prepare);process.exit(0);
}
const candidates=[['plain',code,template]];
// Frozen after size and browser validation; do not randomize release builds.
const roadrollerOptions=packing?JSON.parse(await readFile(new URL('./roadroller-options.json',import.meta.url),'utf8')):null;
if(packing)for(const [name,input,html] of plans){
 const options=roadrollerOptionsFor(roadrollerOptions,name);
 const packer=new Packer([{data:input,type:'js',action:'eval'}],options);
 const {firstLine,secondLine}=packer.makeDecoder();
 candidates.push([name,firstLine+'\n'+secondLine,html]);
}
let best;
for(const [name,js,base] of candidates){
 const dir=resolve(work,name),html=gameHTML(base,js,engine);
 const bytes=await archiveHTML(html,dir);
 console.log(name+': '+bytes+' bytes');
 if(!best||bytes<best.bytes)best={dir,bytes,name};
}
if(packing&&best.bytes>13312)throw Error(`ZIP is ${best.bytes-13312} bytes over budget; existing ${output}/ release was preserved.`);
await copyFile(best.dir+'/index.html',output+'/index.html');
await copyFile(best.dir+'/game.zip',output+'/torde.zip');
await writeFile(output+'/build.json',JSON.stringify({bytes:best.bytes,limit:13312,remaining:13312-best.bytes,packing:best.name,engine,variant:'ride',desktop,minifiedJSBytes:Buffer.byteLength(code),roadrollerOptions:packing&&best.name!=='plain'?roadrollerOptionsFor(roadrollerOptions,best.name):null},null,2)+'\n');
console.log(`TORDE: ${best.bytes}/13312 bytes; ${13312-best.bytes} bytes remaining (music included).`);
