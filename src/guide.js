// Shared vector pictograms: the same animated lesson is drawn in HTML and in XR.
// Local Quest Touch icons and the elder's dialogue; no downloaded assets.
const paths=[
 'M-18-16C-42-51 42-51 18-16M-13-21Q-25-12-16 8L-10 30Q0 36 10 30L16 8Q25-12 13-21ZM13-10L22-3 17 8M0-50V-76M-6-70L0-76 6-70',
 'M0 24L-23 2C-42-22-10-35 0-16C10-35 42-22 23 2Z',
].map(p=>new Path2D(p));
const speeches=["The ancient unicorn needs you.\nFind where the rainbow ends.","Beware of wolves.\nTake this bow."];
export function dialogue(story){if(story>15)return "Thank you for bringing her back.".slice(0,Math.floor((30-story)*35));if(story<0)return "Hmm... I lost my way.";return story>0?speeches[story>6?0:1].slice(0,Math.floor((story>6?15-story:6-story)*35)):'';}
export function drawGuide(ctx,time,lesson,phase,health,story,mode,open){
 const t=time/1200%1,p=t>.2&&t<.8,c=ctx;
 c.clearRect(0,0,768,256);if(phase===4)return;if(mode==='lose'||mode==='win'){c.fillStyle='#fff';c.textAlign='center';c.font='56px Georgia';c.fillText('Game over',384,130);c.fillStyle='#ffe3a2';c.font='26px Georgia';c.fillText('Press trigger to restart',384,185);return;}c.strokeStyle='#ffe3a2';c.fillStyle='#ffe3a2';c.lineWidth=4;c.lineCap='round';c.lineJoin='round';
 function icon(i,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);c.stroke(paths[i]);c.restore();}
 function dot(x,y,r){c.beginPath();c.arc(x,y,r,0,7);c.fill();}
 c.fillStyle='#123436d9';c.beginPath();c.roundRect(244*(1-open),191*(1-open),280+488*open,65+191*open,24);c.fill();c.fillStyle='#ffe3a2';
 if(mode==='play'&&phase<4&&open<.1){
 c.save();c.translate(0,191);icon(1,274,30,.42);c.globalAlpha=.2;c.fillRect(305,25,200,8);c.globalAlpha=1;c.fillRect(305,25,health*2,8);c.restore();
 }
 // The popup grows out of the status strip instead of replacing it abruptly.
 c.save();c.globalAlpha=open;c.translate(0,191*(1-open));c.scale(1,open);
 if(story){c.font='30px Georgia';c.textAlign='center';dialogue(story).split('\n').forEach((text,i)=>c.fillText(text,384,(story<0?128:78)+i*43));}
 else if(lesson>=0){
  c.save();c.translate(300,125);c.scale(-1,1);c.stroke(paths[0]);c.restore();dot(300,120-18*p,6);
 }
 c.restore();
}
