// Extended Roadroller search, inspired by Rob Louie's find-best-roadroller.
// Uses the API instead of parsing CLI logs. Search exact production inputs,
// then compare real ZIPs and validate the winner before saving its settings.
// Usage: npm run find-best-roadroller -- [seconds=300] [--variant all-packed|packed]
//        Add --dry-run to measure without updating tools/roadroller-options.json.
import {Packer,ResourcePool} from 'roadroller';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {roadrollerOptionsFor,gameHTML,archiveHTML} from './roadroller-build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const args=process.argv.slice(2);let seconds=300,variant='all-packed',dryRun=false,durationGiven=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--dry-run')dryRun=true;
 else if(args[i]==='--variant'&&['packed','all-packed'].includes(args[i+1]))variant=args[++i];
 else if(/^\d+$/.test(args[i])&&!durationGiven){seconds=Number(args[i]);durationGiven=true;}
 else throw Error('Usage: npm run find-best-roadroller -- [seconds] [--variant all-packed|packed] [--dry-run]');
}
if(!Number.isSafeInteger(seconds)||seconds<1||seconds>86400)throw Error('Search duration must be 1–86400 seconds');
execFileSync('advzip',['--version'],{stdio:'pipe'});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),runDir=resolve('.dream-loop/roadroller-search',stamp),configPath=resolve('tools/roadroller-options.json');
await mkdir(runDir,{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex');
const sourceFiles=[...(await readdir('src')).filter(n=>/\.(js|html)$/.test(n)).sort().map(n=>'src/'+n),'tools/build.mjs','tools/roadroller-build.mjs','package-lock.json'];
async function sourceHash(){const h=createHash('sha256');for(const file of sourceFiles)h.update(file).update(await readFile(file));return h.digest('hex');}
const initialSourceHash=await sourceHash(),configText=await readFile(configPath,'utf8'),config=JSON.parse(configText);
await writeFile(join(runDir,'original-options.json'),configText);
const releaseZip=await readFile('dist/torde.zip');await copyFile('dist/torde.zip',join(runDir,'reference-release.zip'));
const releaseBytes=releaseZip.length;
console.log(`Reference release: ${releaseBytes} bytes (${13312-releaseBytes} bytes remaining)`);
execFileSync(process.execPath,['tools/build.mjs','--pack','--prepare-roadroller',join(runDir,'prepared')],{stdio:'inherit'});
if(await sourceHash()!==initialSourceHash)throw Error('Sources changed while preparing the input; restart the search');
const manifest=JSON.parse(await readFile(join(runDir,'prepared/manifest.json'),'utf8'));
const [,input,template]=manifest.plans.find(([name])=>name===variant),inputSHA256=hash(input);
const pool=new ResourcePool(),keys=['numAbbreviations','recipLearningRate','modelMaxCount','modelRecipBaseCount','precision','dynamicModels','contextBits','sparseSelectors','maxMemoryMB'];
const clean=options=>Object.fromEntries(keys.filter(k=>options[k]!==undefined).map(k=>[k,options[k]]));
const newPacker=options=>new Packer([{data:input,type:'js',action:'eval'}],{...options,allowFreeVars:false,resourcePool:pool});
const initialOptions=clean(newPacker(roadrollerOptionsFor(config,variant)).options);
async function measure(name,options){
 const p=newPacker(options),decoder=p.makeDecoder(),html=gameHTML(template,decoder.firstLine+'\n'+decoder.secondLine,manifest.engine),dir=join(runDir,name);
 const bytes=await archiveHTML(html,dir,{zipName:'torde.zip',requireAdvzip:true});
 const result={name,dir,bytes,options,memoryMB:p.memoryUsageMB};
 console.log(`ZIP ${name}: ${bytes} bytes`);return result;
}
const baseline=await measure('baseline',initialOptions);
console.log(`Searching ${variant} for ${seconds}s; input ${Buffer.byteLength(input)} bytes, SHA-256 ${inputSHA256.slice(0,12)}`);
const candidates=new Map();let bestEstimate=Infinity,seed=initialOptions,interrupted=false,interrupts=0,passes=0,lastLog=0;
const onSigint=()=>{if(++interrupts>1)process.exit(130);interrupted=true;console.log('Stopping search; retained candidates will still be compared and validated.');};
process.on('SIGINT',onSigint);
const began=Date.now(),deadline=began+seconds*1000;
try{
 while(!interrupted&&Date.now()<deadline){
  // Continue from the best settings, with occasional default restarts to explore.
  const p=newPacker(passes&&passes%3===0?{}:seed),starting=clean(p.options);passes++;
  try{await p.optimize(2,async info=>{
   if(info.bestUpdated){
    const options=clean({...starting,...info.best}),key=JSON.stringify(options);
    candidates.set(key,{estimate:info.bestSize,options});
    if(info.bestSize<bestEstimate){bestEstimate=info.bestSize;seed=options;console.log(`Best estimate: ${bestEstimate} bytes, pass ${passes}, ${Math.round((Date.now()-began)/1000)}s`);lastLog=Date.now();}
   }
   if(Date.now()-lastLog>15000){console.log(`Search: ${Math.round((Date.now()-began)/1000)}/${seconds}s, pass ${passes}, best estimate ${bestEstimate}`);lastLog=Date.now();}
   await new Promise(r=>setImmediate(r));
   return !interrupted&&Date.now()<deadline;
  });}catch(error){if(error.message!=='search aborted')throw error;}
 }
 const searchSeconds=(Date.now()-began)/1000;
 // Estimates rank the shortlist; only the actual ZIP can beat the incumbent.
 const shortlist=[...candidates.values()].filter(c=>JSON.stringify(c.options)!==JSON.stringify(initialOptions)).sort((a,b)=>a.estimate-b.estimate).slice(0,5);
 const measured=[baseline];
 await writeFile(join(runDir,'search-candidates.json'),JSON.stringify({inputSHA256,passes,searchSeconds,candidates:[...candidates.values()]},null,2));
 for(const [i,candidate]of shortlist.entries())measured.push({...await measure('candidate-'+(i+1),candidate.options),estimate:candidate.estimate});
 const winner=measured.reduce((a,b)=>b.bytes<a.bytes?b:a);
 const report={referenceReleaseBytes:releaseBytes,referenceReleaseSHA256:hash(releaseZip),baselineBytes:baseline.bytes,variant,inputSHA256,sourceSHA256:initialSourceHash,searchSeconds,passes,interrupted,measured,winner,gain:baseline.bytes-winner.bytes,applied:false};
 const reportPath=join(runDir,'report.json');await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 if(winner.bytes<baseline.bytes){
  console.log('Validating the candidate ZIP in Chromium/WebXR and Firefox…');
  try{
   execFileSync(process.execPath,['tools/test-ride-packed.mjs',...(winner.bytes>13312?['--allow-oversize']:[])],{stdio:'inherit',env:{...process.env,BUILD_DIR:winner.dir,TEST_OUTPUT_DIR:relative(root,join(runDir,'browser-check'))}});
  }catch(error){report.validationError=error.message;await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');throw error;}
  report.validated=true;
  if(!dryRun){
   if(await sourceHash()!==initialSourceHash||await readFile(configPath,'utf8')!==configText)report.applySkippedReason='Sources or settings changed during the search; winner is saved but existing settings were not replaced.';
   else{
    const updated=config.profiles?structuredClone(config):{version:1,profiles:Object.fromEntries(manifest.plans.map(([name])=>[name,{options:config}]))};
    updated.profiles[variant]={options:winner.options,inputSHA256};
    const temporary=configPath+'.next';await writeFile(temporary,JSON.stringify(updated,null,2)+'\n');await rename(temporary,configPath);report.applied=true;
   }
  }
 }
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({reference:releaseBytes,baseline:baseline.bytes,best:winner.bytes,gain:report.gain,remaining:13312-winner.bytes,validated:!!report.validated,settingsSaved:report.applied,report:relative(root,reportPath)},null,2));
 if(report.applied)console.log('Settings saved. npm run build will reproduce the selected candidate; dist/ has not been replaced by the search.');
 else console.log(report.applySkippedReason||(dryRun?'Dry run: settings and release preserved.':'No smaller ZIP found: settings and release preserved.'));
}finally{process.off('SIGINT',onSigint);}
