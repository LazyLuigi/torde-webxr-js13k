import {chromium} from 'playwright';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {engineFixture,engineURL} from './engine-fixture.mjs';

const out='.dream-loop/arrow-collisions/packed',buildDir=process.env.BUILD_DIR||'dist';await mkdir(out,{recursive:true});
const zip=await readFile(buildDir+'/torde.zip');
if(!process.argv.includes('--allow-oversize'))assert(zip.length<=13312,'Contest ZIP budget');
const html=execFileSync('unzip',['-p',buildDir+'/torde.zip','index.html'],{encoding:'utf8'});
assert.equal(html,await readFile(buildDir+'/index.html','utf8'));await writeFile(out+'/index.html',html);
const runtime=(await build({stdin:{contents:"import{XRDevice,metaQuest3}from'iwer';const d=new XRDevice(metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true});d.position.set(0,1.7,0);",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const engine=await engineFixture();
 await page.route(engineURL,r=>r.fulfill({path:engine,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.addInitScript({content:runtime});
 // Observe public Three.js objects; the extracted release is never instrumented or rewritten.
 await page.addInitScript(()=>{
  let library;globalThis.raySweeps=0;
  Object.defineProperty(globalThis,'T',{get:()=>library,set:value=>{
   library={...value,Scene:class extends value.Scene{
    add(...objects){super.add(...objects);for(const g of objects)if(g.isGroup&&g.children[0]?.geometry?.parameters?.radiusTop===.005)globalThis.latestArrow=g;return this;}
   },Raycaster:class extends value.Raycaster{
    intersectObjects(...args){raySweeps++;return super.intersectObjects(...args);}
   },WebGLRenderer:class extends value.WebGLRenderer{
    constructor(...args){super(...args);globalThis.observedRenderer=this;
     const render=this.render.bind(this),animate=this.setAnimationLoop.bind(this);
     this.render=(scene,camera)=>{globalThis.observedScene=scene;globalThis.observedCamera=camera;render(scene,camera);};
     this.setAnimationLoop=fn=>{if(fn)globalThis.observedFrame=fn;animate(fn);};
    }
   }};
  }});
 });
 await page.goto((process.env.TEST_URL||'http://localhost:4174')+'/'+out+'/index.html');
 await page.locator('#intro[data-ready="1"]').click();await page.waitForFunction(()=>observedRenderer.xr.isPresenting);
 await page.waitForTimeout(150);
 const result=await page.evaluate(async()=>{
  const {height}=await import('/src/world.js'),renderer=observedRenderer,scene=observedScene,rig=observedCamera.parent;
  renderer.setAnimationLoop(null);renderer.render=()=>{};let ms=performance.now();const checks=[];
  const tick=(dt=.04)=>{ms+=dt*1000;observedFrame(ms);};
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  rig.position.set(0,0,18);for(let i=0;i<410;i++)tick();
  check(latestArrow.visible,'Bow gift completed before shooting');
  const grips=[renderer.xr.getControllerGrip(0),renderer.xr.getControllerGrip(1)];
  const rightIndex=grips.findIndex(g=>Object.values(g.userData).includes('right'));
  check(rightIndex>=0,'Real XR controllers connected');
  const left=grips[1-rightIndex],right=grips[rightIndex],controller=renderer.xr.getController(rightIndex);
  const v=(x,y,z)=>new T.Vector3(x,y,z);
  const fire=(origin,direction)=>{
   for(let i=0;i<10;i++)tick();rig.position.set(0,0,0);rig.rotation.y=0;
   left.position.copy(origin);right.position.copy(origin).addScaledVector(direction,-.12);left.updateMatrix();right.updateMatrix();scene.updateMatrixWorld(true);
   controller.dispatchEvent({type:'selectstart'});tick();
   right.position.copy(origin).addScaledVector(direction,-.75);right.updateMatrix();scene.updateMatrixWorld(true);tick();
   const previous=latestArrow;controller.dispatchEvent({type:'selectend'});
   check(latestArrow!==previous&&latestArrow?.parent===scene,'Two-handed release creates a packed arrow');
   return latestArrow;
  };
  const stays=(arrow,label)=>{const position=arrow.position.clone(),rotation=arrow.quaternion.clone(),sweeps=raySweeps;for(let i=0;i<126;i++)tick();check(arrow.parent===scene&&arrow.position.equals(position)&&arrow.quaternion.equals(rotation),label);check(raySweeps===sweeps,'Embedded packed arrows skip further collision checks');};
  let arrow=fire(v(-6.9,height(-6,-44)+1,-44),v(1,0,0));tick();
  check(arrow.parent===scene&&arrow.position.x<-6.8,'Packed arrow embeds its tip in the near trunk face');
  stays(arrow,'Packed arrow remains embedded in the trunk for more than five seconds');
  arrow=fire(v(-6,height(-6,16)+1,13.7),v(0,0,1));tick();
  check(arrow.parent===scene&&arrow.position.z<13.9,'Packed arrow embeds in the house wall');
  stays(arrow,'Packed arrow remains embedded in the wall');
  arrow=fire(v(-6,height(-6,16)+3.4,14.8),v(0,0,1));tick();
  check(arrow.parent===scene&&arrow.position.z<16,'Packed arrow embeds in the sloping roof');
  stays(arrow,'Packed arrow remains embedded in the roof');
  arrow=fire(v(0,height(0,5)+.9,5),v(0,-1,0));tick();
  check(arrow.parent===scene&&arrow.position.y>height(0,5)+.25,'Packed arrow embeds in the ground with its shaft above the surface');
  stays(arrow,'Packed arrow remains embedded in the ground');
  arrow=fire(v(-6.4,height(-6,-44)+14,-44),v(1,0,0));tick();
  check(arrow.parent===scene,'Packed arrow passes through needles above the trunk');
  check(raySweeps>=5,'The packed update uses swept scenery collision checks');
  return{checks,raySweeps};
 });
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({bytes:zip.length,...result,errors},null,2));console.log(result);
}finally{await browser.close();}
