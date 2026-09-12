import {drawGuide,dialogue} from './guide.js';
import {makeWorld,height,pathX,random,clearings,clamp,rideX} from './world.js';
import {makeUnicorn,poseUnicorn,makeWolf,poseWolf,makeBow,setBowDraw} from './models.js';
import {audioStart,audioMood,sound,mute} from './audio.js';
const T=globalThis.T,$=id=>document.getElementById(id),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),desktop=typeof DEV==='undefined'||DEV;
const scene=new T.Scene();scene.fog=new T.FogExp2(0x78a0b7,.023);
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor(0x7395ab);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.xr.enabled=true;renderer.xr.setFramebufferScaleFactor(.9);renderer.xr.setFoveation(.7);document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.06,600),rig=new T.Group();rig.add(camera);scene.add(rig);camera.position.y=1.7;
const alertGeo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([-.13,-.16,0,.15,0,0,-.13,.16,0],3)),alertMat=new T.MeshBasicMaterial({color:0xffd36d,side:T.DoubleSide,depthTest:false,transparent:true,opacity:.95});
const leftAlert=new T.Mesh(alertGeo,alertMat),rightAlert=new T.Mesh(alertGeo,alertMat);leftAlert.scale.x=-1;for(const a of [leftAlert,rightAlert]){camera.add(a);a.position.set(a===leftAlert?-.56:.56,.06,-1);a.renderOrder=100;a.visible=false;}
// Clip-space border renders at the edge of each eye without moving the tracked view.
const damageBorder=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({uniforms:{strength:{value:0},fade:{value:0}},vertexShader:'varying vec2 edge;void main(){edge=position.xy;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 edge;uniform float strength,fade;void main(){float rim=smoothstep(.84,1.,max(abs(edge.x),abs(edge.y)));gl_FragColor=fade>0.?vec4(0.,0.,0.,fade):vec4(.85,.025,.015,rim*strength);}',transparent:true,depthTest:false,depthWrite:false}));
camera.add(damageBorder);damageBorder.frustumCulled=false;damageBorder.renderOrder=101;damageBorder.visible=false;let damageFlash=0;
const world=makeWorld(scene),unicorn=makeUnicorn();scene.add(unicorn);unicorn.scale.setScalar(1.45);const blessing=new T.PointLight(0xffd69a,13,10);scene.add(blessing);unicorn.position.set(3.2,height(3.2,-49),-49);unicorn.rotation.y=2.2;poseUnicorn(unicorn,1,0,0);
const bow=makeBow();if(desktop){camera.add(bow);bow.position.set(.36,-.29,-.67);bow.rotation.set(.12,.35,-.95);bow.scale.setScalar(.82);}
const arrowMat=new T.MeshLambertMaterial({color:0xd8ad66}),tipMat=new T.MeshLambertMaterial({color:0x141c21});
const shaftGeo=new T.CylinderGeometry(.005,.006,.84,5).rotateX(Math.PI/2),tipGeo=new T.ConeGeometry(.018,.09,4).rotateX(-Math.PI/2);
function makeArrow(){const g=new T.Group(),s=new T.Mesh(shaftGeo,arrowMat),tip=new T.Mesh(tipGeo,tipMat);tip.position.z=-.46;g.add(s,tip);return g;}
const nocked=makeArrow();scene.add(nocked);
// Shared light motes and impact fragments, pooled to cap both memory and draw calls.
const moteGeo=new T.IcosahedronGeometry(.06,0),motes=new T.InstancedMesh(moteGeo,new T.MeshBasicMaterial({color:0xffd998}),110);motes.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(motes);const mtmp=new T.Object3D(),particles=[];
for(let i=0;i<110;i++)particles.push({p:V(),v:V(),life:0});
let particleIndex=0;
function burst(p,n=12,magic=false){for(let i=0;i<n;i++){const o=particles[particleIndex++%110];o.p.copy(p);o.v.set((random()-.5)*3,random()*2+1,(random()-.5)*3);o.life=.5+random()*.6;o.magic=magic;}}
// Grounded animal shadows avoid a moving shadow-map pass over the entire forest.
const blobGeo=new T.CircleGeometry(1,12).rotateX(-Math.PI/2),blobMat=new T.MeshBasicMaterial({color:0x142e2a,transparent:true,opacity:.3,depthWrite:false});
function blob(){const b=new T.Mesh(blobGeo,blobMat);scene.add(b);return b;}
const bloodMat=new T.MeshBasicMaterial({color:0x08090b,transparent:true,opacity:.8,depthWrite:false});
const unicornShadow=blob();unicornShadow.scale.set(1,.9,1.5);
const wolves=[],arrows=[],keys={},grips=[],controllers=[];
const p0=V(),p1=V(),p2=V(),dir=V(),q=new T.Quaternion(),up=V(0,1,0);
const arrowRay=new T.Raycaster();
const aimQuaternion=new T.Quaternion();let fullDraw=false,nockDistance=.12,nockHeld=false,stabTracked=false,stabReady=true;const stabHand=V(),stabTip=V();
let mode='title',phase=0,health=100,elapsed=0,totalTime=0,kills=0,misses=0,draw=0,drawing=false,prone=1,lastShot=-10,encounters=0,snapReady=true,teleReady=true,paused=false,yaw=0,pitch=-.03;
let rideLift=0,nextAmbush=0,wolfAlert=0,hunt=false,recruit=0,pressure=0;let exitYaw=0,exitTurn=0;const rideOffset=V(),exitFrom=V();
let sanctuary=-1,speech=0,thought=0,taught=0,walked=0,tutorial=-1,hasBow=false,briefed=false,spawnPending=false;let lastFrame=0,frameCount=0,frameTotal=0,teleportCooldown=0,foot=0;
const telePoint=V(),teleRing=new T.Mesh(new T.RingGeometry(.28,.38,28).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xb0e2c0,side:T.DoubleSide}));scene.add(teleRing);teleRing.visible=false;
// Canvas UI is generated locally and re-used for the VR panel; no remote font.
const panelCanvas=$('guide');const ctx=panelCanvas.getContext('2d'),panelTexture=new T.CanvasTexture(panelCanvas);panelTexture.colorSpace=T.SRGBColorSpace;
panelTexture.generateMipmaps=false;panelTexture.minFilter=T.LinearFilter;
const panel=new T.Mesh(new T.PlaneGeometry(1.3,.433),new T.MeshBasicMaterial({map:panelTexture,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));panel.layers.enable(3);panel.renderOrder=99;panel.frustumCulled=false;camera.add(panel);panel.position.set(0,-.55,-1.4);panel.visible=false;let panelStamp=-100,panelLesson=-2,lessonStart=0,panelOpen=0,panelTarget=false;
function nextSpeech(){if(mode!=='play'||paused||phase>=4||speech<=0)return false;if(dialogue(speech)===dialogue(speech+1))speech=speech>6?6:0;return true;}
function setPhase(p){phase=p;elapsed=0;}
function lock(){renderer.domElement.requestPointerLock?.()?.catch(()=>{});}
function safeAudio(){try{audioStart();}catch{}}
function clearActors(){for(const w of wolves){scene.remove(w.g,w.shadow);}wolves.length=0;for(const a of arrows)scene.remove(a.g);arrows.length=0;}
function start(){
 rideLift=0;nextAmbush=wolfAlert=damageFlash=0;world.shaman.rotation.y=0;hunt=false;recruit=pressure=0;$('mute').hidden=false;
 previewWolves.forEach(w=>scene.remove(w));clearActors();health=100;camera.layers.set(0);renderer.setClearColor(0x7395ab);prone=1;elapsed=totalTime=kills=misses=encounters=0;lastShot=-10;draw=0;drawing=nockHeld=stabTracked=false;stabReady=true;mode='play';paused=false;setPhase(0);safeAudio();speech=thought=taught=walked=0;hasBow=briefed=false;document.body.classList.add('playing');
 rig.position.set(pathX(28),height(pathX(28),28),28);spawnPending=renderer.xr.isPresenting;yaw=0;pitch=-.03;rig.rotation.y=0;sanctuary=(sanctuary+1+(Math.random()*3|0))%4;const [x,z]=clearings[sanctuary];unicorn.position.set(x,height(x,z),z);unicorn.rotation.y=2.2;world.rainbow.position.copy(unicorn.position);world.rainbow.visible=true;
 $('intro').style.display='none';if(desktop)$('hud').style.display=renderer.xr.isPresenting?'none':'block';if(desktop)$('aim').style.display=renderer.xr.isPresenting?'none':'block';
 if(desktop&&!renderer.xr.isPresenting)lock();
}
function end(won){
 $('mute').hidden=true;mode=won?'win':'lose';elapsed=0;speech=thought=0;drawing=nockHeld=false;draw=0;
 if(desktop)document.exitPointerLock?.();if(won){setPhase(6);sound('win');}
 camera.layers.set(3);renderer.setClearColor(0);$('intro').style.display='none';if(desktop){$('hud').style.display=renderer.xr.isPresenting?'none':'block';$('aim').style.display='none';}document.body.classList.remove('playing');
}
function pause(value){if(mode!=='play')return;paused=value;drawing=nockHeld=stabTracked=false;draw=0;$('intro').style.display=value?'flex':'none';document.body.classList.toggle('playing',!value);if(desktop&&(value||!renderer.xr.isPresenting)){if(value)document.exitPointerLock?.();else lock();}}
$('mute').onclick=()=>{$('mute').setAttribute('aria-pressed',mute());};
function spawn(x,z){const g=makeWolf();g.position.set(x,height(x,z),z);scene.add(g);const w={g,shadow:blob(),hp:1,speed:1.7+random()*.5,attack:1.2,pause:0,dead:0,seed:random()*10};wolves.push(w);return w;}
// The first hunt is inside the view cone; later packs progressively flank it.
function pack(count){
 const view=camera;
 view.getWorldDirection(dir);const heading=Math.atan2(dir.x,-dir.z),spread=.55+encounters*.13;
 view.getWorldPosition(p2);
 for(let i=0;i<count;i++){const a=heading+(i%2?1:-1)*spread*(.35+random()*.65),r=14+random()*6;spawn(p2.x+Math.sin(a)*r,p2.z-Math.cos(a)*r);}}
function touches(from,to,w){const delta=to.clone().sub(from),center=w.g.position.clone().add(V(0,.55,0));return delta.multiplyScalar(clamp(center.clone().sub(from).dot(delta)/Math.max(.001,delta.lengthSq()))).add(from).distanceTo(center)<.68;}
function stab(right,dt){
 const forward=V(0,0,-1).applyQuaternion(right.quaternion),tip=right.position.clone().addScaledVector(forward,.925),motion=right.position.clone().sub(stabHand),speed=motion.dot(forward)/dt;
 if(speed<-.25)stabReady=true;
 if(stabTracked&&stabReady&&speed>.7&&motion.length()<.3){const from=rig.localToWorld(stabTip.clone()),to=rig.localToWorld(tip.clone()),w=wolves.find(w=>!w.dead&&touches(from,to,w));if(w){w.hp--;stabReady=false;if(w.hp<=0)kill(w);else{sound('hit');haptic('right',.5,70);}}}
 stabHand.copy(right.position);stabTip.copy(tip);stabTracked=true;
}
function hurt(amount){health=Math.max(0,health-amount);damageFlash=.45;sound('hurt');if(health<=0)end(false);}
function kill(w){if(w.dead)return;w.dead=12;kills++;if(phase===3&&w.side){pressure=Math.min(1.5,pressure+.15);recruit=Math.max(recruit,.5);}poseWolf(w.g,0,false);w.shadow.material=bloodMat;sound('hit');haptic('right',.3,70);}
function haptic(hand,strength,duration){const source=controllers.find(c=>c.userData.source?.handedness===hand)?.userData.source;source?.gamepad?.hapticActuators?.[0]?.pulse(strength,duration)?.catch(()=>{});}
function shoot(origin,direction,power){if(mode!=='play'||phase>=4||!hasBow||paused||totalTime-lastShot<.25)return;lastShot=totalTime;if(power>.5)taught|=4;const g=makeArrow();g.position.copy(origin);g.quaternion.setFromUnitVectors(V(0,0,-1),direction);sound('shot');scene.add(g);arrows.push({g,v:direction.clone().multiplyScalar(22+power*24),life:3});if(arrows.length>32)scene.remove(arrows.shift().g);haptic('right',.4,50);}
function release(){if(!drawing)return;drawing=false;if(draw<.12){draw=0;return;}const left=grips.find(g=>g.userData.hand==='left'),right=grips.find(g=>g.userData.hand==='right');
 if(renderer.xr.isPresenting&&left&&right){left.getWorldPosition(p0);right.getWorldPosition(p1);dir.copy(p0).sub(p1).normalize();shoot(p0,dir,draw);}else if(desktop){camera.getWorldPosition(p0);camera.getWorldDirection(dir);shoot(p0.clone().addScaledVector(dir,.5),dir,draw);}draw=0;}
function move(dx,dz){if(phase>=3)return;const x=rig.position.x+dx,z=rig.position.z+dz;
 if(world.obstacles.some(o=>Math.hypot(x-o[0],z-o[1])<o[2]+.3))return;
 rig.position.set(x,height(x,z),z);return true;
}
function teleport(x,z){if(teleportCooldown>0||mode!=='play'||paused||phase>=3)return;teleportCooldown=.35;if(desktop){$('fade').style.opacity=.75;setTimeout(()=>{$('fade').style.opacity=0;},110);}if(move(x-rig.position.x,z-rig.position.z))taught|=2;sound('step');}
if(desktop){addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;
 if(e.code==='Escape')pause(!paused);if(e.code==='KeyM')$('mute').click();if(e.code==='Enter'&&mode!=='play')start();
 if(e.code==='Space'){camera.getWorldDirection(dir);teleport(rig.position.x+dir.x*3.7,rig.position.z+dir.z*3.7);}
});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false;drawing=nockHeld=stabTracked=false;draw=0;if(!renderer.xr.isPresenting)pause(true);});
addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement&&mode==='play'&&!paused&&phase<4){yaw-=e.movementX*.002;pitch=clamp(pitch-e.movementY*.002,-1.1,1.05);}});
renderer.domElement.addEventListener('mousedown',e=>{if(e.button===0&&nextSpeech())return;if(e.button!==0||renderer.xr.isPresenting||mode!=='play'||paused||!hasBow||totalTime-lastShot<.65)return;if(document.pointerLockElement!==renderer.domElement){lock();return;}drawing=true;safeAudio();});addEventListener('mouseup',e=>{if(e.button===0&&!renderer.xr.isPresenting)release();});}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Controller sources are selected by handedness, never array order.
for(let i=0;i<2;i++){
 const controller=renderer.xr.getController(i),grip=renderer.xr.getControllerGrip(i);rig.add(controller,grip);controllers.push(controller);grips.push(grip);
 controller.addEventListener('connected',e=>{controller.userData.source=e.data;grip.userData.hand=e.data.handedness;if(e.data.handedness==='left'){grip.add(bow);bow.position.set(0,0,0);bow.rotation.set(-Math.PI/2,0,0);bow.scale.setScalar(1);}});
 controller.addEventListener('disconnected',()=>{controller.userData.source=null;grip.userData.hand='';drawing=nockHeld=stabTracked=false;draw=0;});
 controller.addEventListener('selectstart',()=>{safeAudio();if(nextSpeech())return;if(mode!=='play'){if(elapsed>2)start();return;}if(controller.userData.source?.handedness==='right'){nockHeld=hasBow;}});
 controller.addEventListener('selectend',()=>{if(controller.userData.source?.handedness==='right'){nockHeld=false;release();}});

}
// The entire welcome screen is the user gesture that requests immersive VR.
let vrReady=false,entering=false;const intro=$('intro'),launch=$('launch');
function launchReady(ok){vrReady=ok;intro.dataset.ready=+(ok||desktop);launch.textContent=ok?'Click to enter VR':desktop?'Click to play':'VR headset required';}
if(navigator.xr)navigator.xr.isSessionSupported('immersive-vr').then(launchReady).catch(()=>launchReady(false));else launchReady(false);
intro.onclick=async()=>{
 if(entering||renderer.xr.isPresenting||intro.dataset.ready!=='1')return;
 if(!vrReady){if(desktop){if(paused)pause(false);else start();}return;}
 entering=true;launchReady(vrReady);
 try{safeAudio();const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});camera.position.y=0;await renderer.xr.setSession(session);if(mode!=='play')start();else pause(false);if(desktop)$('aim').style.display='none';panel.visible=true;intro.style.display='none';if(desktop)$('hud').style.display='none';}
 catch{launch.textContent='VR unavailable — click to retry';}finally{entering=false;}
};
intro.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();intro.click();}};
renderer.xr.addEventListener('sessionend',()=>{if(desktop){camera.position.set(0,1.7,0);camera.add(bow);bow.position.set(.36,-.29,-.67);bow.rotation.set(.12,.35,-.95);bow.scale.setScalar(.82);if(desktop)$('hud').style.display='block';}panel.visible=false;drawing=false;pause(true);});
function updateXR(dt){
 const left=grips.find(g=>g.userData.hand==='left'),right=grips.find(g=>g.userData.hand==='right');
 if(left&&right){if(nockHeld&&!drawing&&!paused&&left.getWorldPosition(p0).distanceTo(right.getWorldPosition(p1))<.25){drawing=true;draw=0;nockDistance=Math.max(.12,p0.distanceTo(p1));fullDraw=false;haptic('right',.2,35);}if(drawing){left.getWorldPosition(p0);right.getWorldPosition(p1);draw=clamp((p0.distanceTo(p1)-nockDistance)/.6);aimQuaternion.setFromUnitVectors(up.set(0,0,-1),dir.copy(p0).sub(p1).normalize());if(draw>=.98&&!fullDraw){haptic('right',.7,100);fullDraw=true;}if(draw<.9)fullDraw=false;}else bow.rotation.set(-Math.PI/2,0,0);}
 const walk=controllers.find(c=>c.userData.source?.handedness==='left')?.userData.source?.gamepad;
 if(walk){const a=walk.axes,x=a[a.length-2]||0,z=a[a.length-1]||0;if(Math.hypot(x,z)>.18){camera.getWorldDirection(dir);dir.y=0;dir.normalize();const speed=(drawing?1.1:2.8)*dt;if(move((-dir.z*x-dir.x*z)*speed,(dir.x*x-dir.z*z)*speed))walked+=speed*Math.hypot(x,z);}}
 let axis=0,forward=0;const source=controllers.find(c=>c.userData.source?.handedness==='right')?.userData.source;
 if(source?.gamepad){const a=source.gamepad.axes;axis=a[a.length-2]||0;forward=a[a.length-1]||0;}
 if(Math.abs(axis)>.7&&snapReady){rig.rotation.y-=Math.sign(axis)*Math.PI/6;snapReady=false;}if(Math.abs(axis)<.3)snapReady=true;
 teleRing.visible=false;
 if(forward<-.55&&!(phase>=3)){const ctrl=controllers.find(c=>c.userData.source?.handedness==='right');if(ctrl){ctrl.getWorldPosition(p0);ctrl.getWorldQuaternion(q);dir.set(0,0,-1).applyQuaternion(q);const distance=clamp(3+dir.y*4,1.5,5);dir.y=0;dir.normalize();telePoint.set(rig.position.x+dir.x*distance,0,rig.position.z+dir.z*distance);telePoint.y=height(telePoint.x,telePoint.z)+.04;teleRing.position.copy(telePoint);teleRing.visible=true;teleReady=false;}}
 else if(!teleReady){teleport(telePoint.x,telePoint.z);teleReady=true;}
}
function updatePanel(ms){
 if(ms-panelStamp<33)return;panelStamp=ms;
 // Title/pause are hidden below; end screens take precedence in drawGuide.
 tutorial=renderer.xr.isPresenting&&!briefed?0:-1;
 panelTarget=tutorial>=0||speech>0||thought>0||mode==='win'||mode==='lose';
 if(mode==='title'||paused){panelTarget=false;ctx.clearRect(0,0,768,256);panelTexture.needsUpdate=true;return;}
 if(tutorial!==panelLesson){panelLesson=tutorial;lessonStart=ms;}
 drawGuide(ctx,ms-lessonStart,tutorial,phase,health,thought>0?-thought:speech,mode,panelOpen);panelTexture.needsUpdate=true;
}
// Rider position follows the saddle; head and bow aim remain independent.
function updateRide(dt){
 const limit=phase===3?17:42,moving=unicorn.position.z<limit&&(phase>=4||elapsed>1.2);
 if(moving){
  const z=unicorn.position.z,site=clearings[sanctuary],dx=(rideX(z+.1,site)-rideX(z,site))/.1;
  const next=Math.min(limit,z+2.35*dt/Math.hypot(dx,1));
  unicorn.position.set(rideX(next,site),height(rideX(next,site),next),next);unicorn.rotation.y=Math.atan2(-dx,-1);
  foot+=dt;if(foot>.22){sound('step');foot=0;}
  if(phase===3&&next>=site[1]+24&&next< -12)updateHunt(dt);
 }
 poseUnicorn(unicorn,0,totalTime*1.65,moving);
 if(phase===3){
  rideLift=Math.min(1.75,rideLift+dt*1.1);
  p0.copy(rideOffset).applyQuaternion(rig.quaternion);rig.position.copy(unicorn.position).sub(p0);rig.position.y+=rideLift;
  if(unicorn.position.z>=17){
   setPhase(4);hasBow=drawing=nockHeld=false;draw=speech=thought=0;
   // Capture the head offset once; subsequent tracked head movement stays free.
   rideOffset.copy(camera.position).setY(0);p0.copy(rideOffset).applyQuaternion(rig.quaternion);exitFrom.copy(rig.position).add(p0);exitYaw=rig.rotation.y;
   camera.getWorldDirection(dir);const turn=Math.atan2(dir.x,-dir.z)-Math.atan2(-2.4,3);exitTurn=Math.atan2(Math.sin(turn),Math.cos(turn));
   world.shaman.rotation.y=Math.atan2(-2.4,-3);
  }
 }else if(phase===4){
  const down=clamp(elapsed/1.4),turn=clamp((elapsed-1.4)/1.1);
  rideLift=1.75*(1-down);rig.rotation.y=exitYaw+exitTurn*turn*turn*(3-2*turn);
  rig.position.lerpVectors(exitFrom,p1.set(2.4,height(2.4,18),18),down*down*(3-2*down));p0.copy(rideOffset).applyQuaternion(rig.quaternion);rig.position.sub(p0);
  if(elapsed>=2.5){setPhase(5);speech=30;}
 }else if(elapsed>=8.5)end(true);
}
// Ten persistent slots; newcomers run in from a fixed radius over about ten seconds.
function joinPack(slot,w){
 const side=slot<5?-1:1;
 if(!w){const angle=unicorn.rotation.y-side*(.18+slot%5*.04);w=spawn(unicorn.position.x+Math.sin(angle)*28,unicorn.position.z+Math.cos(angle)*28);w.rejoin=10;}
 w.side=side;w.slot=slot;w.ambush=w.charging=false;
}
function updateHunt(dt){
 if(!hunt){
  hunt=true;nextAmbush=4;
  const alive=wolves.filter(w=>!w.dead);
  for(let i=0;i<10;i++)joinPack(i,alive[i]);
 }
 pressure=Math.max(0,pressure-dt*.08);recruit-=dt;nextAmbush-=dt;
 if(recruit<=0){
  for(let i=0;i<10;i++)if(!wolves.some(w=>!w.dead&&w.slot===i)){joinPack(i);recruit=.5+pressure;break;}
 }
 if(nextAmbush<=0){
  const ready=wolves.filter(w=>!w.dead&&w.side&&!w.rejoin&&!w.ambush&&!w.pause&&w.g.position.distanceTo(unicorn.position)<11);
  if(ready.length&&wolves.filter(w=>!w.dead&&w.ambush).length<2){ready[random()*ready.length|0].ambush=true;nextAmbush=4+random()*3;}
 }
}
function mount(){
 setPhase(3);sound('magic');rideOffset.copy(camera.position).setY(0);unicorn.rotation.y=Math.PI;rideLift=0;wolfAlert=0;drawing=nockHeld=false;draw=0;teleReady=true;teleRing.visible=false;
 if(renderer.xr.isPresenting){camera.getWorldDirection(dir);rig.rotation.y+=Math.PI+Math.atan2(dir.x,-dir.z);}else if(desktop)yaw=Math.PI;
 rig.position.copy(unicorn.position);
}
function updateGame(dt){
 elapsed+=dt;totalTime+=dt;thought-=dt;teleportCooldown-=dt;
 if(phase<4){if(renderer.xr.isPresenting)updateXR(dt);else if(desktop){
  camera.rotation.set(pitch,yaw,0,'YXZ');let dx=(keys.KeyD?1:0)-(keys.KeyA||keys.KeyQ?1:0),dz=(keys.KeyS?1:0)-(keys.KeyW||keys.KeyZ?1:0);if(dx||dz){const len=Math.hypot(dx,dz);dx/=len;dz/=len;const speed=(drawing?1.1:3.3)*dt;if(move((dx*Math.cos(yaw)+dz*Math.sin(yaw))*speed,(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*speed))walked+=speed;foot+=dt;if(foot>.48){sound('step');foot=0;}}
  if(drawing)draw=clamp(draw+dt*1.7);
 }}
 // A soft boundary returns to the trail without skipping north/south progress.
 const z=rig.position.z,d=Math.abs(rig.position.x-pathX(z));
 scene.fog.density=.023+Math.max(0,d-24,z-40,-z-190)*.003;
 if(d>36||z>52||z< -205){teleportCooldown=0;const safeZ=clamp(z,-195,42);teleport(pathX(safeZ),safeZ);thought=4;}
 if(walked>1.2)taught|=1;
 const distance=rig.position.distanceTo(unicorn.position);
 if(phase===0&&!briefed&&rig.position.distanceTo(world.shaman.position)<4){briefed=true;speech=15;}
 if(phase===1){
  if(encounters<3&&rig.position.z<[-15,-58,-96][encounters]){pack(2+encounters);encounters++;}
  if(distance<3.8){setPhase(2);sound('magic');burst(unicorn.position,20,true);}
 }
 if(phase===2){prone=Math.max(0,prone-dt*.7);if(prone===0)mount();}
 if(phase>=3&&phase<=5)updateRide(dt);else poseUnicorn(unicorn,prone,totalTime,0);
 for(let i=wolves.length-1;i>=0;i--){const w=wolves[i];if(w.dead){w.dead-=dt;const fall=clamp((12-w.dead)*2.5);w.g.rotation.z=fall*Math.PI/2;w.g.position.y=height(w.g.position.x,w.g.position.z)+fall*.22;w.g.visible=w.shadow.visible=w.dead>2||(w.dead*8|0)%2===0;w.shadow.scale.set(.65*fall,1,.45*fall);if(w.dead<=0){scene.remove(w.g,w.shadow);wolves.splice(i,1);}continue;}
  const fleeing=phase>=4||phase===3&&unicorn.position.z>=-12;
  if(w.pause&&!fleeing){w.pause=Math.max(0,w.pause-dt);poseWolf(w.g,totalTime+w.seed,0,clamp((w.pause-3.05)/.45)**2);w.shadow.position.set(w.g.position.x,height(w.g.position.x,w.g.position.z)+.035,w.g.position.z);w.shadow.scale.set(.55,1,.9);continue;}
  const target=phase>=3?unicorn.position:rig.position;dir.copy(target).sub(w.g.position);dir.y=0;const d=dir.length();
  let circling=false,following=phase===3&&w.side&&!w.ambush;
  if(fleeing){w.pause=0;w.charging=w.ambush=false;dir.set((w.side||Math.sign(w.g.position.x-target.x)||1)*.8,0,-1);}
  else if(following){
   const z=target.z+(w.slot%5-2)*1.7+Math.sin(totalTime*.45+w.seed)*2.3;
   dir.set(pathX(z)+w.side*(5+(w.slot%2)*1.5)-w.g.position.x,0,z-w.g.position.z);
   if(w.rejoin)w.rejoin=dir.length()<1.5?0:Math.max(.25,w.rejoin-dt);
  }else if(phase===3){
   const angle=Math.atan2(dir.x,dir.z)-unicorn.rotation.y;
   const relative=Math.atan2(Math.sin(angle),Math.cos(angle));
   // A charge that falls behind must stage again; it cannot bite from the rear.
   if(Math.abs(relative)>Math.PI/4){if(w.charging&&w.side)w.ambush=false;w.charging=false;}
   if(!w.charging){
    const aim=(w.seed/5-1)*Math.PI/9,delta=aim-relative;
    if(d>=14.5&&d<=15.5&&Math.abs(delta)<.045)w.charging=true;
    else{
     circling=true;
     // First open the radius, then follow the outside arc around the moving rider.
     const next=unicorn.rotation.y+relative+(d>12?clamp(delta,-dt*.55,dt*.55):0);
     dir.set(target.x-Math.sin(next)*15-w.g.position.x,0,target.z-Math.cos(next)*15-w.g.position.z);
    }
   }
  }
  const step=Math.min(fleeing?100:dir.length(),dt*(fleeing?7:following?(w.rejoin?Math.min(7,2.35+dir.length()/w.rejoin):dir.length()>7?5:3.3):circling?10:phase>=3?6.8+w.seed*.12:w.speed));
  dir.normalize();w.g.rotation.y=Math.atan2(-dir.x,-dir.z);w.attack-=dt;
  if(fleeing||following||circling||d>1.25){w.g.position.addScaledVector(dir,step);w.g.position.y=height(w.g.position.x,w.g.position.z);}else if(w.attack<=0){hurt(15);w.attack=0;w.pause=3.5;w.charging=false;if(w.side)w.ambush=false;if(mode!=='play')break;}
  if(phase===3)for(const other of wolves)if(other!==w&&!other.dead&&w.g.position.distanceTo(other.g.position)<1.1){p0.copy(w.g.position).sub(other.g.position).setY(0).normalize();w.g.position.addScaledVector(p0,dt*3);}
  poseWolf(w.g,totalTime+w.seed,d>1.25?1:0,w.pause?1:0);w.shadow.position.set(w.g.position.x,height(w.g.position.x,w.g.position.z)+.035,w.g.position.z);w.shadow.scale.set(.55,1,.9);
 }
 wolfAlert=0;
 if(phase===3&&unicorn.position.z< -12){camera.getWorldDirection(dir);p1.set(-dir.z,0,dir.x);let nearest=12;for(const w of wolves)if(!w.dead){p0.copy(w.g.position).sub(unicorn.position);const d=p0.length();if(d<nearest&&Math.abs(p0.dot(p1))>.2){nearest=d;wolfAlert=Math.sign(p0.dot(p1));}}}
 leftAlert.visible=wolfAlert<0;rightAlert.visible=wolfAlert>0;
 // A null velocity keeps an embedded arrow fixed until restart or the 32-arrow cap.
 for(let i=arrows.length-1;i>=0;i--){const a=arrows[i];if(!a.v)continue;p0.copy(a.g.position);a.v.y-=dt*3;a.g.position.addScaledVector(a.v,dt);a.g.quaternion.setFromUnitVectors(V(0,0,-1),dir.copy(a.v).normalize());a.life-=dt;
  // Include the tip in the sweep, then keep the shaft outside the struck surface.
  arrowRay.set(p0,dir);arrowRay.far=p0.distanceTo(a.g.position)+.5;
  const impact=arrowRay.intersectObjects(world.colliders,false)[0];
  if(impact){a.g.position.copy(impact.point);a.v=null;}
  let hit=false;
  for(const w of wolves){if(w.dead||!touches(p0,a.g.position,w))continue;hit=true;w.hp--;if(w.hp<=0)kill(w);else{sound('hit');burst(w.g.position,5);}a.life=0;break;}
  if(a.life<=0){if(!hit)misses++;scene.remove(a.g);arrows.splice(i,1);}
  else if(impact){a.g.position.addScaledVector(dir,-.42);misses++;}
 }
 if(health<=0)return;
 audioMood(phase>=2?.8:wolves.some(w=>!w.dead)?.55:.12);
}
let lastFrameReal=0;function frame(ms,xrFrame){const dt=Math.min(.04,(ms-lastFrame)/1000||.016);lastFrame=ms;frameCount++;frameTotal+=(ms-lastFrameReal)/1000||.016;lastFrameReal=ms;
 // Refresh the rig's camera from the tracked pose: Three's render camera is in
 // reference-space coordinates here, until its later render-time update.
 if(xrFrame){const pose=xrFrame.getViewerPose(renderer.xr.getReferenceSpace());if(pose){camera.position.copy(pose.transform.position);camera.quaternion.copy(pose.transform.orientation);if(spawnPending){dir.set(0,0,-1).applyQuaternion(camera.quaternion);rig.rotation.y=Math.atan2(dir.x,-dir.z);p0.copy(camera.position).applyAxisAngle(up.set(0,1,0),rig.rotation.y);rig.position.set(pathX(28)-p0.x,height(pathX(28),28),28-p0.z);spawnPending=false;}}}
 if(mode==='play'&&!paused)updateGame(dt);else{if(!paused)elapsed+=dt;poseUnicorn(unicorn,mode==='title'?1:prone,ms/1000,0);audioMood(mode==='win'?.15:0);}
 damageFlash=Math.max(0,damageFlash-dt);const fade=phase===5&&mode==='play'?clamp((elapsed-6.5)/2):0;damageBorder.material.uniforms.fade.value=fade;if(desktop)$('hud').style.opacity=1-fade;damageBorder.visible=mode==='play'&&!paused&&(damageFlash>0||fade>0);damageBorder.material.uniforms.strength.value=.22*damageFlash/.45;
 const now=ms/1000;if(speech>0&&!paused){const before=speech*8|0;speech=Math.max(0,speech-dt);if((speech*8|0)!==before&&dialogue(speech)!==dialogue(speech+.125))sound('talk');world.shaman.rotation.z=Math.sin(speech*20)*.02;}
 world.marker.visible=mode==='play'&&!briefed;world.marker.position.y=2.5+Math.sin(now*3)*.08;
 if(mode==='play'&&phase===0&&briefed&&!hasBow&&speech<=0){hasBow=true;setPhase(1);sound('magic');haptic('left',.5,100);}
 bow.visible=hasBow&&mode==='play';setBowDraw(bow,drawing?draw:0);nocked.visible=bow.visible&&!paused;
 // Desktop replacement arrow sweeps into the bow over the same interval that
 // blocks a new draw. The existing game clock freezes this gesture on pause.
 if(nocked.visible){const reload=desktop&&!renderer.xr.isPresenting?clamp(1-(totalTime-lastShot)/.65)**2:0,right=grips.find(g=>g.userData.hand==='right');if(renderer.xr.isPresenting&&right){right.getWorldPosition(p0);if(drawing){q.copy(aimQuaternion);p1.copy(p0);bow.worldToLocal(p1);const attr=bow.userData.string.geometry.attributes.position;attr.setXYZ(1,p1.x,p1.y,p1.z);attr.needsUpdate=true;}else right.getWorldQuaternion(q);nocked.position.copy(p0).add(V(0,0,-.42).applyQuaternion(q));}else{bow.getWorldPosition(p0);bow.getWorldQuaternion(q);nocked.position.copy(p0).add(V(-reload*.6,-reload*.2,-.16+draw*.3+reload*.2).applyQuaternion(q));}nocked.quaternion.copy(q);if(desktop)nocked.rotateY(reload);if(renderer.xr.isPresenting&&right?.visible&&!drawing)stab(right,dt);else stabTracked=false;}
 if(desktop&&!renderer.xr.isPresenting){$('charge').style.display=drawing?'block':'none';$('charge').style.width=(10+draw*45)+'px';}
 blessing.position.copy(unicorn.position).add(V(1,2,2));unicornShadow.position.set(unicorn.position.x,height(unicorn.position.x,unicorn.position.z)+.03,unicorn.position.z);
 for(let i=0;i<particles.length;i++){const o=particles[i];if(o.life>0){o.life-=dt;o.p.addScaledVector(o.v,dt);o.v.y-=dt*(o.magic?.2:4);mtmp.position.copy(o.p);mtmp.scale.setScalar(Math.max(0,o.life));}else if(i<35){mtmp.position.set(rig.position.x+Math.sin(i*4.8+now*.12)*7,rig.position.y+1+Math.sin(now*.5+i)*.7,rig.position.z-3+Math.cos(i*2.3+now*.09)*8);mtmp.scale.setScalar(.15+.16*Math.sin(now+i));}else if(i<48){mtmp.position.fromBufferAttribute(world.rainbow.children[3].geometry.attributes.position,((i-35)*64/12|0)*2);world.rainbow.localToWorld(mtmp.position);mtmp.scale.setScalar((2+8*Math.max(0,Math.sin(now*1.4+i*1.7))**8)*Math.min(1,(i-35)/5));}else mtmp.scale.setScalar(0);mtmp.updateMatrix();motes.setMatrixAt(i,mtmp.matrix);}motes.instanceMatrix.needsUpdate=true;
 world.rainbow.children.forEach((m,i)=>m.material.opacity=.65+Math.sin(now*1.7+i*.4)*.08);
 if(mode==='play')world.rainbow.rotation.y=Math.atan2(rig.position.x-world.rainbow.position.x,rig.position.z-world.rainbow.position.z);
 panelOpen+=(+panelTarget-panelOpen)*(1-Math.exp(-dt*8));panel.position.y=mode==='lose'||mode==='win'?0:-.55+panelOpen*.35;if(!renderer.xr.isPresenting)if(desktop)$('hud').style.bottom=mode==='lose'||mode==='win'?'calc(50% - 100px)':(20+panelOpen*innerHeight*.18)+'px';
 updatePanel(ms);renderer.initTexture(panelTexture);world.sky.position.copy(rig.position);if(world.sun.target.position.distanceTo(rig.position)>5){renderer.shadowMap.needsUpdate=true;world.sun.position.set(rig.position.x+25,35,rig.position.z+25);world.sun.target.position.copy(rig.position);}renderer.render(scene,camera);
}
// Title is a real, live view of the rescue clearing, also used for visual review.
rig.position.set(0,height(0,-43),-43);camera.rotation.set(-.05,0,0);poseUnicorn(unicorn,1,0,0);
const previewWolves=[];for(const [x,z,s] of [[-2.8,-49.5,1.3],[-8.4,-56,1]]){const w=makeWolf();w.position.set(x,height(x,z),z);w.rotation.y=-1.95;w.scale.setScalar(s);scene.add(w);previewWolves.push(w);}
renderer.setAnimationLoop(frame);
if(desktop){
 // Playtest shortcuts only: esbuild removes this entire block from the entry ZIP.
 addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  const stage=Number(e.code.replace(/^(Digit|Numpad)/,''));
  if(stage<1||stage>4||!Number.isInteger(stage))return;
  e.preventDefault();
  if(stage===4){
   if(mode==='play'&&phase===2){prone=0;mount();}
   return;
  }
  for(const key in keys)keys[key]=false;
  start();spawnPending=false;teleportCooldown=0;teleReady=true;teleRing.visible=false;
  if(stage===1)return;
  briefed=hasBow=true;encounters=stage===2?1:3;
  setPhase(1);
  const x=stage===2?pathX(-32):unicorn.position.x,z=stage===2?-32:unicorn.position.z+2.7;
  rig.position.set(x,height(x,z),z);
 });
 globalThis.torde={scene,renderer,camera,rig,unicorn,world,clearings,panel,wolves,arrows,keys,bow,nocked,grips,controllers,start:()=>{previewWolves.forEach(w=>scene.remove(w));start();},spawn,pack,shoot,kill,frame,teleRing,teleport,setPhase,release,state:()=>({rideLift,recruit,pressure,mode,phase,health,kills,misses,prone,elapsed,totalTime,position:rig.position.toArray(),draw,lastShot,paused,sanctuary,speech,thought,taught,tutorial,panelOpen,wolfAlert,hasBow,briefed,drawing,nockHeld,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,fps:frameCount/frameTotal}),
  capture:()=>{previewWolves.forEach(w=>scene.add(w));mode='title';$('intro').style.display='none';if(desktop)$('hud').style.display='none';$('mute').style.display='none';rig.position.set(0,height(0,-43),-43);camera.rotation.set(-.05,0,0);unicorn.position.set(3.2,height(3.2,-49),-49);unicorn.rotation.y=2.2;bow.visible=true;},
  place:(x,z)=>{rig.position.set(x,height(x,z),z);},aimAt:w=>{camera.getWorldPosition(p0);p1.copy(w.g.position);p1.y+=.55;camera.lookAt(p1);yaw=camera.rotation.y;pitch=camera.rotation.x;},
  set:(values)=>{if(values.phase!==undefined)setPhase(values.phase);if(values.health!==undefined)health=values.health;if(values.encounters!==undefined)encounters=values.encounters;},clear:clearActors};
}
