import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://localhost:4174');await page.waitForFunction(()=>globalThis.torde);
 const report=await page.evaluate(async()=>{
  const a=torde,r=a.renderer,gl=r.getContext(),fog=a.scene.fog;
  r.setAnimationLoop(null);a.place(0,18);a.camera.rotation.set(0,0,0);a.camera.updateMatrixWorld(true);a.frame(performance.now());
  const measure=(mist,shadow)=>{
   a.scene.fog=mist?fog:null;
   for(let i=0;i<12;i++){r.shadowMap.needsUpdate=shadow;r.render(a.scene,a.camera);}gl.finish();
   const times=[];
   for(let i=0;i<60;i++){
    r.shadowMap.needsUpdate=shadow;const t=performance.now();r.render(a.scene,a.camera);gl.finish();times.push(performance.now()-t);
   }
   times.sort((a,b)=>a-b);return {medianMs:times[30],p95Ms:times[57],calls:r.info.render.calls,triangles:r.info.render.triangles};
  };
  const e=gl.getExtension('WEBGL_debug_renderer_info');return{environment:'Desktop Chromium / '+gl.getParameter(e.UNMASKED_RENDERER_WEBGL),method:'CPU submission + gl.finish wall time; not Quest frame timing',fog:measure(true,false),noFog:measure(false,false),shadowRefresh:measure(true,true),glError:gl.getError()};
 });
 await mkdir('.dream-loop/auto-rescue',{recursive:true});await writeFile('.dream-loop/auto-rescue/'+(process.argv[2]||'render')+'.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
