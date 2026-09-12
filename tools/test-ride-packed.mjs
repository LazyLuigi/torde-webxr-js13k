import {chromium,firefox} from 'playwright';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {engineFixture,engineURL} from './engine-fixture.mjs';
import assert from 'node:assert/strict';
const out=process.env.TEST_OUTPUT_DIR||'.dream-loop/ride-check',buildDir=process.env.BUILD_DIR||'dist';await mkdir(out,{recursive:true});
const runtime=(await build({stdin:{contents:"import{XRDevice,metaQuest3}from'iwer';const d=new XRDevice(metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true});d.position.set(0,1.7,0);globalThis.device=d;",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const zip=await readFile(buildDir+'/torde.zip');
if(!process.argv.includes('--allow-oversize'))assert(zip.length<=13312,'Contest ZIP budget');
assert.equal(execFileSync('unzip',['-Z1',buildDir+'/torde.zip'],{encoding:'utf8'}).trim(),'index.html');
const html=execFileSync('unzip',['-p',buildDir+'/torde.zip','index.html'],{encoding:'utf8'});
assert.equal(html,await readFile(buildDir+'/index.html','utf8'));
await writeFile(out+'/extracted.html',html);
const report=[],base=process.env.TEST_URL||'http://localhost:4174',engine=await engineFixture();
for(const [name,type] of Object.entries({chromium,firefox})){
 const browser=await type.launch(name==='chromium'?{headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']}:{headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(name==='chromium')await page.addInitScript({content:runtime});
  await page.route(engineURL,r=>r.fulfill({path:engine,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
  // Observe the renderer without modifying or rebuilding the extracted game code.
  await page.addInitScript(()=>{
   globalThis.drawnTexts=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){drawnTexts.push(text);return fill.call(this,text,...args);};
   let library;
   Object.defineProperty(globalThis,'T',{get:()=>library,set:value=>{
    library={...value,WebGLRenderer:class extends value.WebGLRenderer{
     constructor(...args){super(...args);globalThis.observedRenderer=this;
      const render=this.render.bind(this),animate=this.setAnimationLoop.bind(this);
      this.render=(scene,camera)=>{globalThis.observedScene=scene;globalThis.observedCamera=camera;render(scene,camera);};
      this.setAnimationLoop=fn=>{if(fn)globalThis.observedFrame=fn;animate(fn);};
     }
    }};
   }});
  });
  await page.goto(base+'/'+out+'/extracted.html');await page.waitForFunction(()=>globalThis.observedScene);assert(await page.evaluate(()=>observedRenderer.xr.enabled===true),'Packed API boolean remains true');
  assert(await page.evaluate(()=>!document.getElementById('play')&&!document.getElementById('vr')&&!document.getElementById('aim')&&!document.getElementById('charge')),'Packed build contains no desktop controls');
  await page.screenshot({path:out+'/'+name+'-packed-title.png'});
  if(name==='firefox'){await page.locator('#intro').click();assert(await page.evaluate(()=>!document.body.classList.contains('playing')&&document.getElementById('launch').textContent==='VR headset required'),'Release never falls back to desktop play');assert.equal(errors.length,0,errors.join('\n'));report.push({browser:name,bytes:zip.length,budgetPassed:zip.length<=13312,desktopStripped:true,errors});continue;}
  await page.locator('#intro[data-ready="1"]').click();await page.waitForFunction(()=>observedRenderer.xr.isPresenting);
  const journey=await page.evaluate(()=>{
   const renderer=observedRenderer,scene=observedScene,camera=observedCamera,rig=camera.parent;
   renderer.setAnimationLoop(null);const render=renderer.render.bind(renderer);renderer.render=()=>{};
   let time=performance.now();
   const horse=scene.children.find(g=>g.isGroup&&g.scale.x===1.45);
   const wolves=()=>scene.children.filter(g=>g.isGroup&&g!==horse&&g!==rig&&g.children.length===1&&g.children[0].isGroup);
   const tick=(seconds,protect=true)=>{for(let i=0;i<seconds*60;i++){
    if(protect)for(const w of wolves())w.position.x=200;
    time+=1000/60;observedFrame(time);
   }};
   const check=(ok,label)=>{if(!ok)throw Error(label);};
   rig.position.set(0,0,18);tick(16);
   rig.position.copy(horse.position);rig.position.z+=2;
   tick(3.3);
   check(Math.abs(rig.position.y-horse.position.y-1.75)<.001,'Packed game mounts by proximity alone '+JSON.stringify({rig:rig.position.toArray(),horse:horse.position.toArray(),playing:document.body.classList.contains('playing')}));
   const head=camera.getWorldPosition(new T.Vector3());check(Math.hypot(head.x-horse.position.x,head.z-horse.position.z)<.05,'Packed saddle follows the tracked head');
   // Clearing exits curve sideways: speed is measured along the ground, not Z alone.
   const start=horse.position.clone();tick(2);
   const distance=Math.hypot(horse.position.x-start.x,horse.position.z-start.z);
   check(horse.position.z>start.z+1&&distance>4&&distance<5,'Packed ride walks automatically: '+JSON.stringify({start:start.toArray(),end:horse.position.toArray(),distance}));
   tick(20);const horde=wolves().slice();check(horde.length>=1,'Packed return ambushes appear during the walk');
   // Run the remaining journey; no cheats, private game hooks or source build.
   tick(100);
   check(Math.abs(horse.position.z-42)<.001,'Packed unicorn reaches the back of the village');
   check(!document.body.classList.contains('playing'),'Packed journey reaches end screen');
   check(drawnTexts.includes("Thank you for bringing her back.")&&drawnTexts.includes('Game over'),'Packed farewell and Game Over are both drawn');
   const standing=camera.getWorldPosition(new T.Vector3());check(Math.hypot(standing.x-2.4,standing.z-18)<.01&&camera.layers.mask===8,'Packed player remains on foot by the elder on the final black screen');
   render(scene,camera);
   globalThis.packedTest={renderer,scene,camera,rig,horse,wolves,tick,check,render};return{mounted:true,arrival:horse.position.toArray(),ended:true};
  });
  await page.screenshot({path:out+'/'+name+'-packed-arrival.png'});
  // Start a second actual packed game with a VR trigger and let one wolf bite.
  await page.evaluate(async()=>{device.controllers.right.updateButtonValue('trigger',1);await new Promise(r=>setTimeout(r,80));device.controllers.right.updateButtonValue('trigger',0);});
  await page.waitForTimeout(120);
  const defeat=await page.evaluate(()=>{
   const {renderer,scene,camera,rig,horse,wolves,tick,check,render}=packedTest;
   rig.position.set(0,0,18);tick(16);rig.position.copy(horse.position);rig.position.z+=2;tick(23);
   const attacker=wolves()[0];
   for(let i=0;i<12000&&document.body.classList.contains('playing');i++){
    horse.position.z=-50;for(const w of wolves())if(w!==attacker)w.position.x=200;tick(1/60,false);
   }
   check(!document.body.classList.contains('playing')&&camera.layers.mask===8,'Packed rider death selects only end-screen layer');
   check(renderer.getClearColor(new T.Color()).getHex()===0,'Packed death background is black');
   check(document.getElementById('intro').style.display==='none','Packed death hides title/menu');
   tick(.2,false);render(scene,camera);return{blackGameOver:true,riderDeath:true};
  });
  await page.screenshot({path:out+'/'+name+'-packed-game-over.png'});
  assert.equal(errors.length,0,errors.join('\n'));report.push({browser:name,bytes:zip.length,budgetPassed:zip.length<=13312,...journey,...defeat,errors});console.log(report.at(-1));
 }finally{await browser.close();}
}
await writeFile(out+'/packed-report.json',JSON.stringify(report,null,2));
