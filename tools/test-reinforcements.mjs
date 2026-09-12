import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='.dream-loop/reinforcement-check';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:4174');await page.locator('#intro[data-ready="1"]').click();
 const report=await page.evaluate(async()=>{
  const a=torde,{pathX,height}=await import('/src/world.js');
  a.renderer.setAnimationLoop(null);a.renderer.render=()=>{};
  let time=performance.now(),births=new Map();
  // Record the actual spawn position before the first movement update.
  a.wolves.push=function(...wolves){for(const w of wolves)births.set(w,{at:time/1000,radius:Math.hypot(w.g.position.x-a.unicorn.position.x,w.g.position.z-a.unicorn.position.z),position:w.g.position.clone(),rider:a.unicorn.position.clone(),heading:a.unicorn.rotation.y});return Array.prototype.push.apply(this,wolves);};
  const check=(ok,label)=>{if(!ok)throw Error(label);};
  const tick=()=>{a.set({health:100});time+=1000/60;a.frame(time);};
  const report=[];
  for(let site=0;site<4;site++)for(const slot of [...Array(10).keys(),-1]){
   let tries=0;do{a.start();check(++tries<100,'Clearing selection');}while(a.state().sanctuary!==site);
   a.set({phase:3,encounters:3});const z=a.clearings[site][1]+24;a.unicorn.position.set(pathX(z),height(pathX(z),z),z);
   for(let i=0;i<180&&!a.wolves.some(w=>w.side);i++)tick();
   check(a.wolves.filter(w=>!w.dead&&w.side).length===10,'Initial two packs');
   const victims=a.wolves.filter(w=>slot<0||w.slot===slot);for(const w of victims)a.kill(w,false);
   births=new Map();const killedAt=time/1000,joined=new Map();
   for(let i=0;i<30*60&&joined.size<victims.length;i++){
    tick();const live=a.wolves.filter(w=>!w.dead&&w.side);
    check(live.length<=10&&new Set(live.map(w=>w.slot)).size===live.length,'No duplicate living slots');
    for(const [w,birth] of births){
     check(Math.abs(birth.radius-28)<1e-8,'Each reinforcement spawns at the same radius');
     const offset=birth.position.clone().sub(birth.rider).setY(0),back=new T.Vector3(Math.sin(birth.heading),0,Math.cos(birth.heading));
     check(offset.dot(back)>26,'Each reinforcement starts behind the rider');
     const targetZ=a.unicorn.position.z+(w.slot%5-2)*1.7+Math.sin(a.state().totalTime*.45+w.seed)*2.3;
     const targetX=pathX(targetZ)+w.side*(5+w.slot%2*1.5);
     if(!joined.has(w)&&Math.hypot(w.g.position.x-targetX,w.g.position.z-targetZ)<2)joined.set(w,time/1000);
    }
   }
   check(joined.size===victims.length,`All replacements rejoin: site ${site}, slot ${slot}, ${joined.size}/${victims.length}`);
   const arrivals=[...joined].map(([w,at])=>({slot:w.slot,spawn:births.get(w).at-killedAt,travel:at-births.get(w).at,arrival:at-killedAt}));
   for(const r of arrivals)check(r.travel>8&&r.travel<12,`About ten seconds of travel: ${JSON.stringify({site,...r})}`);
   const spawnTimes=[...births.values()].map(b=>b.at-killedAt).sort((x,y)=>x-y);
   check(spawnTimes[0]>=.48&&spawnTimes[0]<.55,'The first replacement starts promptly');
   for(let i=1;i<spawnTimes.length;i++)check(spawnTimes[i]-spawnTimes[i-1]>.48&&spawnTimes[i]-spawnTimes[i-1]<2.04,'Deaths only slightly space out replacements');
   if(slot<0)check(Math.max(...arrivals.map(r=>r.arrival))<26,'Even a full wipe refills both packs promptly');
   report.push({site,kills:victims.length,arrivals});
  }
  // A pending queue must stop as soon as the village safety zone is reached.
  for(const w of a.wolves.filter(w=>!w.dead))a.kill(w,false);births=new Map();a.unicorn.position.z=-12.001;
  for(let i=0;i<180;i++)tick();check(births.size===0,'No queued reinforcement spawns near the village');
  return report;
 });
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));
 const arrivals=report.flatMap(r=>r.arrivals),wipes=report.filter(r=>r.kills===10);
 console.log({scenarios:report.length,travelSeconds:[Math.min(...arrivals.map(r=>r.travel)),Math.max(...arrivals.map(r=>r.travel))],fullWipeLastArrivalSeconds:wipes.map(r=>Math.max(...r.arrivals.map(a=>a.arrival))),errors});
}finally{await browser.close();}
