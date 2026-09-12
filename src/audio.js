// Original Nordic motif, timed synthesis. Sibling projects informed the scheduling
// and adaptive layering; no recordings, third-party tracks or external audio.
let ac,master,music,next=0,step=0,muted=false,intensity=0,noise,started=false;
function note(n,at,d=.4,v=.06,type='triangle',destination=music){
 if(!ac)return;
 const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=440*2**((n-69)/12);
 g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(v,at+.018);g.gain.exponentialRampToValueAtTime(.0001,at+d);
 o.connect(g);g.connect(destination);o.start(at);o.stop(at+d+.04);o.onended=()=>{o.disconnect();g.disconnect();};
}
function hiss(at,d,v,frequency=600){
 const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noise;f.type='bandpass';f.frequency.value=frequency;
 g.gain.setValueAtTime(v,at);g.gain.exponentialRampToValueAtTime(.0001,at+d);s.connect(f);f.connect(g);g.connect(master);s.start(at);s.stop(at+d);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
}
export function audioStart(){
 if(!ac){ac=new AudioContext();master=ac.createGain();master.gain.value=muted?0:.65;const limiter=ac.createDynamicsCompressor();master.connect(limiter);limiter.connect(ac.destination);music=ac.createGain();music.gain.value=.55;music.connect(master);
  noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
 }
 ac.resume().catch(()=>{});if(started)return;started=true;next=ac.currentTime+.05;
 setInterval(()=>{if(ac.state!=='running')return;if(next<ac.currentTime-.2)next=ac.currentTime;while(next<ac.currentTime+.15){
  const k=step%16,root=[50,46,53,48][Math.floor(step/16)%4],pattern=[12,19,15,14,12,7,10,7,12,15,19,22,19,15,14,7];
  if(k%2===0||intensity>.5)note(root+pattern[k],next,.6,.065);
  if(k===0){note(root-12,next,2.8,.065,'sine');note(root+7,next,2.5,.022,'sine');}
  if(intensity>.2&&k%4===0){note(31,next,.24,.2*intensity,'sine');hiss(next,.12,.07*intensity,250);}
  if(intensity>.6&&k%4===2)hiss(next,.09,.07,1200);
  next+=60/88/4;step++;
 }},45);
}
export function audioMood(value){intensity=value;}
export function mute(){muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.65,ac.currentTime,.04);return muted;}
export function sound(kind){
 if(!ac)return;const t=ac.currentTime;
 if(kind==='shot'){hiss(t,.12,.11,1600);note(52,t,.12,.08,'triangle',master);}
 if(kind==='hit'){hiss(t,.16,.16,650);note(40,t,.15,.1,'triangle',master);}
 if(kind==='hurt'){note(34,t,.4,.12,'sawtooth',master);hiss(t,.25,.08,200);}
 if(kind==='magic'||kind==='win')[0,7,12,15,19].forEach((n,i)=>note(74+n,t+i*.09,.55,.075,'triangle',master));
 if(kind==='talk')note(62+Math.random()*5,t,.055,.05,'triangle',master);
 if(kind==='step')hiss(t,.09,.04,500);
}
