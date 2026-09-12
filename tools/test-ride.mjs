import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.dream-loop/ride-check';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.waitForFunction(()=>globalThis.torde);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await page.bringToFront();await page.locator('#intro[data-ready="1"]').click();await page.waitForFunction(()=>document.pointerLockElement);
 const result=await page.evaluate(async()=>{
  const a=torde,{rideX}=await import('/src/world.js');
  a.renderer.setAnimationLoop(null);const render=a.renderer.render.bind(a.renderer);a.renderer.render=()=>{};
  let time=performance.now();window.tick=(seconds,protect=false)=>{for(let i=0;i<seconds*60;i++){if(protect)a.set({health:100});time+=1000/60;a.frame(time);}};
  window.snap=()=>render(a.scene,a.camera);
  const check=(v,label)=>{if(!v)throw Error(label+' '+JSON.stringify(a.state()));};window.check=check;
  let clearance=Infinity;
  for(const site of a.clearings)for(let z=site[1];z<=17;z+=.25)for(const o of a.world.obstacles)clearance=Math.min(clearance,Math.hypot(rideX(z,site)-o[0],z-o[1])-o[2]);
  check(clearance>.7,'All four return routes clear');
  a.place(0,18);tick(16);a.clear();a.set({encounters:3});
  a.place(a.unicorn.position.x,a.unicorn.position.z+5);tick(.3);check(a.state().phase===1&&a.state().prone===1,'Unicorn still rests at a distance');
  a.place(a.unicorn.position.x,a.unicorn.position.z+2.7);tick(.1);
  check(a.state().phase===2&&a.state().prone<1,'Approach starts rising without any button');
  check(a.wolves.length===0,'Return starts clear, without a preloaded horde');
  const attack=a.spawn(a.rig.position.x,a.rig.position.z);attack.attack=0;tick(.02);
  check(a.state().health===85,'Existing pursuer still attacks during rising');
  check(attack.g.userData.head.position.z<-.2&&attack.g.userData.body.position.z<-.2,'On-foot bite thrusts the muzzle and body forward');
  check(a.camera.children.some(o=>o.visible&&o.material?.uniforms?.strength?.value>0),'On-foot hit shows the red border');a.kill(attack,false);
  tick(1.4,true);check(a.state().phase===3&&a.state().prone===0,'Automatically mounted after rising');
  tick(2,true);check(a.state().rideLift===1.75,'Camera raised to rider head height');
  const start=a.unicorn.position.clone();
  a.keys.KeyW=a.keys.KeyD=true;a.teleport(30,10);tick(.4,true);a.keys.KeyW=a.keys.KeyD=false;
  check(a.unicorn.position.z>start.z&&a.unicorn.position.z<start.z+3,'Automatic forward movement');
  check(Math.hypot(a.rig.position.x-a.unicorn.position.x,a.rig.position.z-a.unicorn.position.z)<.001,'Walk and teleport cannot detach rider');
  a.renderer.domElement.dispatchEvent(new MouseEvent('mousedown',{button:0}));tick(.4,true);dispatchEvent(new MouseEvent('mouseup',{button:0}));check(a.arrows.length>0,'Bow fires while riding');
  tick(4,true);check(!a.wolves.some(w=>w.side),'No packs before the road junction');
  for(let i=0;i<30&&!a.wolves.some(w=>w.side);i++)tick(1,true);
  const packs=a.wolves.filter(w=>!w.dead&&w.side);
  check(packs.length===10&&packs.filter(w=>w.side<0).length===5,'Five wolves on each side at the road junction');
  check(packs.every(w=>w.g.position.z<a.unicorn.position.z-10),'Packs arrive from behind');
  tick(14,true);
  check(packs.filter(w=>!w.ambush&&w.g.position.distanceTo(a.unicorn.position)<11).length>=6,'Most wolves stay alongside the rider');
  let ambush;
  for(let i=0;i<1800&&!ambush;i++){
   const charging=packs.filter(w=>w.charging);tick(1/60,true);
   ambush=packs.find(w=>w.charging&&!charging.includes(w));
  }
  const stagedOffset=ambush?.g.position.clone().sub(a.unicorn.position).setY(0),stagedFacing=new T.Vector3(0,0,-1).applyQuaternion(a.unicorn.quaternion);
  check(ambush&&stagedOffset.length()>14&&stagedOffset.angleTo(stagedFacing)<Math.PI/9+.05,'A pack member overtakes then stages a frontal charge');
  check(packs.filter(w=>w.ambush).length<=2,'At most two simultaneous attack loops');
  const victim=packs.find(w=>!w.ambush);a.kill(victim,false);tick(.25,true);
  check(a.wolves.filter(w=>!w.dead&&w.side).length===9,'A kill is not replaced immediately');
  tick(.4,true);check(a.wolves.filter(w=>!w.dead&&w.side).length===10,'A reinforcement starts catching up from behind');
  const reinforcement=a.wolves.find(w=>!w.dead&&w.slot===victim.slot);check(reinforcement.rejoin>9&&reinforcement.g.position.distanceTo(a.unicorn.position)>24,'The replacement is still far behind the rider');tick(10,true);
  for(const w of a.wolves.filter(w=>!w.dead&&w.side&&w!==ambush).slice(0,4))a.kill(w,false);
  tick(1,true);check(a.wolves.filter(w=>!w.dead&&w.side).length===7,'Repeated kills stagger the reinforcements without a long blackout');
  const forward=a.camera.getWorldDirection(new T.Vector3()),right=new T.Vector3(-forward.z,0,forward.x);const warning=a.wolves.find(w=>!w.dead);for(const w of a.wolves)if(w!==warning)w.g.position.x+=100;warning.g.position.copy(a.unicorn.position).addScaledVector(right,1.8);tick(1/60);
  check(a.state().wolfAlert>0,'Return ambush raises the right-side warning');
  a.camera.rotation.set(-.3,0,0);snap();return{clearance,stagedAmbush:true,twoPacks:true,delayedReinforcements:true,killPressure:true,autoMount:true,noHealInput:true};
 });
 await page.screenshot({path:out+'/pursuit.png'});
 const transitions=await page.evaluate(()=>{
  const a=torde;a.unicorn.position.z=-120;tick(1/60,true);a.clear();a.set({health:60});
  const front=new T.Vector3(0,0,-1).applyQuaternion(a.unicorn.quaternion);
  const w=a.spawn(a.unicorn.position.x+front.x,a.unicorn.position.z+front.z);w.attack=0;w.charging=true;tick(1/60);
  check(a.state().health===45&&a.state().phase===3&&a.state().prone===0,'Bite damages only rider; no collapse below half life');
  check(w.g.userData.head.position.z<-.2,'Mounted bite animates the muzzle');
  const border=a.camera.children.find(o=>o.material?.uniforms?.strength),view=a.camera.quaternion.clone();
  check(border.visible&&border.material.uniforms.strength.value<=.22,'Mounted hit shows a subtle damage border');
  tick(.55);check(!border.visible&&w.g.userData.head.position.z===0,'Damage border and bite recoil finish promptly');
  check(1-Math.abs(view.dot(a.camera.quaternion))<.000001,'Damage never shakes the camera');
  const bittenAt=w.g.position.clone();tick(2.8);
  check(a.state().health===45&&w.pause>.1&&w.g.position.distanceTo(bittenAt)===0,'Bitten wolf stays still for three seconds');
  check(w.g.position.distanceTo(bittenAt)===0,'Bite pause lasts 3.5 seconds');
  tick(.3);check(w.pause===0,'Wolf resumes circling after its pause');
  let staged=false,bitAgain=false;
  for(let i=0;i<2400;i++){
   const wasCharging=w.charging;tick(1/60);
   const offset=w.g.position.clone().sub(a.unicorn.position).setY(0),distance=offset.length();
   const facing=new T.Vector3(0,0,-1).applyQuaternion(a.unicorn.quaternion);
   const angle=offset.angleTo(facing);
   if(!wasCharging&&w.charging){check(distance>14&&distance<16&&angle<Math.PI/9+.05,'Reattack stages fifteen metres ahead in the frontal sector');staged=true;}
   if(w.pause){check(staged&&angle<Math.PI/4,'Next bite follows the full frontal approach');bitAgain=true;break;}
  }
  check(bitAgain,'Wolf completes its circle and attacks again');
  a.clear();dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));const before=a.unicorn.position.clone();tick(2);check(before.distanceTo(a.unicorn.position)===0,'Pause stops ride');dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));
  a.unicorn.position.z=-12.001;const retreating=a.spawn(a.unicorn.position.x,a.unicorn.position.z);retreating.pause=3;retreating.charging=true;const retreatStart=retreating.g.position.clone();const live=a.wolves.filter(w=>!w.dead).length;tick(.1);const safeHealth=a.state().health;tick(4);check(a.state().health===safeHealth&&a.wolves.filter(w=>!w.dead).length===live,'Village approach stops attacks and reinforcements');check(retreating.g.position.z<retreatStart.z-10&&!retreating.pause,'Even a paused attacker retreats away from the houses');
  a.unicorn.position.z=16.95;tick(.1);check(a.state().phase===4,'Village starts retreat');
  const fleeing=a.spawn(a.unicorn.position.x+2,a.unicorn.position.z-2);fleeing.attack=0;
  const hp=a.state().health,d=fleeing.g.position.distanceTo(a.unicorn.position);tick(2);
  check(a.state().health===hp&&fleeing.g.position.distanceTo(a.unicorn.position)>d+10,'Wolves flee without damage');tick(9.2);check(a.state().mode==='win'&&a.state().phase===6,'Farewell finishes with Game Over');
  a.start();tick(.1);check(a.state().phase===0&&a.state().rideLift===0&&a.state().health===100,'Restart restores walking and health');
  a.set({health:10});const attacker=a.spawn(a.rig.position.x,a.rig.position.z);attacker.attack=0;tick(.1);check(a.state().mode==='lose','Outbound bite causes death');
  check(a.camera.layers.mask===8&&a.renderer.getClearColor(new T.Color()).getHex()===0,'Death hides the world against black');
  check(document.getElementById('intro').style.display==='none'&&document.getElementById('mute').hidden,'Game over has no menu overlay');
  tick(.3);snap();return{riderOnlyDamage:true,noCollapse:true,fled:true,won:true,blackGameOver:true};
 });
 await page.screenshot({path:out+'/game-over.png'});
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(out+'/report.json',JSON.stringify({...result,...transitions,errors},null,2));console.log({...result,...transitions,errors});
}finally{await browser.close();}
