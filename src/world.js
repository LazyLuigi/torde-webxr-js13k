// Faceted forms batched by spatial tile so off-screen forest can be culled.
const T=globalThis.T;
let seed=713;
export function random(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;}
export const clearings=[[-23,-132],[24,-157],[-16,-181],[20,-114]];
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const pathX=z=>Math.sin(z*.075)*1.8+1.15*Math.exp(-(((z+42)/5)**2));
export const rideX=(z,p)=>pathX(z)+(p[0]-pathX(p[1]))*(1-clamp((z-p[1])/24))**2;
const rideLane=(x,z)=>clearings.some(p=>z>p[1]-3&&z<p[1]+27&&Math.abs(x-rideX(z,p))<2.4);
export function height(x,z){const d=Math.abs(x-pathX(z));return Math.sin(x*.15+z*.07)*Math.min(2.2,d*.22)+Math.cos(z*.14)*.12+clamp((-z-45)/30)*(Math.sin(x*.085+z*.065)*3.4+Math.cos(z*.11-x*.04)*1.7);}
export function makeWorld(scene){
 const pos=[],cols=[],tmp=new T.Object3D(),v=new T.Vector3(),c=new T.Color();
 // Pairs of vertex offsets select the ground, trunks and houses for arrows.
 const obstacles=[],solid=[0];
 function part(g,color,x,y,z,sx=1,sy=sx,sz=sx,ry=0){
  if(g===trunk)solid.push(pos.length);
  tmp.position.set(x,y,z);tmp.scale.set(sx,sy,sz);tmp.rotation.set(0,ry,0);tmp.updateMatrix();
  const a=g.attributes.position,idx=g.index;
  for(let i=0;i<(idx?idx.count:a.count);i++){
   if(i%3===0)c.setHex(color).multiplyScalar(.88+random()*.24);
   v.fromBufferAttribute(a,idx?idx.getX(i):i).applyMatrix4(tmp.matrix);pos.push(v.x,v.y,v.z);cols.push(c.r,c.g,c.b);
  }
  if(g===trunk)solid.push(pos.length);
 }
 const needles=[];for(let i=0;i<9;i++){const a=i*6.283/9,b=(i+1)*6.283/9,r=.85+(i%3)*.1;needles.push(Math.cos(a)*r,(i%2)*.12,Math.sin(a)*r,Math.cos(b),((i+1)%2)*.12,Math.sin(b),.13,.98,-.09);}const crown=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(needles,3));
 const cube=new T.BoxGeometry(1,1,1),cone=new T.ConeGeometry(1,1,7),trunk=new T.CylinderGeometry(.55,1,1,6),stone=new T.IcosahedronGeometry(1,0);
 // Ground vertices share height samples, while every triangle owns its color.
 for(let z=-250;z<85;z+=1.5)for(let x=-80;x<80;x+=1.5){
  const points=[[x,z],[x+1.5,z],[x,z+1.5],[x+1.5,z+1.5]],tri=[0,2,1,1,2,3];
  for(let k=0;k<6;k++){
   if(k%3===0){const d=Math.abs(x+.75-pathX(z+.75));c.setHex(z>-200&&d<(z>9?1.6:1)?0xb9a177:0x335d51).multiplyScalar(.82+random()*.32);}
   let [px,pz]=points[tri[k]];px+=Math.sin(px*12.3+pz*7.1)*.25;pz+=Math.cos(px*9.1-pz*4.3)*.25;pos.push(px,height(px,pz),pz);cols.push(c.r,c.g,c.b);
  }
 }
 solid.push(pos.length);
 function tree(x,z,size){
  if(rideLane(x,z))return;
  if(Math.abs(x)>3&&Math.abs(x)<10&&z<-54&&z>-90)x+=Math.sign(x)*5;if(x>8&&x<15&&z<-55&&z>-85)size*=.58;const y=height(x,z),h=8*size;
  part(trunk,0x62553e,x,y+h*.46,z,.37*size,h*.92,.37*size,random()*6);
  for(let j=0;j<4;j++)part(crown,j%2?0x536e49:0x61784c,x,y+h*(.5+j*.16),z,(1.9-j*.34)*size,3.9*size,(1.9-j*.34)*size,j*.7);
  if(Math.abs(x)<40&&z>-205)obstacles.push([x,z,.45*size]);
 }
 for(let i=0;i<780;i++){
  const x=(random()-.5)*88,z=-202+random()*232,d=Math.abs(x-pathX(z));
  if(d<(z>-70?5.7:2.4)||clearings.some(p=>Math.hypot(x-p[0],z-p[1])<4.5)||Math.hypot(x-3.2,z+49)<5||z>9&&Math.abs(x)<10)continue;
  tree(x,z,.65+random()*1.05);
 }
 // Lower, more distant trees frame all sides, including behind the village.
 for(let i=0;i<400;i++){const x=(random()-.5)*144,z=-235+random()*310;if(Math.abs(x)>44||z< -202||z>48||z>30&&Math.abs(x)>11)tree(x,z,.3+random()*.7);}
 // Deliberate framing at the hero clearing, and a readable opening in the middle.
 [[-6,-44,1.65],[6.9,-46,1.6],[-7,-55,1.2],[10,-56,1.3],[-10,-66,1.1]].forEach(a=>tree(...a));
 for(let i=0;i<780;i++){
  const z=-202+random()*231,x=pathX(z)+(i%2?1:-1)*(1.7+random()**2*37),d=Math.abs(x-pathX(z));
  if(rideLane(x,z)||z>9&&d<3.2||d<2.6||clearings.some(p=>Math.hypot(x-p[0],z-p[1])<2.5)||Math.hypot(x-3.2,z+49)<2.4||Math.hypot(x+2.8,z+49.5)<2.2)continue;
  const s=.22+random()**2*1.05;
  part(stone,i%3?0x526654:0x72814e,x,height(x,z)+s*.3,z,s,s*.67,s*.85,random()*6);
 }
 // Four blades, eight triangles, varied as clusters: no transparent grass cards.
 const gp=[];
 for(let j=0;j<4;j++){const a=j*2.4,dx=Math.cos(a)*.3,dz=Math.sin(a)*.3;gp.push(dx,0,dz,dx+.22,0,dz+.16,dx*.7,.22+j*.035,dz*.7);}
 const grass=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(gp,3));
 for(let i=0;i<5400;i++){
  const z=-202+random()*231,x=pathX(z)+(i%2?1:-1)*(1.5+random()**2*39);
  if(rideLane(x,z)||z>9&&Math.abs(x-pathX(z))<2.4||Math.abs(x-pathX(z))<1.35||Math.hypot(x-3.2,z+49)<1.8)continue;
  part(grass,i%4?0x577747:0x9d9f42,x,height(x,z)+.02,z,.25+random()*.55);
 }
 // Fern fronds: folded triangles provide a different silhouette to the pines.
 const fp=[];
 for(let a=0;a<6;a++)for(let j=1;j<6;j++){
  const angle=a*Math.PI/3,u=j/6,reach=u*.8,y=Math.sin(u*2.3)*.55,wide=(1-u)*.26;
  for(let sign of [-1,1])for(const [r,s,yy] of [[reach-.12,0,y-.04],[reach+.12,0,y],[reach+.03,sign*wide,y+.06]])fp.push(Math.cos(angle)*r-Math.sin(angle)*s,yy,Math.sin(angle)*r+Math.cos(angle)*s);
 }
 const fern=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(fp,3));
 for(let i=0;i<240;i++){const z=-202+random()*231,x=pathX(z)+(i%2?1:-1)*(2.9+random()*30);if(z>9&&Math.abs(x-pathX(z))<3.4)continue;part(fern,0x7b984c,x,height(x,z)+.04,z,.65+random()*.7);}
 // Mountain skyline: untextured sculpted ridges with pale caps.
 const bgStart=pos.length;const ridge=[];for(let j=0;j<6;j++)for(let i=0;i<23;i++){
  const xx=-115+i*10,zz=-235-j*13;
  for(const [di,dj] of [[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]]){const x=xx+di*10,z=zz-dj*13,level=j+dj;const y=level===0?-2:([8,14,23,18,27,32,41,35,44,50,39,30,35,27,43,29,20,26,19,27,14,11,8,6][i+di])*Math.sin(level/6*Math.PI)+2;ridge.push(x,y,z);}
 }
 const rg=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(ridge,3));part(rg,0x608da5,0,0,0);
 // Snow is the color of the mountain face itself, never an overlapping shell.
 for(let i=bgStart;i<pos.length;i+=9)if(Math.max(pos[i+1],pos[i+4],pos[i+7])>40){
  c.setHex(0xc9d4ca).multiplyScalar(.88+random()*.24);for(let j=0;j<9;j+=3)c.toArray(cols,i+j);
 }
 const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(pos.splice(bgStart),3));bg.setAttribute('color',new T.Float32BufferAttribute(cols.splice(bgStart),3));bg.computeVertexNormals();scene.add(new T.Mesh(bg,new T.MeshLambertMaterial({vertexColors:true,fog:false,side:T.DoubleSide})));
 function hut(x,z){
  solid.push(pos.length);
  const y=height(x,z);
  obstacles.push([x,z,2]);
  part(cube,0x66513b,x,y+1.05,z,3,2.1,3.5);
  part(new T.ConeGeometry(1,1,4),0x394e43,x,y+2.9,z,3,2,3.6,Math.PI/4);
  for(let side of [-1,1])part(cube,0x342e29,x+side*1.45,y+1.1,z-1.78,.15,2.2,.18);
  part(cube,0x262e2d,x,y+.8,z-1.77,.9,1.6,.05);
  part(cube,0xefb968,x+1,y+1.2,z-1.79,.45,.55,.06);
  solid.push(pos.length);
 }
 for(let i=0;i<6;i++)hut(i%2?6:-6,16+(i/2|0)*12);
 for(let i=0;i<10;i++){const x=i%2?-3.6:3.6,z=11+Math.floor(i/2)*3;part(trunk,0x705339,x,height(x,z)+.65,z,.14,1.3,.14);}
 // The shaman is a readable silhouette with cloak, beard, staff, and luminous stone.
 const shaman=new T.Group();shaman.position.set(0,height(0,15),15);scene.add(shaman);
 const mk=(g,color,x,y,z,sx,sy,sz)=>{const m=new T.Mesh(g,new T.MeshLambertMaterial({color}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);shaman.add(m);return m;};
 mk(cone,0x45596b,0,.65,0,.5,1.35,.4);mk(stone,0xc8b79a,0,1.48,0,.23,.3,.23);mk(cone,0xd3d5b8,0,1.1,-.2,.18,.5,.15).rotation.x=Math.PI;
 mk(trunk,0x725639,.65,.95,0,.045,1.9,.045);mk(stone,0xffd38b,.65,1.99,0,.12,.17,.12);
 const marker=new T.Group(),markerMat=new T.MeshBasicMaterial({color:0xffdf88,fog:false});
 const point=new T.Mesh(new T.ConeGeometry(.16,.23,4),markerMat);point.rotation.z=Math.PI;marker.add(point);
 const stem=new T.Mesh(new T.BoxGeometry(.08,.22,.08),markerMat);stem.position.y=.2;marker.add(stem);marker.position.y=2.5;marker.visible=false;shaman.add(marker);
 // A single world-sized mesh made every head turn submit the entire forest.
 // Tile triangles without moving vertices or changing their authored colors.
 // Collision indices share the visible vertices; foliage stays permeable.
 const tiles={},colliders=[],scenery=new T.Group(),material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 let range=0;
 for(let i=0;i<pos.length;i+=9){
  while(i>=solid[range])range++;
  const key=Math.floor((pos[i]+pos[i+3]+pos[i+6])/96)+8*Math.floor((pos[i+2]+pos[i+5]+pos[i+8])/96);
  const tile=tiles[key] ||= [[],[],[]];tile[0].push(...pos.slice(i,i+9));tile[1].push(...cols.slice(i,i+9));
  if(range%2){const n=tile[0].length/3;tile[2].push(n-3,n-2,n-1);}
 }
 for(const [p,c,s] of Object.values(tiles)){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;scenery.add(m);
  const collision=new T.BufferGeometry().setAttribute('position',g.attributes.position).setIndex(s);collision.computeBoundingBox();colliders.push(new T.Mesh(collision,material));
 }
 scene.add(scenery);
 // Sky gradient and sun: one pass, no postprocessing, no downloaded image.
 const sky=new T.Mesh(new T.SphereGeometry(340,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;void main(){vec3 d=normalize(p);float h=max(0.,d.y);vec3 col=mix(vec3(.43,.62,.69),vec3(.16,.37,.62),smoothstep(0.,.8,h));float s=pow(max(0.,dot(d,normalize(vec3(.65,.38,-.7)))),5.);col=mix(col,vec3(1.,.76,.4),s*.75);float sun=smoothstep(.998,.999,dot(d,normalize(vec3(.65,.38,-.7))));gl_FragColor=vec4(mix(col,vec3(1.,.91,.65),sun),1.);#include <colorspace_fragment>}'.replace(';#',';\n#')}));sky.renderOrder=-10;scene.add(sky);const sunDisc=new T.Mesh(new T.SphereGeometry(4,12,8),new T.MeshBasicMaterial({color:0xffebba,fog:false}));sunDisc.position.set(78,84,-279);scene.add(sunDisc);
 // A distant luminous landmark: no fog/LOD fading, with normal terrain/forest occlusion.
 const rainbow=new T.Group();const palette=[0xff657d,0xffb15b,0xffe983,0x9be49b,0x75deeb,0x829aff,0xca8cff];
 for(let b=0;b<7;b++){
  const vertices=[],indices=[],colors=[],r=45+b*.55;
  for(let i=0;i<=64;i++){const a=-Math.PI/4+i/64*Math.PI*.75;for(const rad of [r,r+.55]){vertices.push((Math.sin(a)*(rad+6)-52.925)*2.2,Math.cos(a)*rad*3,0);colors.push(1,1,1,Math.min(1,i/24));}if(i<64){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const arc=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3)).setAttribute('color',new T.Float32BufferAttribute(colors,4)).setIndex(indices);
  const band=new T.Mesh(arc,new T.MeshBasicMaterial({color:palette[b],vertexColors:true,transparent:true,opacity:.5,depthWrite:false,toneMapped:false,side:T.DoubleSide,fog:false}));band.frustumCulled=false;band.renderOrder=5;rainbow.add(band);
 }
 rainbow.position.set(30.925,-13,-91);scene.add(rainbow);
 const sun=new T.DirectionalLight(0xffd69a,3);sun.position.set(30,35,-10);sun.target.position.set(0,0,-50);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:100});sun.shadow.bias=-.0002;sun.shadow.normalBias=.06;scene.add(sun,sun.target);scene.add(new T.HemisphereLight(0xa4cddd,0x627c6d,1.7));
 return {obstacles,shaman,marker,rainbow,scenery,colliders,sky,sun};
}
