import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';
const out='.dream-loop/map-retake';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.bringToFront();await page.locator('#intro[data-ready="1"]').click();
 await page.evaluate(()=>{
  addEventListener('mousemove',e=>e.stopImmediatePropagation(),true);
  const a=torde,render=a.renderer.render.bind(a.renderer);a.renderer.setAnimationLoop(null);a.renderer.render=()=>{};
  let t=performance.now();window.tick=seconds=>{for(let i=0;i<seconds*60;i++){t+=1000/60;a.frame(t);}};
  window.snap=()=>render(a.scene,a.camera);tick(.7);snap();
 });
 assert(await page.evaluate(()=>torde.state().tutorial===-1&&torde.state().panelOpen<.01),'No VR tutorial on desktop');
 await page.screenshot({path:`${out}/village-front.png`});
 const report=await page.evaluate(()=>{
  const a=torde,check=(x,label)=>{if(!x)throw Error(label+' '+JSON.stringify(a.state()));},path=z=>Math.sin(z*.075)*1.8+1.15*Math.exp(-(((z+42)/5)**2));
  const bounds=new T.Box3().setFromObject(a.world.scenery);check(bounds.min.x< -79&&bounds.max.x>79&&bounds.max.z>84&&bounds.min.z< -249,'Terrain extends behind village and on sides');
  const huts=a.world.obstacles.filter(o=>o[2]===2);check(huts.length===6,'Six collidable houses');
  a.place(40,28);tick(.5);check(!a.state().hasBow&&!a.state().briefed&&a.state().thought>0,'Getting lost before sage never grants bow');check(Math.abs(a.rig.position.x-path(28))<.001,'Pre-quest recovery onto path');
  a.start();a.place(0,18);tick(16);a.set({phase:1,encounters:3});a.clear();
  const recoveries=[];
  for(const [x,z]of [[40,-40],[-40,-145],[0,56],[0,-209]]){
   const health=a.state().health;a.place(x,z);tick(.02);const s=a.state();const targetZ=Math.max(-195,Math.min(42,z));
   check(Math.abs(s.position[0]-path(targetZ))<.001&&Math.abs(s.position[2]-targetZ)<.001,'Recover onto nearest safe trail segment');check(s.thought>3&&s.health===health,'Thought shown without damage');
   recoveries.push({from:[x,z],to:s.position});
  }
  for(const [x,z]of a.clearings){a.set({phase:1});a.unicorn.position.set(x,0,z);a.place(x,z+2);tick(.02);check(Math.abs(a.rig.position.x-x)<.001&&Math.abs(a.rig.position.z-z-2)<.001,'All unicorn clearings remain explorable');}
  a.set({phase:1,encounters:3,health:91});a.clear();a.place(40,-150);tick(.02);check(a.state().health===91&&a.state().phase===1,'Recovery preserves quest and health');
  tick(.8);check(a.state().panelOpen>.98,'Thought opens organic popup');snap();
  return {bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},huts,recoveries,escort:a.state()};
 });
 const phrase=await page.evaluate(async()=>{const{dialogue}=await import('/src/guide.js');return dialogue(-torde.state().thought);});assert.equal(phrase,"Hmm... I lost my way.");
 await page.waitForTimeout(200); // Let the real-time teleport fade clear.
 await page.screenshot({path:`${out}/lost-thought.png`});
 const fog=await page.evaluate(()=>{const a=torde;a.set({phase:1,encounters:3});tick(5);if(a.state().panelOpen>.01)throw Error('Thought failed to close');a.place(0,-100);tick(.02);const center=a.scene.fog.density;a.place(33,-100);tick(.02);const edge=a.scene.fog.density;a.camera.rotation.set(0,-Math.PI/2,0);snap();return{center,edge};});assert(fog.edge>fog.center*1.8,'Mist thickens near edges');await page.screenshot({path:`${out}/edge-mist.png`});
 await page.evaluate(()=>{torde.start();tick(.7);torde.camera.rotation.set(0,Math.PI,0);snap();});await page.screenshot({path:`${out}/village-behind.png`});
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(`${out}/report.json`,JSON.stringify({...report,fog,phrase,errors},null,2));console.log({huts:report.huts.length,recoveries:report.recoveries,fog,phrase,errors});
}finally{await browser.close();}
