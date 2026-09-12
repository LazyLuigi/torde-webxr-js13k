import {build} from 'esbuild';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.dream-loop/ride-check';await mkdir(out,{recursive:true});
const runtime=(await build({stdin:{contents:"import{XRDevice,metaQuest3}from'iwer';const d=new XRDevice(metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true});d.position.set(.8,1.7,.6);d.controllers.left.position.set(-.25,1.35,-.5);d.controllers.right.position.set(.25,1.35,-.25);globalThis.device=d;",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript({content:runtime});await page.goto((process.env.TEST_URL||'http://localhost:4174')+'/?ride');await page.locator('#intro[data-ready="1"]').click();await page.waitForTimeout(500);
 await page.keyboard.press('Digit3');await page.waitForTimeout(150);
 await page.waitForFunction(()=>torde.state().phase===3);await page.waitForTimeout(2000);
 const mounted=await page.evaluate(()=>{
  const a=torde,head=a.camera.getWorldPosition(new T.Vector3());
  return{head:head.toArray(),horse:a.unicorn.position.toArray(),facing:a.camera.getWorldDirection(new T.Vector3()).z,lift:a.state().rideLift};
 });assert.equal(mounted.lift,1.75);assert(mounted.facing>.99,'Mount faces village');assert(Math.hypot(mounted.head[0]-mounted.horse[0],mounted.head[2]-mounted.horse[2])<.05,'Room offset recentred over saddle');
 await page.evaluate(()=>device.position.x+=.2);await page.waitForTimeout(100);
 assert(await page.evaluate(()=>Math.abs(torde.camera.getWorldPosition(new T.Vector3()).x-torde.unicorn.position.x)>.15),'Real head lean remains possible');
 await page.evaluate(()=>{device.position.x-=.2;device.controllers.right.position.set(-.25,1.35,-.38);device.controllers.right.updateButtonValue('trigger',1);});await page.waitForTimeout(200);
 assert(await page.evaluate(()=>torde.state().drawing),'Can nock while riding');
 await page.evaluate(()=>device.controllers.right.position.z=.25);await page.waitForTimeout(250);
 assert(await page.evaluate(()=>torde.state().draw>.7),'Can draw while riding');
 await page.evaluate(()=>device.controllers.right.updateButtonValue('trigger',0));await page.waitForTimeout(100);
 assert(await page.evaluate(()=>torde.state().lastShot>0),'Can release arrow while riding');
 await page.evaluate(()=>device.controllers.left.updateAxes('thumbstick',1,-1));await page.waitForTimeout(300);await page.evaluate(()=>device.controllers.left.updateAxes('thumbstick',0,0));
 assert(await page.evaluate(()=>torde.rig.position.clone().add(torde.camera.position.clone().setY(0).applyQuaternion(torde.rig.quaternion)).setY(0).distanceTo(torde.unicorn.position.clone().setY(0))<.05),'Stick cannot detach rider');
 await page.screenshot({path:out+'/xr-mounted.png'});
 // Rapid changes of tracked yaw/pitch: inspect each eye's actual render camera.
 const stereo=await page.evaluate(async()=>{
  const a=torde,errors=[];let views=0;
  a.panel.onBeforeRender=(r,s,c)=>{
   const expected=new T.Quaternion(device.quaternion.x,device.quaternion.y,device.quaternion.z,device.quaternion.w).premultiply(a.rig.quaternion);
   errors.push({error:1-Math.abs(expected.dot(new T.Quaternion().setFromRotationMatrix(c.matrixWorld))),array:!!c.isArrayCamera,expected:expected.toArray(),actual:new T.Quaternion().setFromRotationMatrix(c.matrixWorld).toArray()});views++;
  };
  for(let i=0;i<40;i++){
   const q=new T.Quaternion().setFromEuler(new T.Euler(Math.sin(i)*.35,Math.sin(i*1.7)*1.2,0,'YXZ'));
   device.quaternion.set(q.x,q.y,q.z,q.w);a.set({health:100});await new Promise(r=>setTimeout(r,25));
  }
  a.panel.onBeforeRender=()=>{};return{eyeRenders:views,maxQuaternionError:Math.max(...errors.map(e=>e.error)),worst:errors.sort((a,b)=>b.error-a.error).slice(0,2)};
 });
 assert(stereo.eyeRenders>=40&&stereo.maxQuaternionError<.00001,'Both eye render poses track rapid head rotation in emulator');
 await page.evaluate(()=>{
  const a=torde;a.clear();a.set({health:100});
  const front=new T.Vector3(0,0,-1).applyQuaternion(a.unicorn.quaternion),w=a.spawn(a.unicorn.position.x+front.x,a.unicorn.position.z+front.z);w.attack=0;w.charging=true;
  const border=a.camera.children.find(o=>o.material?.uniforms?.strength);globalThis.damageEyes=new Set();border.onBeforeRender=(r,s,c)=>damageEyes.add(c);
 });
 await page.waitForFunction(()=>torde.state().health===85);await page.waitForTimeout(50);
 assert(await page.evaluate(()=>damageEyes.size===2),'Damage border renders in both XR eyes');
 await page.screenshot({path:out+'/xr-damage.png'});
 await page.waitForTimeout(500);
 assert(await page.evaluate(()=>!torde.camera.children.find(o=>o.material?.uniforms?.strength).visible),'XR damage border fades away');
 await page.evaluate(()=>{const a=torde;a.clear();a.set({health:10});const front=new T.Vector3(0,0,-1).applyQuaternion(a.unicorn.quaternion);const w=a.spawn(a.unicorn.position.x+front.x,a.unicorn.position.z+front.z);w.attack=0;w.charging=true;});await page.waitForFunction(()=>torde.state().mode==='lose');
 await page.evaluate(()=>device.controllers.right.updateButtonValue('trigger',1));await page.waitForTimeout(100);await page.evaluate(()=>device.controllers.right.updateButtonValue('trigger',0));
 assert(await page.evaluate(()=>torde.state().mode==='lose'),'Final shooting trigger does not immediately restart after death');
 const death=await page.evaluate(()=>{const a=torde;return{eyes:a.renderer.xr.getCamera().cameras.map(c=>c.layers.mask),panel:a.panel.layers.mask,clear:a.renderer.getClearColor(new T.Color()).getHex(),mode:a.state().mode};});
 assert(death.eyes.every(mask=>(mask&8)&&!(mask&1))&&(death.panel&8)&&death.clear===0,'Both eyes show death panel and black background only');
 await page.screenshot({path:out+'/xr-game-over.png'});
 await page.waitForTimeout(2200);await page.evaluate(()=>device.controllers.right.updateButtonValue('trigger',1));await page.waitForTimeout(100);await page.evaluate(()=>device.controllers.right.updateButtonValue('trigger',0));
 assert(await page.evaluate(()=>torde.state().phase===0&&torde.state().health===100&&torde.camera.layers.mask===1),'Deliberate later trigger restarts and restores world');
 assert.equal(errors.length,0,errors.join('\n'));
 const report={emulatedDevice:'IWER Meta Quest 3, not physical headset',automaticMount:true,mounted,headLean:true,mountedBow:true,stereo,death,restart:true,errors};
 await writeFile(out+'/xr-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
