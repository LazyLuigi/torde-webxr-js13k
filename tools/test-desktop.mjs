import{chromium}from'playwright';
import assert from'node:assert/strict';
import{mkdir,writeFile}from'node:fs/promises';
const out='.dream-loop/desktop-reload';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.TEST_URL||'http://localhost:4174',{waitUntil:'networkidle'});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await page.bringToFront();
 await page.locator('#intro[data-ready="1"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);
 await page.evaluate(()=>{
  // Keep the comparison camera fixed even if the host mouse moves during capture.
  addEventListener('mousemove',e=>e.stopImmediatePropagation(),true);
  const a=torde;a.renderer.setAnimationLoop(null);const render=a.renderer.render.bind(a.renderer);a.renderer.render=()=>{};
  let time=performance.now();globalThis.tick=seconds=>{for(let i=0;i<Math.ceil(seconds*100);i++){time+=10;a.frame(time);}};
  globalThis.renderShot=()=>render(a.scene,a.camera);
  a.place(0,18);tick(16);a.place(0,23);a.clear();tick(.1);
 });
 assert(await page.evaluate(()=>torde.state().hasBow),'Sage has given bow');
 const rest=await page.evaluate(()=>({position:torde.camera.worldToLocal(torde.nocked.position.clone()).toArray(),quaternion:torde.nocked.quaternion.toArray()}));
 await page.mouse.down();await page.evaluate(()=>tick(.35));await page.mouse.up();
 const first=await page.evaluate(()=>torde.state().lastShot);assert(first>0,'Actual mouse release fires');
 const frames=[];let previous=0;
 for(const seconds of [.02,.18,.36,.5,.66]){
  await page.evaluate(dt=>{tick(dt);renderShot();},seconds-previous);previous=seconds;
  const pose=await page.evaluate(()=>({position:torde.camera.worldToLocal(torde.nocked.position.clone()).toArray(),quaternion:torde.nocked.quaternion.toArray(),drawing:torde.state().drawing}));frames.push({seconds,...pose});
  await page.screenshot({path:`${out}/reload-${Math.round(seconds*1000)}.png`});
  if(seconds<.65){
   await page.mouse.down();assert(await page.evaluate(()=>!torde.state().drawing&&torde.state().draw===0),'Click during reload cannot draw');await page.mouse.up();
   assert.equal(await page.evaluate(()=>torde.state().lastShot),first,'Click spam cannot fire');
  }
 }
 assert(Math.hypot(...frames[0].position.map((v,i)=>v-rest.position[i]))>.4,'Replacement visibly enters from outside rest pose');
 assert(Math.hypot(...frames.at(-1).position.map((v,i)=>v-rest.position[i]))<.00001,'Arrow settles precisely into its original seat');
 assert(Math.abs(frames.at(-1).quaternion.reduce((sum,v,i)=>sum+v*rest.quaternion[i],0))>.99999,'Rest orientation restored');
 await page.mouse.down();assert(await page.evaluate(()=>torde.state().drawing),'Fresh click after reload starts drawing');await page.evaluate(()=>tick(.2));await page.mouse.up();
 const second=await page.evaluate(()=>torde.state().lastShot);assert(second>first,'Next deliberate shot accepted');
 // Holding an ignored click must not queue an automatic draw when cooldown ends.
 await page.mouse.down();await page.evaluate(()=>tick(.8));assert(await page.evaluate(()=>!torde.state().drawing&&torde.state().draw===0),'Held early click does not queue a shot');await page.mouse.up();assert.equal(await page.evaluate(()=>torde.state().lastShot),second);
 await page.mouse.down();await page.evaluate(()=>tick(.2));await page.mouse.up();await page.evaluate(()=>tick(.1));
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>torde.state());assert(paused.paused,'Pause during reload');await page.evaluate(()=>tick(2));assert.equal(await page.evaluate(()=>torde.state().totalTime),paused.totalTime,'Reload clock freezes on pause');
 await page.locator('#intro[data-ready="1"]').click();await page.waitForFunction(()=>!!document.pointerLockElement);await page.mouse.down();assert(await page.evaluate(()=>!torde.state().drawing),'Pause cannot bypass reload');await page.mouse.up();await page.evaluate(()=>tick(.6));
 await page.mouse.down();await page.mouse.up();const aborted=await page.evaluate(()=>torde.state().lastShot);await page.mouse.down();assert(await page.evaluate(()=>torde.state().drawing),'Aborted zero-draw release does not start a reload');await page.mouse.up();assert.equal(await page.evaluate(()=>torde.state().lastShot),aborted);
 await page.evaluate(()=>{torde.start();torde.place(0,18);tick(16);});await page.mouse.down();assert(await page.evaluate(()=>torde.state().drawing),'Restart does not retain cooldown');await page.mouse.up();
 assert.equal(errors.length,0,errors.join('\n'));
 const report={duration:.65,mouseInput:true,spamBlocked:true,noQueuedDraw:true,pauseSafe:true,abortSafe:true,restartSafe:true,rest,frames,errors};
 await writeFile(`${out}/test-report.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
