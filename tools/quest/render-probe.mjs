import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const mode=process.argv[2]||'baseline',seconds=Number(process.argv[3]||8);
if(!['baseline','flush','finish','foveation-off'].includes(mode)||seconds<1||seconds>40)throw Error('Usage: node tools/quest/render-probe.mjs baseline|flush|finish|foveation-off [seconds 1..40]');
const adb='/Users/bscrk/Library/Android/sdk/platform-tools/adb';
const run=(...a)=>execFileSync(adb,a,{encoding:'utf8'}).trim();
const port=run('forward','tcp:0','localabstract:chrome_devtools_remote');let ws;
try{
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const tab=tabs.find(t=>t.url==='file:///sdcard/Download/TORDE/index.html');if(!tab)throw Error('TORDE tab missing');
 const u=new URL(tab.webSocketDebuggerUrl);u.host=`127.0.0.1:${port}`;
 ws=new WebSocket(u);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no;});
 let seq=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
 const call=(method,params={})=>new Promise((yes,no)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);no(Error('CDP timeout'));},(seconds+10)*1000);
  pending.set(id,m=>{clearTimeout(timer);m.error?no(Error(JSON.stringify(m.error))):yes(m.result);});ws.send(JSON.stringify({id,method,params}));
 });
 const result=await call('Runtime.evaluate',{returnByValue:true,awaitPromise:true,expression:`new Promise(resolve=>{
  const mode=${JSON.stringify(mode)},frames=[],proto=XRSession.prototype,original=proto.requestAnimationFrame;
  const gl=document.querySelector('canvas').getContext('webgl2');
  let last=0,layer,initialFoveation,restoreDone=false;
  const info={mode,visibility:document.visibilityState,context:gl.getContextAttributes(),windowRAF:0};
  function windowTick(){if(!restoreDone){info.windowRAF++;requestAnimationFrame(windowTick);}}requestAnimationFrame(windowTick);
  proto.requestAnimationFrame=function(cb){return original.call(this,(t,f)=>{
   const start=performance.now();
   if(!layer){layer=f.session.renderState.layers?.[0]||f.session.renderState.baseLayer;initialFoveation=layer?.fixedFoveation;info.layer=layer?.constructor.name;info.initialFoveation=initialFoveation;info.targetRate=f.session.frameRate;}
   if(!restoreDone&&mode==='foveation-off'&&layer)layer.fixedFoveation=0;
   cb(t,f);const submitted=performance.now();
   if(!restoreDone&&mode==='flush')gl.flush();if(!restoreDone&&mode==='finish')gl.finish();
   if(!restoreDone){frames.push({interval:last?t-last:0,cpu:submitted-start,sync:performance.now()-submitted});last=t;}
  });};
  setTimeout(()=>{restoreDone=true;proto.requestAnimationFrame=original;if(layer&&mode==='foveation-off')layer.fixedFoveation=initialFoveation;resolve({...info,frames,restored:true});},${seconds*1000});
 })`});
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 const report=result.result.value,frames=report.frames.slice(1);
 report.summary={frames:frames.length};
 for(const k of ['interval','cpu','sync']){const values=frames.map(f=>f[k]).sort((a,b)=>a-b);report.summary[k]={mean:values.reduce((a,b)=>a+b,0)/values.length,p50:values[values.length>>1],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};}
 await mkdir('.dream-loop/eye-recording',{recursive:true});await writeFile('.dream-loop/eye-recording/probe-'+mode+'.json',JSON.stringify(report,null,2));console.log({...report,frames:undefined});
}finally{ws?.close();run('forward','--remove','tcp:'+port);}
