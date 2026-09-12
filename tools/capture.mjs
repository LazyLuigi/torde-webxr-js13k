import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.dream-loop',{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:4174',{waitUntil:'networkidle'});
await page.waitForTimeout(1200);
if(await page.evaluate(()=>!!globalThis.torde)){
 await page.evaluate(()=>torde.capture());await page.waitForTimeout(1000);
 console.log(JSON.stringify(await page.evaluate(()=>torde.state()),null,2));
}
await page.screenshot({path:'.dream-loop/'+(process.argv[2]||'live-01')+'.png'});
console.log('ERRORS',errors);await writeFile('.dream-loop/errors.json',JSON.stringify(errors,null,2));await browser.close();
