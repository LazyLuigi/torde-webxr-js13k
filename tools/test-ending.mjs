import {build} from 'esbuild';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.dream-loop/ending-check';await mkdir(out,{recursive:true});
const runtime=(await build({stdin:{contents:"import{XRDevice,metaQuest3}from'iwer';const d=new XRDevice(metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true});d.position.set(.8,1.7,.6);globalThis.device=d;",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']}),report=[];
try{for(const xr of [false,true]){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(xr)await page.addInitScript({content:runtime});
 await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.locator('#intro[data-ready="1"]').click();
 if(xr)await page.waitForFunction(()=>torde.renderer.xr.isPresenting);
 await page.keyboard.press('Digit3');await page.waitForTimeout(100);
 const farewell=await page.evaluate(async()=>{
  const a=torde,{dialogue}=await import('/src/guide.js');a.renderer.setAnimationLoop(null);const render=a.renderer.render.bind(a.renderer);a.renderer.render=()=>{};
  let ms=performance.now();window.tick=s=>{for(let i=0;i<Math.ceil(s*60);i++){ms+=1000/60;a.frame(ms);}};window.snap=()=>render(a.scene,a.camera);
  window.check=(ok,label)=>{if(!ok)throw Error(label+' '+JSON.stringify(a.state()));};
  tick(3.5);check(a.state().phase===3,'Mounted');a.clear();a.unicorn.position.z=16.99;tick(1/60);
  check(a.state().phase===4&&!a.state().hasBow&&!a.nocked.visible,'Arrival starts dismount and stows the bow');
  const initialY=a.rig.position.y,headPose=a.camera.quaternion.clone();tick(.7);check(a.rig.position.y<initialY-.3&&a.unicorn.position.z>18,'Rider descends as unicorn walks on');
  tick(3);check(a.state().phase===5,'Turning finishes before farewell');
  check(dialogue(a.state().speech)==="Thank you for bringing her back.",'Exact requested farewell');
  const eye=a.camera.getWorldPosition(new T.Vector3()),toward=a.world.shaman.position.clone().sub(eye).setY(0).normalize(),facing=a.camera.getWorldDirection(new T.Vector3()).setY(0).normalize();
  check(Math.hypot(eye.x-2.4,eye.z-18)<.001&&a.state().rideLift===0,'Player stands beside elder independently of unicorn');
  check(facing.dot(toward)>.999,'World view turns toward elder');check(1-Math.abs(headPose.dot(a.camera.quaternion))<.000001,'Tracked head rotation is never overwritten');
  const standing=a.rig.position.clone();a.keys.KeyW=true;a.teleport(20,0);tick(.2);a.keys.KeyW=false;check(a.rig.position.distanceTo(standing)<.001,'Movement cannot interrupt the ending');
  snap();return{standing:eye.toArray(),facing:facing.dot(toward),farewell:true,headTrackingPreserved:true};
 });
 await page.screenshot({path:out+'/'+(xr?'xr':'desktop')+'-farewell.png'});
 const fade=await page.evaluate(()=>{
  const a=torde,before=a.state().elapsed,z=a.unicorn.position.z;dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));tick(2);check(a.state().elapsed===before&&a.unicorn.position.z===z,'Pause freezes the whole ending');dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));
  tick(7.3-a.state().elapsed);const border=a.camera.children.find(o=>o.material?.uniforms?.fade);check(border.visible&&border.material.uniforms.fade.value>.3&&border.material.uniforms.fade.value<.6,'Full-screen fade progresses before Game Over');snap();return{fade:border.material.uniforms.fade.value};
 });
 await page.screenshot({path:out+'/'+(xr?'xr':'desktop')+'-fade.png'});
 const ended=await page.evaluate(()=>{
  const a=torde;tick(2);check(a.state().mode==='win'&&a.state().phase===6,'Rescue ends successfully');
  check(a.unicorn.position.z===42,'Unicorn reaches the back of the village');check(a.camera.layers.mask===8&&a.renderer.getClearColor(new T.Color()).getHex()===0,'Game Over appears on black');
  check(document.getElementById('intro').style.display==='none'&&document.getElementById('mute').hidden,'No title or victory overlay');snap();return{unicornZ:a.unicorn.position.z,gameOver:true};
 });
 await page.screenshot({path:out+'/'+(xr?'xr':'desktop')+'-game-over.png'});
 await page.evaluate(()=>{torde.start();tick(1/60);check(torde.state().phase===0&&torde.world.shaman.rotation.y===0&&torde.camera.layers.mask===1,'Restart restores the original village');});
 assert.deepEqual(errors,[]);report.push({xr,...farewell,...fade,...ended,errors});await page.close();
}console.log(report);await writeFile(out+'/report.json',JSON.stringify(report,null,2));}finally{await browser.close();}
