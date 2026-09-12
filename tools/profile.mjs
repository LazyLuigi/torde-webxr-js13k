import {engineFixture} from './engine-fixture.mjs';
const enginePath=await engineFixture();
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const report={environment:'Desktop Chromium, ANGLE Metal; physical headset not measured',startup:[]};
for(const rate of [1,4,8]){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 await page.route('https://play.js13kgames.com/2026/webxr/three.js',r=>r.fulfill({path:enginePath,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}}));
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});await page.goto('http://localhost:4174/dist/index.html',{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
 report.startup.push({cpuSlowdown:rate,...await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd};})});await context.close();
}
const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto('http://localhost:4174',{waitUntil:'networkidle'});await page.waitForTimeout(1000);
report.gpu=await page.evaluate(()=>{const gl=torde.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
async function sample(){return page.evaluate(()=>new Promise(resolve=>{const deltas=[];let previous=performance.now(),start=previous;function tick(now){deltas.push(now-previous);previous=now;if(now-start<4000)requestAnimationFrame(tick);else{deltas.sort((a,b)=>a-b);const sum=deltas.reduce((a,b)=>a+b,0);resolve({fps:deltas.length*1000/sum,p50Ms:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)],p99Ms:deltas[Math.floor(deltas.length*.99)],frames:deltas.length,drawCalls:torde.renderer.info.render.calls,trianglesIncludingShadowPass:torde.renderer.info.render.triangles});}}requestAnimationFrame(tick);}));}
report.title=await sample();await page.locator('#intro[data-ready="1"]').click();await page.evaluate(()=>{torde.place(0,-43);torde.set({phase:1,encounters:3});for(let i=0;i<14;i++)torde.spawn(Math.sin(i)*8,-53-Math.cos(i)*3);});report.combat=await sample();
await writeFile('.js13k-check/performance.json',JSON.stringify(report,null,2));console.log(report);await browser.close();
