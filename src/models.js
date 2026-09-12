import {clamp} from './world.js';
// Authored cross-sections, shared between every instance; no downloaded assets.
// Cache IDs: 0–7 leg parts, 8–15 unicorn, 16–22 wolf, 23–24 bow.
const T = globalThis.T, cache = {}, materials = {};
const mat = color => materials[color] ||= new T.MeshStandardMaterial({color, roughness:.87, flatShading:true});
const ivory = mat(0xe9dfc1), mane = mat(0xffe6a0), hoof = mat(0x666770), dark = mat(0x16252c), fur = mat(0x344752), muzzle = mat(0x74817d), gold = mat(0xffc65b);
const v = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const group = parent => { const g=new T.Group(); parent?.add(g); return g; };
function mesh(parent,geometry,material){ const m=new T.Mesh(geometry,material); parent.add(m); m.castShadow=false; m.receiveShadow=true; return m; }
// One draw for the static anatomy, regardless of its number of colored facets.
function batch(parent,key){
  const parts=parent.children.filter(o=>o.isMesh);
  if(!cache[key]){
    const p=[],n=[],c=[],point=v(),normal=v(),nm=new T.Matrix3();
    for(const m of parts){m.updateMatrix();nm.getNormalMatrix(m.matrix);const g=m.geometry,a=g.attributes;
      for(let i=0;i<(g.index?.count||a.position.count);i++){
        const k=g.index?g.index.getX(i):i;
        point.fromBufferAttribute(a.position,k).applyMatrix4(m.matrix);normal.fromBufferAttribute(a.normal,k).applyMatrix3(nm).normalize();
        p.push(...point.toArray());n.push(...normal.toArray());c.push(...m.material.color.toArray().map(x=>x*(.94+(i/3|0)%3*.03)));
      }
    }
    const g=new T.BufferGeometry();for(const [name,data] of [['position',p],['normal',n],['color',c]])g.setAttribute(name,new T.Float32BufferAttribute(data,3));cache[key]=g;
  }
  for(const m of parts)parent.remove(m);
  mesh(parent,cache[key],materials.facets ||= new T.MeshStandardMaterial({vertexColors:true,roughness:.87,flatShading:true}));
}

// A ring is [height, depth, half-width, half-thickness]. Its plane follows
// the spine tangent, so the same small loft describes a flank, muzzle or leg.
function loft(key,rings,sides=8){
  if(cache[key]) return cache[key];
  const pos=[], indices=[];
  rings.forEach((r,i)=>{
    const a=rings[Math.max(0,i-1)],b=rings[Math.min(rings.length-1,i+1)],dy=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dy,dz)||1;
    for(let j=0;j<sides;j++){
      const t=(j+.5+i%2*.12)*Math.PI*2/sides,s=Math.sin(t)*r[3];
      pos.push(Math.cos(t)*r[2],r[0]-dz/len*s,r[1]+dy/len*s);
      if(i){ const p=(i-1)*sides+j,q=(i-1)*sides+(j+1)%sides; indices.push(p,p+sides,q,q,p+sides,q+sides); }
    }
  });
  for(let j=1;j<sides-1;j++){indices.push(0,j,j+1);const n=(rings.length-1)*sides;indices.push(n,n+j+1,n+j);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return cache[key]=flat;
}
function shape(parent,key,rings,material,sides=8){return mesh(parent,loft(key,rings,sides),material);}
function spike(parent,a,b,r,material){
  const d=v(...b).sub(v(...a)),m=mesh(parent,cache.cone ||= new T.ConeGeometry(1,1,5),material);
  m.position.copy(v(...a).addScaledVector(d,.5));m.scale.set(r,d.length(),r);m.quaternion.setFromUnitVectors(v(0,1),d.normalize());return m;
}
function eye(parent,x,y,z,scale,material=dark){const m=mesh(parent,cache.eye ||= new T.IcosahedronGeometry(1,0),material);m.position.set(x,y,z);m.scale.set(scale*.65,scale,scale*1.3);return m;}

function leg(parent,x,z,horse,back){
  const hip=group(parent);hip.position.set(x,horse?1.03:.577,z);
  const length=horse?.46:.24,r=horse?.08:.065;
  shape(hip,+horse,[[0,0,r*1.5,r*1.7],[-length*.5,.025,r,r],[-length,0,r*.65,r*.7]],horse?ivory:fur,6);
  const knee=group(hip);knee.position.y=-length;
  shape(knee,2+horse,[[0,0,r*.72,r*.75],[-length*.8,0,r*.48,r*.55],[-length,.025,r*.65,r*.7]],horse?ivory:fur,6);
  const foot=shape(knee,4+horse,[[-length+.015,.045,r*.9,r*.7],[-length-.035,-.025,r,r],[-length-.035,-.11,r*.8,r*.6]],horse?hoof:muzzle,6);
  batch(knee,6+horse);
  hip.userData={knee,back};return hip;
}

export function makeUnicorn(){
  const root=group(),body=group(root);
  shape(body,8,[[1.08,.88,.15,.2],[1.13,.59,.32,.34],[1.08,.25,.36,.32],[1.05,-.08,.35,.38],[1.13,-.42,.31,.38],[1.18,-.66,.22,.25]],ivory);
  shape(body,9,[[1.04,-.43,.29,.39],[1.37,-.63,.26,.39],[1.68,-.83,.19,.29],[1.78,-.95,.16,.19]],ivory);
  const head=group(body);
  shape(head,10,[[1.76,-.86,.14,.17],[1.79,-1.04,.18,.22],[1.61,-1.27,.12,.14],[1.52,-1.46,.11,.105]],ivory);
  shape(head,11,[[1.54,-1.44,.108,.095],[1.515,-1.49,.1,.075]],mat(0xbdb6a3),6);
  for(const s of [-1,1]){
    const ear=shape(head,12,[[0,0,.068,.055],[.11,.015,.046,.025],[.205,-.01,.005,.008]],ivory,5);ear.position.set(s*.115,1.89,-.92);ear.rotation.z=-s*.2;
    eye(head,s*.162,1.795,-1.084,.037);
    eye(head,s*.088,1.535,-1.455,.02);
    spike(head,[s*.155,1.845,-1.15],[s*.17,1.845,-1.03],.03,ivory);
  }
  spike(head,[0,1.88,-1.04],[0,2.24,-1.38],.052,gold);
  for(let i=0;i<7;i++){
    const y=1.86-i*.105,z=-.74+i*.075;
    spike(body,[0,y,z],[0,y-.045,z+.46-i*.01],.13-i*.004,mane);
  }
  const tail=group(body);
  tail.position.set(0,1.17,.75);
  shape(tail,13,[[0,0,.1,.12],[-.24,.25,.085,.1],[-.6,.35,.12,.13],[-.91,.55,.15,.07],[-.95,.82,.01,.02]],mane,6);
  const legs=[];for(const z of [-.48,.59])for(const x of [-.22,.22])legs.push(leg(body,x,z,true,z>0));
  batch(body,14);batch(head,15);
  root.userData={body,head,tail,legs};return root;
}

export function poseUnicorn(root,prone=0,time=0,moving=false){
  const d=root.userData,p=clamp(prone),walk=moving?1:0;
  d.body.position.y=-.62*p+Math.sin(time*8)*.025*walk*(1-p);
  d.body.rotation.z=Math.sin(time*1.5)*.012;
  d.head.rotation.x=Math.sin(time*2)*.018;
  d.tail.rotation.z=Math.sin(time*2.3)*.11;
  d.tail.rotation.x=-p*.85;
  d.legs.forEach((l,i)=>{
    const w=Math.sin(time*8+(i===0||i===3?0:Math.PI))*.48*walk*(1-p);
    l.rotation.x=w+p*(l.userData.back?-1.3:1.34);
    l.userData.knee.rotation.x=Math.max(0,-w)*.8+p*(l.userData.back?2.7:-2.68);
  });
}

export function makeWolf(){
  const root=group(),body=group(root);
  shape(body,16,[[.59,.6,.075,.12],[.59,.39,.17,.2],[.62,-.02,.22,.25],[.69,-.27,.22,.27],[.78,-.4,.15,.18]],fur);
  const head=group(body);
  shape(head,17,[[.84,-.34,.14,.15],[.86,-.51,.16,.16],[.76,-.67,.10,.08],[.75,-.86,.07,.06]],fur,7);
  shape(head,18,[[.73,-.49,.10,.11],[.70,-.72,.065,.052],[.72,-.85,.055,.025]],muzzle,6);
  eye(head,0,.765,-.87,.055,dark);
  for(const s of [-1,1]){
    const ear=shape(head,19,[[0,0,.078,.05],[.12,.025,.055,.025],[.23,.015,.006,.008]],fur,5);ear.position.set(s*.115,.95,-.43);ear.rotation.z=-s*.28;
    eye(head,s*.132,.874,-.578,.024,gold);
    spike(head,[s*.12,.906,-.63],[s*.16,.932,-.52],.026,fur);
    spike(body,[s*.14,.72,-.24],[s*.25,.58,-.02],.14,fur);
  }
  const tail=group(body);shape(tail,20,[[.64,.5,.07,.09],[.48,.78,.09,.11],[.46,1,.1,.095],[.55,1.17,.015,.035]],fur,6);
  const legs=[];for(const z of [-.28,.38])for(const x of [-.13,.13])legs.push(leg(body,x,z,false,z>0));
  batch(body,21);batch(head,22);
  root.userData={body,head,tail,legs};return root;
}
export function poseWolf(root,time=0,moving=true,bite=0){
  const d=root.userData,w=moving?1:0;
  d.body.position.y=Math.sin(time*13)*.045*w+.08*bite;d.body.position.z=-.22*bite;
  d.head.position.set(0,.08*bite,-.25*bite);d.head.rotation.x=Math.sin(time*6)*.045-.22*bite;d.tail.rotation.y=Math.sin(time*7)*.2;
  d.legs.forEach((l,i)=>{const s=Math.sin(time*13+(i===0||i===3?0:Math.PI));l.rotation.x=s*.7*w;l.userData.knee.rotation.x=Math.max(0,-s)*1.05*w;});
}

export function makeBow(){
  const root=group();
  shape(root,23,[[-.59,.09,.008,.012],[-.49,.02,.014,.017],[-.28,-.035,.018,.022],[0,0,.022,.022],[.28,-.035,.018,.022],[.49,.02,.014,.017],[.59,.09,.008,.012]],mat(0x9d622c),6);
  shape(root,24,[[-.07,0,.025,.027],[.07,0,.025,.027]],mat(0x322f2a),6);
  for(const y of [-.09,.09]){const ring=mesh(root,cache.ring ||= new T.CylinderGeometry(.028,.028,.018,6),gold);ring.position.y=y;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([0,-.59,.10,0,0,.10,0,.59,.10],3));
  const string=new T.Line(geometry,materials.string ||= new T.LineBasicMaterial({color:0xf2dfb1}));root.add(string);root.userData.string=string;return root;
}
export function setBowDraw(root,amount=0){const p=root.userData.string.geometry.attributes.position;p.setXYZ(1,0,0,.10+.42*clamp(amount));p.needsUpdate=true;}
