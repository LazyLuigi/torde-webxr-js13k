import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

export function roadrollerOptionsFor(config,name){
 const options=config.profiles?config.profiles[name]?.options:config;
 if(!options||typeof options!=='object')throw Error('Missing Roadroller profile: '+name);
 if(options.allowFreeVars)throw Error('allowFreeVars is incompatible with the module script');
 return options;
}

export function gameHTML(template,js,engine){
 return template.replace(/<!-- GAME -->[\s\S]*?<!-- END GAME -->/,()=>`<script type=module>import * as T from '${engine}';globalThis.T=T;${js}</script>`).replace(/\n\s*/g,'\n');
}

// Both release builds and searches measure exactly the same final container.
export async function archiveHTML(html,dir,{zipName='game.zip',requireAdvzip=false}={}){
 await mkdir(dir,{recursive:true});await writeFile(join(dir,'index.html'),html);
 const zip=join(dir,zipName);await rm(zip,{force:true});
 execFileSync('zip',['-X','-9',zipName,'index.html'],{cwd:dir,stdio:'pipe'});
 try{execFileSync('advzip',['-z','-4','-i','100',zipName],{cwd:dir,stdio:'pipe'});}
 catch(error){if(requireAdvzip)throw error;console.warn('advzip unavailable or failed; measured ZIP uses zip -9 only.');}
 if(!execFileSync('unzip',['-p',zip,'index.html']).equals(Buffer.from(html)))throw Error('ZIP content differs from the built HTML');
 return (await readFile(zip)).length;
}
