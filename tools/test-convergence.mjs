import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.dream-loop/retake-convergence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.waitForFunction(()=>globalThis.torde);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await page.bringToFront();await page.locator('#intro[data-ready="1"]').click();
 const result=await page.evaluate(async()=>{
  const a=torde,{dialogue,drawGuide}=await import('/src/guide.js');a.renderer.setAnimationLoop(null);a.renderer.render=()=>{};let t=performance.now();
  const tick=s=>{for(let i=0;i<s*60;i++){t+=1000/60;a.frame(t);}};
  const check=(v,label)=>{if(!v)throw Error(label+' '+JSON.stringify(a.state()));};
  a.place(0,18);tick(.1);check(a.state().briefed&&!a.state().hasBow,'Sage dialogue before handoff');
  const click=()=>a.renderer.domElement.dispatchEvent(new MouseEvent('mousedown',{button:0}));
  let before=a.state().speech;click();check(a.state().speech===before,'Cannot skip while letters appear');
  const text=dialogue(7),duration=text.length/35;
  tick(duration+.2);before=a.state().speech;click();check(a.state().speech===before,'Full text held at least a second');
  tick(.9);click();check(a.state().speech===6,'Click advances first completed line after delay');
  tick(dialogue(.01).length/35+1.1);click();tick(.1);check(a.state().hasBow&&a.state().phase===1,'Sage gives bow directly');
  check(text==='The ancient unicorn needs you.\nFind where the rainbow ends.'&&dialogue(-1)==='Hmm... I lost my way.','English dialogue and thought');
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const c=canvas.getContext('2d',{willReadFrequently:true});
  const gold=(x,y)=>c.getImageData(x,y,1,1).data[0]>200;
  drawGuide(c,1000,-1,1,50,0,'play',0);check(gold(330,220)&&!gold(430,220)&&!gold(600,220),'One health bar shows actual remaining player health');
  drawGuide(c,1000,0,1,100,0,'play',1);check(!gold(330,220),'Tutorial hides health');drawGuide(c,1000,-1,1,100,10,'play',1);check(!gold(330,220),'Dialogue hides health');
  a.start();a.clear();a.camera.rotation.set(0,0,0);a.camera.updateMatrixWorld(true);a.pack(8);
  const eye=a.camera.getWorldPosition(new T.Vector3()),distances=a.wolves.map(w=>w.g.position.clone().sub(eye).setY(0).length());
  check(Math.min(...distances)>=14&&Math.max(...distances)<=20,'Outbound wolves appear 14–20 metres away');
  const xs=a.wolves.map(w=>w.g.position.x-eye.x);check(Math.min(...xs)<-3&&Math.max(...xs)>3,'Outbound pack dispersed in view');
  a.clear();const body=a.spawn(a.rig.position.x+10,a.rig.position.z);a.kill(body,false);tick(1);check(body.g.visible&&body.g.rotation.z>1.5&&body.shadow.material.color.getHex()===0x08090b,'Wolf falls with black blood');tick(8);check(a.wolves.includes(body)&&body.g.visible,'Body remains before ten seconds');tick(4);check(!a.wolves.includes(body),'Body removed after blinking');
  const locations=[];for(let i=0;i<8;i++){a.start();check(a.unicorn.position.z< -110&&a.world.rainbow.position.distanceTo(a.unicorn.position)<.001,'Distant unicorn and anchored rainbow');check(locations.at(-1)!==a.state().sanctuary,'New clearing each time');locations.push(a.state().sanctuary);}
  for(const band of a.world.rainbow.children){check(!band.material.fog&&band.material.depthTest&&!band.frustumCulled,'Rainbow respects occlusion without fog or culling');const c=band.geometry.attributes.color;check(c.getW(0)===0&&c.getW(28)>0&&c.getW(28)<1&&c.getW(48)===1,'Early rainbow fade preserved');}
  const texture=a.panel.material.map;check(!texture.generateMipmaps&&texture.minFilter===T.LinearFilter&&!a.panel.material.depthWrite,'UI texture avoids mipmaps and depth writes');
  return{englishDialogue:true,singleHealthBar:true,dialogueDelay:true,corpse:true,outboundDistances:distances,locations,rainbow:true};
 });
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(out+'/report.json',JSON.stringify({...result,errors},null,2));console.log({...result,errors});
}finally{await browser.close();}
