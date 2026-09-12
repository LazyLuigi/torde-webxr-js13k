import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const out='.dream-loop/arrow-collisions';await mkdir(out,{recursive:true});
const report=[];
for(const [name,type] of Object.entries({chromium,firefox})){
 const browser=await type.launch(name==='chromium'?{headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']}:{headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.waitForFunction(()=>globalThis.torde);
  const cases=await page.evaluate(async()=>{
   const a=torde,{height}=await import('/src/world.js'),checks=[];
   a.renderer.setAnimationLoop(null);const render=a.renderer.render.bind(a.renderer);a.renderer.render=()=>{};
   let ms=performance.now();
   const tick=(dt=.04)=>{ms+=dt*1000;a.frame(ms);};
   const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
   const v=(x,y,z)=>new T.Vector3(x,y,z);
   const reset=()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'Digit2'}));a.set({encounters:3});a.clear();tick();};
   const wolf=(x,y,z)=>{const w=a.spawn(x,z);w.g.position.y=y-.55;w.pause=100;return w;};
   const fire=(origin,direction)=>{
    a.shoot(origin,direction,1);const arrow=a.arrows.at(-1);
    if(!arrow)throw Error('Shot setup failed');
    return arrow;
   };
   const planted=arrow=>a.arrows.includes(arrow)&&!arrow.v&&arrow.g.parent===a.scene;
   const treeY=height(-6,-44),hutY=height(-6,16);
   reset();const behind=wolf(-4.9,treeY+1,-44);
   const trunk=fire(v(-6.9,treeY+1,-44),v(1,0,0));tick();
   check(planted(trunk)&&trunk.g.position.x<-6.8,'Fast arrow embeds its tip with the shaft outside the trunk');
   check(behind.hp===1&&!behind.dead,'Wolf behind trunk is protected');
   check(a.state().misses===1,'Scenery impact counts as one miss');
   const position=trunk.g.position.clone(),rotation=trunk.g.quaternion.clone();
   const passer=wolf(position.x,position.y,position.z);
   for(let i=0;i<250;i++)tick();
   check(planted(trunk)&&trunk.g.position.equals(position)&&trunk.g.quaternion.equals(rotation),'Embedded arrow stays fixed beyond its former three-second lifetime');
   check(passer.hp===1&&!passer.dead&&a.state().misses===1,'Embedded arrow neither damages passing wolves nor counts repeated misses');
   reset();const front=wolf(-7.6,treeY+1,-44);
   fire(v(-8.3,treeY+1,-44),v(1,0,0));tick();
   check(front.dead>0,'Wolf in front of trunk can still be hit');
   check(a.state().misses===0&&a.state().kills===1,'Wolf hit does not count as a miss');
   reset();const hidden=wolf(-6,hutY+1,16.1);
   const wall=fire(v(-6,hutY+1,13.7),v(0,0,1));tick();
   check(planted(wall)&&wall.g.position.z<13.9&&hidden.hp===1,'House wall and door keep the arrow embedded outside their surface');
   reset();const roof=fire(v(-6,hutY+3.4,14.8),v(0,0,1));tick();
   check(planted(roof)&&roof.g.position.z<16,'Sloping roof keeps the arrow embedded');
   reset();fire(v(-6,hutY+4.5,14.8),v(0,0,1));tick();
   check(a.arrows.length===1,'Shot above the roof remains free');
   reset();const buried=wolf(0,height(0,5)-.9,5);
   const ground=fire(v(0,height(0,5)+.9,5),v(0,-1,0));tick();
   check(planted(ground)&&ground.g.position.y>height(0,5)+.25&&buried.hp===1,'Ground keeps the shaft above the surface and shields a buried wolf');
   reset();fire(v(-6.4,treeY+14,-44),v(1,0,0));tick();
   check(a.arrows.length===1,'Foliage above the trunk stays permeable');
   reset();const target=wolf(0,3,2);
   fire(v(0,3,3.5),v(0,0,-1));tick();
   check(target.dead>0,'Unobstructed wolf still takes damage');
   reset();const first=wolf(0,3,2),second=wolf(0,3,0);
   fire(v(0,3,3.5),v(0,0,-1));for(let i=0;i<3;i++)tick();
   check(first.dead>0&&second.hp===1&&!a.arrows.length,'One arrow stops at the first wolf instead of piercing the pack');
   reset();a.setPhase(3);a.place(a.unicorn.position.x,a.unicorn.position.z);
   dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));a.setPhase(1);a.place(0,-32);
   const strong=wolf(0,3,2);strong.hp=2;
   fire(v(0,3,3.5),v(0,0,-1));tick();
   check(strong.hp===1&&!strong.dead&&!a.arrows.length&&a.nocked.children[0].material.type==='MeshLambertMaterial','Former enchant key cannot change damage or arrow material');
   reset();fire(v(0,50,0),v(0,1,0));for(let i=0;i<76;i++)tick();
   check(!a.arrows.length,'Unobstructed arrows still expire');
   reset();const fired=[];
   for(let i=0;i<36;i++){const arrow=fire(v(0,height(0,5)+.9,5),v(0,-1,0));fired.push(arrow);for(let j=0;j<8;j++)tick();}
   check(a.arrows.length===32&&a.arrows.every(planted),'Embedded arrows are capped at 32');
   check(fired.slice(0,4).every(arrow=>!arrow.g.parent)&&fired.slice(4).every(planted),'Only the oldest arrows are removed when the cap is reached');
   a.start();check(!a.arrows.length&&fired.every(arrow=>!arrow.g.parent),'Restart removes all embedded arrows');
   // The actual rendered crown intersects this ray, while the collision mesh does not.
   const ray=new T.Raycaster(v(-6.4,treeY+14,-44),v(1,0,0),0,1.84);a.scene.updateMatrixWorld(true);
   check(ray.intersectObjects(a.world.scenery.children,false).length>0&&ray.intersectObjects(a.world.colliders,false).length===0,'Foliage test crosses visible needles, not empty space');
   check(a.world.colliders.every(m=>!m.parent&&a.world.scenery.children.some(s=>s.geometry.attributes.position===m.geometry.attributes.position)),'Collision geometry shares visible vertices and adds no render calls');
   // Local CPU measurement: include terrain, village and forest segments.
   const samples=[],origins=[v(-6.9,treeY+1,-44),v(0,2,-32),v(-6,hutY+1,13.7),v(12,3,-120)];
   for(let batch=0;batch<30;batch++){
    const start=performance.now();
    for(let i=0;i<100;i++){ray.set(origins[i%4],v(0,0,-1));ray.far=1.84;ray.intersectObjects(a.world.colliders,false);}
    samples.push((performance.now()-start)/100);
   }
   samples.sort((a,b)=>a-b);
   // Render a close view to inspect the visible shaft and penetration depth.
   reset();fire(v(-6,hutY+1.2,13.6),v(0,0,1));tick();
   a.rig.position.set(0,0,0);a.camera.position.set(-5.25,hutY+1.6,12.5);a.camera.lookAt(-6,hutY+1.2,14.2);
   a.nocked.visible=a.bow.visible=a.panel.visible=false;for(const id of ['hud','aim'])document.getElementById(id).style.display='none';render(a.scene,a.camera);
   return{checks,raycastMs:{median:samples[15],p95:samples[28]},collisionTriangles:a.world.colliders.reduce((n,m)=>n+m.geometry.index.count/3,0),collisionIndexBytes:a.world.colliders.reduce((n,m)=>n+m.geometry.index.array.byteLength,0)};
  });
  await page.screenshot({path:out+'/'+name+'-embedded-wall.png'});
  assert.deepEqual(errors,[]);report.push({browser:name,...cases,errors});console.log(name+': '+cases.checks.length+' collision checks passed; raycast median '+cases.raycastMs.median.toFixed(3)+' ms');
 }finally{await browser.close();}
}
await writeFile(out+'/source-report.json',JSON.stringify(report,null,2));
