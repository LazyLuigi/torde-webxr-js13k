import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {engineFixture,engineURL} from '../engine-fixture.mjs';

// One offline HTML on the headset. No server, APK, reverse tunnel or contest changes.
const root=fileURLToPath(new URL('../../',import.meta.url));process.chdir(root);
const args=process.argv.slice(2),release=args.includes('--release'),riding=args.includes('--ride');
if(args.some(a=>!['--release','--vr','--ride'].includes(a)))throw Error('Usage: npm run quest:deploy -- [--release] [--vr] [--ride]');
if(typeof WebSocket==='undefined')throw Error('Node.js 24 requis pour le déploiement Quest.');
const local=resolve('.dream-loop/quest'),remote='/sdcard/Download/TORDE',url=`file://${remote}/index.html`;
const hash=b=>createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let adb=process.env.ADB;
if(!adb){for(const candidate of [join(homedir(),'Library/Android/sdk/platform-tools/adb'),join(homedir(),'Android/Sdk/platform-tools/adb')]){try{await access(candidate);adb=candidate;break;}catch{}}}
adb||='adb';
const run=(bin,argv,opts={})=>execFileSync(bin,argv,{cwd:root,encoding:'utf8',...opts});
const devices=run(adb,['devices']).split('\n').slice(1).map(s=>s.trim().split(/\s+/)).filter(a=>a[1]==='device').map(a=>a[0]);
const serial=process.env.ANDROID_SERIAL||(devices.length===1?devices[0]:null);
if(!serial||!devices.includes(serial))throw Error('Connecter et autoriser un Quest USB. Si plusieurs appareils : ANDROID_SERIAL=<numéro>.');
const command=(...argv)=>run(adb,['-s',serial,...argv]);
await mkdir(local,{recursive:true});
if(!release){console.log('Construction du jeu courant…');run(process.execPath,['tools/build.mjs','--vr-only',...(riding?['--ride']:[])],{stdio:'inherit'});}
const source=riding?(release?'.dream-loop/ride-release':'.dream-loop/ride-fast'):release?'dist':'.dream-loop/fast',original=await readFile(`${source}/index.html`,'utf8');
if(!original.includes(engineURL))throw Error('Import du moteur officiel absent : copie annulée.');
// Official CDN lacks CORS headers for file://. Embed its exact bytes as a module
// data URL in the test copy. The packed game and dist/index.html stay untouched.
const engine=await readFile(await engineFixture());
const html=original.replace(engineURL,'data:text/javascript;base64,'+engine.toString('base64'));
const revision=hash(html),file=join(local,'index.html');await writeFile(file,html);
command('shell','mkdir','-p',remote);
command('push',file,`${remote}/index.next.html`);
const copied=command('shell','sha256sum',`${remote}/index.next.html`).trim().split(/\s+/)[0];
if(copied!==revision)throw Error('Échec de vérification SHA-256 sur le casque.');
command('shell','mv','-f',`${remote}/index.next.html`,`${remote}/index.html`);
console.log(`Copie vérifiée : ${Buffer.byteLength(html)} octets, version ${revision.slice(0,12)}.`);
command('shell','input','keyevent','KEYCODE_WAKEUP');
command('shell','am','start','-a','android.intent.action.VIEW','-d',url,'-t','text/html','-p','com.oculus.browser');
let port,ws;const errors=[];
async function connect(endpoint){
 const socket=new WebSocket(endpoint);await new Promise((yes,no)=>{socket.onopen=yes;socket.onerror=no;});
 let id=0;const pending=new Map();
 socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text+': '+(d.params.exceptionDetails.exception?.description||''));if(d.method==='Log.entryAdded'&&d.params.entry.level==='error')errors.push(d.params.entry.text);if(d.id){pending.get(d.id)?.(d);pending.delete(d.id);}};
 const call=(method,params={})=>new Promise((yes,no)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);no(Error('CDP timeout: '+method));},15000);pending.set(key,d=>{clearTimeout(timer);d.error?no(Error(d.error.message)):yes(d.result);});socket.send(JSON.stringify({id:key,method,params}));});
 return {socket,call};
}
try{
 // Debugging forward only; it is removed before returning and never serves the game.
 port=command('forward','tcp:0','localabstract:chrome_devtools_remote').trim();
 const endpoint=`http://127.0.0.1:${port}`;
 let tab;
 for(let i=0;i<20;i++){try{tab=(await(await fetch(`${endpoint}/json/list`)).json()).find(t=>t.type==='page'&&t.url===url);}catch{}if(tab)break;await wait(250);}
 if(!tab){
  const version=await(await fetch(`${endpoint}/json/version`)).json();
  const address=new URL(version.webSocketDebuggerUrl);address.host=`127.0.0.1:${port}`;
  const browser=await connect(address.href);
  try{await browser.call('Target.createTarget',{url});}finally{browser.socket.close();}
  for(let i=0;i<20;i++){tab=(await(await fetch(`${endpoint}/json/list`)).json()).find(t=>t.type==='page'&&t.url===url);if(tab)break;await wait(250);}
 }
 if(!tab)throw Error(`Copie installée. Ouvrir ${url} dans le navigateur Quest.`);
 const address=new URL(tab.webSocketDebuggerUrl);address.host=`127.0.0.1:${port}`;
 const session=await connect(address.href);ws=session.socket;const call=session.call;
 await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
 await call('Page.bringToFront');errors.length=0;await call('Page.reload',{ignoreCache:true});
 let status;
 for(let i=0;i<80;i++){
  await wait(250);
  const result=await call('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,secure:isSecureContext,focused:document.hasFocus(),ready:document.getElementById('intro')?.dataset.ready==='1'&&document.querySelectorAll('canvas').length>1})`,returnByValue:true});
  try{status=JSON.parse(result.result.value);}catch{}
  if(status?.ready)break;
 }
 if(!status?.ready||!status.secure||errors.length)throw Error('Jeu non prêt : '+JSON.stringify({status,errors}));
 const resources=await call('Runtime.evaluate',{expression:`JSON.stringify(performance.getEntriesByType('resource').map(r=>r.name).filter(s=>!s.startsWith('data:')))`,returnByValue:true});
 const urls=JSON.parse(resources.result.value);
 if(urls.some(s=>!s.startsWith('file:')))throw Error('Ressource non locale : '+JSON.stringify(urls));
 if(args.includes('--vr')){
  await call('Runtime.evaluate',{expression:`window.questXRResult={pending:true};const request=navigator.xr.requestSession.bind(navigator.xr);navigator.xr.requestSession=async(...args)=>{try{const s=await request(...args);window.questXRResult={active:true};return s;}catch(e){window.questXRResult={error:e.name+': '+e.message};throw e;}};document.getElementById('intro').click()`,userGesture:true});
  await wait(1200);
  const result=await call('Runtime.evaluate',{expression:`JSON.stringify(window.questXRResult)`,returnByValue:true});
  status.xr=JSON.parse(result.result.value);
  if(!status.xr.active)console.log('Entrée VR : '+JSON.stringify(status.xr)+' — accepter la demande dans le casque si elle apparaît.');
 }
 const report={createdAt:new Date().toISOString(),serial,url,source,revision,bytes:Buffer.byteLength(html),engineSHA256:hash(engine),originalHTMLSHA256:hash(original),status,externalResources:urls,errors};
 await writeFile(join(local,'deploy-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({url,source,revision:revision.slice(0,12),status,errors},null,2));
}finally{ws?.close();if(port)command('forward','--remove',`tcp:${port}`);}
console.log('Le HTML reste dans Download/TORDE après déconnexion et redémarrage. Pour rejouer, rouvrir la même adresse dans le navigateur Quest.');
