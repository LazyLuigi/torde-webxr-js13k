import {readFile,writeFile,mkdir} from 'node:fs/promises';
export const engineURL='https://play.js13kgames.com/2026/webxr/three.js';
export async function engineFixture(){
 const path='.js13k-check/three-official.js';await mkdir('.js13k-check',{recursive:true});
 try{await readFile(path);return path;}catch{}
 let bytes;try{bytes=await readFile('.dream-loop/three-official.js');}catch{const response=await fetch(engineURL);if(!response.ok)throw Error('Official Three.js: '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
 await writeFile(path,bytes);return path;
}
