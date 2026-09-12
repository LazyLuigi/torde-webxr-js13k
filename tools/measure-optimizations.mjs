// Non-destructive size experiments. Never writes src, dist or the deployed game.
import {build} from 'esbuild';
import {minify} from 'terser';
import {Packer} from 'roadroller';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root='.dream-loop/size-study';await mkdir(root,{recursive:true});
const template=(await readFile('src/index.html','utf8')).replace(/>\s+</g,'><').replace(/="([\w-]+)"/g,'=$1');
const ui=template.slice(template.indexOf('<style>'),template.indexOf('<!-- GAME -->')).trim();
const shell=template.slice(0,template.indexOf('<style>'))+'<body><!-- GAME --><!-- END GAME --></html>';
const properties='shaman|rainbow|scenery|obstacles|horn|legs|tail|knee|back|facets|hand|source|string|dead|attack|seed|life|magic|hit|hp|speed|sun|sky|marker';
const sounds=['shot','hit','hurt','wolf','magic','heal','win','talk','step'];
const rounding=process.argv.includes('--rounding');const extra=process.argv.includes('--geometry')||rounding;
const report=extra?JSON.parse(await readFile(root+'/report.json','utf8')):[];
let fixed=extra?JSON.parse(await readFile(root+'/parameters.json','utf8')):null;
for(const name of rounding?['rounded-models','combined-rounded-models']:extra?['geometry-csv','geometry-pairs','combined-geometry-csv','combined-geometry-pairs']:['reference','telemetry','sound-ids','private-fields','combined']){
 const combined=name.startsWith('combined'),telemetry=name==='telemetry'||combined,soundIds=name==='sound-ids'||combined,fields=name==='private-fields'||combined;
 const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',target:'es2020',define:{DEV:'false',RIDE:'true'},legalComments:'none',plugins:[{name:'probe',setup(b){b.onLoad({filter:/src\/.*\.js$/},async({path})=>{
  let text=await readFile(path,'utf8');
  if(name.includes('rounded')&&path.endsWith('/models.js')){
   text=text.replace(/(shape\([^,]+,\s*(\d+),)(\[\[[\d.,\[\]\-\s]+?\]\])/g,(match,prefix,key,data)=>{
    if(+key>=23)return match;
    const rows=Function('return '+data)();
    return prefix+JSON.stringify(rows.map(r=>r.map(n=>Math.abs(n)<.01?n:Math.round(n*100)/100)));
   });
  }
  if(name.includes('geometry')&&path.endsWith('/models.js')){
   const pairs=name.endsWith('pairs');
   text=text.replace(/\[\[[\d.,\[\]\-\s]+?\]\]/g,match=>{
    const rows=Function('return '+match)();
    if(!rows.every(r=>r.length===4))return match;
    const encoded=pairs?rows.flat().map(n=>{const v=Math.round(n*1000)+2048;if(v<0||v>4095)throw Error('Coordinate out of range');return String.fromCharCode(32+(v>>6),32+(v&63));}).join(''):rows.map(r=>r.map(n=>Math.round(n*1000)).join(',')).join(';');
    return JSON.stringify(encoded);
   });
   const decode=pairs?"rings.match(/.{8}/g).map(r=>[0,2,4,6].map(i=>(r.charCodeAt(i)*64+r.charCodeAt(i+1)-4128)/1000))":"rings.split(';').map(r=>r.split(',').map(n=>n/1000))";
   text=text.replace('const pos=[], indices=[];',"if(typeof rings==='string')rings="+decode+";const pos=[], indices=[];");
  }
  if(telemetry&&path.endsWith('/main.js')){
   text=text.replace(/taught\|=\d+/g,'0').replace(/walked\+=speed\*Math.hypot\(x,z\)/g,'0').replace(/walked\+=speed/g,'0').replace(/kills\+\+|misses\+\+|frameCount\+\+/g,'0').replace(/frameTotal\+=\(ms-lastFrameReal\)\/1000\|\|\.016/g,'0');
  }
  if(soundIds)for(const [i,s]of sounds.entries()){
   if(path.endsWith('/main.js'))text=text.replaceAll("sound('"+s+"')",'sound('+i+')');
   if(path.endsWith('/audio.js'))text=text.replaceAll("kind==='"+s+"'",'kind==='+i);
  }
  return{contents:text,loader:'js'};
 });}}]});
 const options={ecma:2020,toplevel:true,compress:{passes:5,unsafe:true,unsafe_arrows:true,unsafe_methods:true},mangle:{properties:{regex:new RegExp('^('+properties+(fields?'|head|cone|eye|ring|ridge':'')+')$')}},format:{comments:false}};
 const {code}=await minify(result.outputFiles[0].text,options);
 const input='document.body.innerHTML='+JSON.stringify(ui)+';'+code;
 if(!fixed){const p=new Packer([{data:input,type:'js',action:'eval'}],{});const optimized=await p.optimize(2);fixed=optimized.best;await writeFile(root+'/parameters.json',JSON.stringify(fixed,null,2));}
 const p=new Packer([{data:input,type:'js',action:'eval'}],fixed),{firstLine,secondLine}=p.makeDecoder();
 const dir=resolve(root,name);await mkdir(dir,{recursive:true});
 const html=shell.replace(/<!-- GAME -->[\s\S]*?<!-- END GAME -->/,()=>`<script type="module">import * as T from 'https://play.js13kgames.com/2026/webxr/three.js';globalThis.T=T;${firstLine}\n${secondLine}</script>`);
 await writeFile(dir+'/index.html',html);await writeFile(dir+'/game.min.js',code);
 execFileSync('zip',['-X','-9','game.zip','index.html'],{cwd:dir,stdio:'pipe'});execFileSync('advzip',['-z','-4','-i','100','game.zip'],{cwd:dir,stdio:'pipe'});
 const bytes=(await readFile(dir+'/game.zip')).length;
 const row={name,bytes,minifiedJSBytes:Buffer.byteLength(code),gain:report.length?report[0].bytes-bytes:0};report.push(row);console.log(row);
 await writeFile(root+'/report.json',JSON.stringify(report,null,2));
}
