import * as THREE from 'three';

/** Original, Ming-inspired architecture; metres, Y up, entry at +Z. */
const C = {
  red: 0x84352a, redLight: 0xa34432, dark: 0x3c281f, wood: 0x6b4128,
  gold: 0xb69252, teal: 0x385c53, blue: 0x304e56, plaster: 0xc9b797,
};

function rng(seed = 1703) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}

function canvasTexture(w, h, draw, repeat) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}

function woodTexture() {
  const r = rng();
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#b9a083'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1150; i++) {
      const x = r() * w; ctx.strokeStyle = `rgba(${r() > .5 ? '66,41,19' : '255,233,197'},${.015 + r() * .085})`;
      ctx.lineWidth = .2 + r() * 1.1; ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 10) ctx.lineTo(x + Math.sin(y * .018 + i) * 2.8, y);
      ctx.stroke();
    }
  }, [1, 1]);
}

function stoneTexture() {
  const r = rng(809);
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#4c4b44'; ctx.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = Math.floor(r() * 10); ctx.fillStyle = `rgb(${97+v},${96+v},${86+v})`;
      ctx.fillRect(x*s+2, y*s+2, s-4, s-4);
      ctx.strokeStyle = 'rgba(213,202,172,.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(x*s+3, y*s+3, s-6, s-6);
    }
    for (let i = 0; i < 80000; i++) { const v = r() > .5 ? 230 : 30;
      ctx.fillStyle = `rgba(${v},${v},${v},${r()*.07})`; ctx.fillRect(r()*w, r()*h, r()*2, r()*2); }
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(222,215,185,.025)'; ctx.beginPath(); const x=r()*w,y=r()*h;
      ctx.moveTo(x,y); ctx.bezierCurveTo(x+50,y+30,x-20,y+80,x+120,y+150); ctx.stroke();
    }
  }, [5, 7]);
}

function inkPainting() {
  const r = rng(120);
  return canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle='#c9b98f';ctx.fillRect(0,0,w,h);
    for(let i=0;i<15000;i++){ctx.fillStyle=`rgba(86,66,32,${r()*.065})`;ctx.fillRect(r()*w,r()*h,1,1);}
    for(let layer=0;layer<5;layer++){
      const y0=230+layer*110; ctx.beginPath();ctx.moveTo(0,h);
      for(let x=0;x<=w;x+=4){const y=y0-Math.sin(x*.010+layer)*83-Math.sin(x*.024+layer*2)*40;ctx.lineTo(x,y);}
      ctx.lineTo(w,h);ctx.fillStyle=`rgba(49,62,51,${.10+layer*.055})`;ctx.fill();
    }
    for(let i=0;i<18;i++){
      let x=65+r()*365,y=590+r()*170,s=.5+r()*.8;
      ctx.strokeStyle='rgba(35,46,33,.67)';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(x,y+85*s);ctx.lineTo(x-4*s,y);ctx.stroke();
      for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(x,y+j*17*s);ctx.lineTo(x-22*s+j*2,y+(j+1)*17*s);ctx.lineTo(x+21*s-j*2,y+(j+1)*17*s);ctx.fillStyle='rgba(35,46,33,.45)';ctx.fill();}
    }
    ctx.fillStyle='#4f4c38';ctx.font='28px Silvae Serif, Noto Serif SC, serif';ctx.textAlign='center';
    [...'雲山藏秀'].forEach((s,i)=>ctx.fillText(s,420,80+i*38));
    ctx.fillStyle='#9b4838';ctx.fillRect(406,253,27,27);ctx.strokeStyle='#c9b98f';ctx.lineWidth=2;ctx.strokeRect(410,257,19,19);
  });
}

function plaqueTexture(text, w=1024, h=256, vertical=false) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle='#253a35';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#bd9b58';ctx.lineWidth=10;ctx.strokeRect(15,15,w-30,h-30);
    ctx.lineWidth=2;ctx.strokeRect(28,28,w-56,h-56);ctx.fillStyle='#d9bd7e';ctx.textAlign='center';ctx.textBaseline='middle';
    const chars=[...text];ctx.font=`${vertical?Math.min(w*.62,h/(chars.length+1)*.8):h*.58}px Silvae Serif, Noto Serif SC, serif`;
    chars.forEach((c,i)=>ctx.fillText(c,vertical?w/2:w*(i+1)/(chars.length+1),vertical?h*(i+1)/(chars.length+1):h*.53));
  });
}

class Builder {
  constructor(group) { this.group=group;this.batches=new Map();this.temp=new THREE.Object3D(); }
  add(geo, mat, x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,cast=true) {
    const key=geo.uuid+'/'+mat.uuid+'/'+cast;
    if(!this.batches.has(key))this.batches.set(key,{geo,mat,cast,matrices:[]});
    this.temp.position.set(x,y,z);this.temp.rotation.set(rx,ry,rz);this.temp.scale.set(sx,sy,sz);this.temp.updateMatrix();
    this.batches.get(key).matrices.push(this.temp.matrix.clone());
  }
  box(mat,x,y,z,w,h,d,ry=0,rz=0) { this.add(G.box,mat,x,y,z,w,h,d,0,ry,rz); }
  cyl(mat,x,y,z,r,h,ry=0) { this.add(G.cylinder,mat,x,y,z,r,h,r,0,ry,0); }
  rod(mat,a,b,r=.04) {
    const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),mid=aa.clone().add(bb).multiplyScalar(.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bb.sub(aa).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);
    this.add(G.cylinder,mat,...mid.toArray(),r,new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)),r,e.x,e.y,e.z);
  }
  finish(prefix) {
    for(const {geo,mat,matrices,cast} of this.batches.values()){
      const m=new THREE.InstancedMesh(geo,mat,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));
      m.instanceMatrix.needsUpdate=true;m.castShadow=cast;m.receiveShadow=true;m.name=`${prefix}_${mat.name}_${matrices.length}`;
      m.computeBoundingBox();m.computeBoundingSphere();this.group.add(m);
    }
  }
}

const G={ box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,20),
  oct:new THREE.CylinderGeometry(1,1,1,8),sphere:new THREE.SphereGeometry(1,16,10)};

function mesh(group,name,geo,mat,p,rot){const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(...p);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}

function beamDecoration(b,m,x,y,z,w){
  b.box(m.teal,x,y,z,w,.43,.46);
  b.box(m.gold,x,y+.18,z+.242,w-.12,.025,.018);b.box(m.gold,x,y-.18,z+.242,w-.12,.025,.018);
  b.box(m.gold,x,y+.18,z-.242,w-.12,.025,.018);b.box(m.gold,x,y-.18,z-.242,w-.12,.025,.018);
  for(let xx=x-w/2+.43;xx<x+w/2-.25;xx+=.7){
    for(const zz of [z-.248,z+.248]){
      b.box(m.gold,xx,y,zz,.17,.17,.012,0,Math.PI/4);
      b.box(m.blue,xx,y,zz+(zz>z?.009:-.009),.095,.095,.012,0,Math.PI/4);
    }
  }
}

function corbelGeometry(){
  const s=new THREE.Shape();s.moveTo(-.83,0);s.lineTo(.83,0);s.lineTo(.80,-.12);
  s.bezierCurveTo(.69,-.12,.62,-.16,.59,-.26);s.bezierCurveTo(.54,-.40,.36,-.34,.30,-.47);
  s.lineTo(-.30,-.47);s.bezierCurveTo(-.36,-.34,-.54,-.40,-.59,-.26);s.bezierCurveTo(-.62,-.16,-.69,-.12,-.80,-.12);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.2,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,steps:1,curveSegments:8});geo.translate(0,0,-.1);return geo;
}

function roofGeometry(){
  const points=[],uv=[],idx=[];const nx=56,nz=32;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=(i/nx-.5)*27.2,z=(j/nz-.5)*38.3;
    const t=Math.abs(x)/13.6;let y=11.1-3.4*t+1.1*Math.pow(t,6);
    const end=Math.max(0,(Math.abs(z)-13.2)/5.95);y-=end*(1.8*(1-t));y+=Math.pow(end,6)*.30;
    points.push(x,y,z);uv.push(i/nx,j/nz);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;idx.push(a,c,a+1,a+1,c,c+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

function tileTexture(){return canvasTexture(512,512,(c,w,h)=>{
  c.fillStyle='#b28a3f';c.fillRect(0,0,w,h);
  for(let x=0;x<16;x++){const a=x*32;const g=c.createLinearGradient(a,0,a+32,0);g.addColorStop(0,'#6f4d22');g.addColorStop(.4,'#b79550');g.addColorStop(.6,'#c5a45b');g.addColorStop(1,'#8b642d');c.fillStyle=g;c.fillRect(a,0,32,h);}
  c.fillStyle='rgba(60,39,15,.35)';for(let y=0;y<16;y++)c.fillRect(0,y*32,w,2);
},[5,7]);}

function addLantern(b,m,x,z,lanterns){
  const y=5.5;
  b.cyl(m.bronze,x,6.65,z,.022,1.3);
  b.add(G.oct,m.paper,x,y,z,.37,.76,.37,0,Math.PI/8,0,false);
  for(let i=0;i<8;i++){let a=i*Math.PI/4+Math.PI/8;let xx=x+Math.cos(a)*.37,zz=z+Math.sin(a)*.37;b.cyl(m.dark,xx,y,zz,.023,.82);}
  for(const yy of [y-.42,y+.42])b.add(G.oct,m.dark,x,yy,z,.40,.07,.40,0,Math.PI/8);
  for(const yy of [y-.49,y+.49])b.add(G.oct,m.gold,x,yy,z,.29,.04,.29,0,Math.PI/8);
  b.cyl(m.red,x,y-.72,z,.025,.4);b.add(G.sphere,m.red,x,y-.93,z,.06,.11,.06);
  lanterns.push([x,y,z]);
}

export function buildArchitecture(){
  const group=new THREE.Group();group.name='MingLibrary_Architecture';
  const structure=new THREE.Group();structure.name='01_Columns_Beams';group.add(structure);
  const envelope=new THREE.Group();envelope.name='02_Walls_Windows';group.add(envelope);
  const ceiling=new THREE.Group();ceiling.name='03_Ceiling_Rafters';group.add(ceiling);
  const roof=new THREE.Group();roof.name='04_GlazedRoof';group.add(roof);
  const details=new THREE.Group();details.name='05_Plaques_Painting';group.add(details);
  const wood=woodTexture();
  const material=(name,color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.72,...extra});m.name=name;return m;};
  const m={
    red:material('Vermilion_Lacquer',C.red,{map:wood,roughness:.42}),
    redLight:material('Vermilion_Lighter',C.redLight,{map:wood,roughness:.5}),
    dark:material('Dark_Timber',C.dark,{map:wood}),wood:material('Natural_Timber',C.wood,{map:wood}),
    gold:material('Aged_Gilt',C.gold,{metalness:.48,roughness:.46}),
    bronze:material('Antique_Bronze',0x635c3b,{metalness:.65,roughness:.48}),
    teal:material('Mineral_Green',C.teal),blue:material('Mineral_Blue',C.blue),
    stone:material('Stone_Plinth',0x8e8b7e,{roughness:.92}),plaster:material('Warm_Plaster',C.plaster,{roughness:.95}),
    paper:material('Lantern_Silk',0xffe4a3,{emissive:0xffb44e,emissiveIntensity:.4,roughness:.75}),
    window:material('Window_Paper',0xe7d7ad,{emissive:0xe9cda0,emissiveIntensity:.24,side:THREE.DoubleSide}),
  };
  const sb=new Builder(structure),wb=new Builder(envelope),cb=new Builder(ceiling),db=new Builder(details),rb=new Builder(roof);
  const floorMat=material('Grey_Brick_Floor',0xffffff,{map:stoneTexture(),roughness:.7});
  const floor=mesh(group,'00_StoneFloor',new THREE.BoxGeometry(25.2,.34,35.2),floorMat,[0,-.19,0]);
  sb.box(m.stone,0,-.50,0,26,.28,36);
  // Pale stone inlay, two restrained lines framing the central aisle.
  for(const x of [-1.6,1.6])sb.box(m.stone,x,-.012,0,.04,.015,32.5);
  for(const z of [-16.25,16.25])sb.box(m.stone,0,-.012,z,3.24,.015,.04);
  const obstacles=[];
  const corbel=corbelGeometry();
  let columns=0;
  for(const x of [-11.75,-6.8,6.8,11.75])for(const z of [-15,-9,-3,3,9,15]){
    const central=Math.abs(x)<10,r=central?.31:.24;
    const profile=[new THREE.Vector2(r*1.52,0),new THREE.Vector2(r*1.52,.1),new THREE.Vector2(r*1.38,.15),new THREE.Vector2(r*1.30,.30),new THREE.Vector2(r*1.10,.39),new THREE.Vector2(r*1.02,.43)];
    mesh(structure,`ColumnBase_${columns}`,new THREE.LatheGeometry(profile,24),m.stone,[x,0,z]);
    sb.cyl(m.red,x,3.68,z,r,6.55);sb.cyl(m.redLight,x,6.89,z,r*1.02,.10);
    sb.cyl(m.gold,x,.49,z,r*1.03,.04);sb.cyl(m.gold,x,6.72,z,r*1.03,.045);
    sb.box(m.red,x,7.02,z,.73,.25,.73);
    // Compact stepped bracket-set at each column head.
    for(let k=0;k<3;k++){
      const yy=7.15+k*.18,span=.82+k*.33;
      sb.box(k%2?m.teal:m.red,x,yy,z,span,.17,.22);
      sb.box(k%2?m.teal:m.red,x,yy+.085,z,.22,.17,span);
      for(const sign of [-1,1]){sb.box(m.gold,x+sign*(span/2-.12),yy+.11,z,.20,.04,.24);sb.box(m.redLight,x,yy+.19,z+sign*(span/2-.12),.28,.10,.25);}
    }
    for(const rot of [0,Math.PI/2])sb.add(corbel,m.red,x,6.88,z,1.2,1.2,1.2,0,rot,0);
    obstacles.push({minX:x-r-.13,maxX:x+r+.13,minZ:z-r-.13,maxZ:z+r+.13});columns++;
  }
  // Longitudinal tie beams and rhythm of cross beams.
  for(const x of [-11.75,-6.8,6.8,11.75]){
    sb.box(m.red,x,7.66,0,.36,.57,31.8);
    for(const xx of [x-.19,x+.19])sb.box(m.gold,xx,7.84,0,.025,.025,31.6);
  }
  for(const z of [-15,-9,-3,3,9,15]){
    sb.box(m.red,0,7.73,z,24.3,.54,.42);
    beamDecoration(sb,m,0,7.71,z,13.05);
    for(const x of [-9.25,9.25])beamDecoration(sb,m,x,7.71,z,4.15);
    sb.rod(m.dark,[-6.7,8.05,z],[0,10.18,z],.13);
    sb.rod(m.dark,[0,10.18,z],[6.7,8.05,z],.13);
    sb.box(m.teal,0,9.24,z,6.1,.27,.25);
    sb.cyl(m.red,0,9.69,z,.11,.94);
  }
  // Wall panels and clerestories; bookcases stand in front of the lower band.
  for(const side of [-1,1]){
    const x=side*12.14;
    wb.box(m.plaster,x,1.2,0,.25,2.4,34);
    wb.box(m.red,x,0.12,0,.36,.22,34.1);wb.box(m.red,x,2.38,0,.40,.13,34.1);
    wb.box(m.plaster,x,7.10,0,.25,1.3,34);
    for(const z of [-12,-6,0,6,12]){
      const win=new THREE.Group();win.name='LatticeWindow';win.position.set(x,4.5,z);win.rotation.y=-side*Math.PI/2;envelope.add(win);
      const b=new Builder(win);
      const paper=mesh(win,'PaperBacking',new THREE.PlaneGeometry(4.92,4.06),m.window,[0,0,-.025]);paper.castShadow=false;paper.receiveShadow=false;
      for(const xx of [-2.5,2.5])b.box(m.red,xx,0,0,.12,4.25,.16);
      for(const yy of [-2.1,2.1])b.box(m.red,0,yy,0,5.1,.12,.16);
      for(let xx=-2.4;xx<=2.41;xx+=.60)b.box(m.wood,xx,0,.075,.043,4.13,.07);
      for(let yy=-1.98;yy<=2.0;yy+=.66)b.box(m.wood,0,yy,.075,4.94,.043,.07);
      for(let xx=-2.1;xx<2.2;xx+=.6)for(let yy=-1.65;yy<1.8;yy+=.66){
        b.box(m.wood,xx,yy,.077,.24,.24,.045,0,Math.PI/4);
        b.box(m.window,xx,yy,.106,.16,.16,.013,0,Math.PI/4);
      }
      b.finish('Lattice');
    }
    for(const z of [-16.4,-9,-3,3,9,16.4])wb.box(m.red,x,4.45,z,.35,4.3,.29);
  }
  wb.box(m.plaster,0,3.85,-17.05,24.5,7.8,.28);
  wb.box(m.red,0,.35,-16.86,24.4,.68,.18);
  wb.box(m.red,0,7.35,-16.83,24.4,.25,.24);
  for(const x of [-11.8,-6.8,6.8,11.8])wb.box(m.red,x,3.8,-16.82,.25,7.3,.2);
  // Entrance is open, with folded timber-panel leaves to either side.
  for(const side of [-1,1]){
    const x=side*8.45;wb.box(m.plaster,x,3.8,17.05,7.4,7.8,.25);
    wb.box(m.red,side*4.7,3.5,17,.35,7,.38);
    const door=new THREE.Group();door.name='EntranceDoorLeaf';door.position.set(side*4.55,0,16.7);door.rotation.y=-side*.40;envelope.add(door);
    const b=new Builder(door);b.box(m.red,side*1.04,3.1,0,2.0,6.1,.16);
    for(const xx of [side*.16,side*1.92])b.box(m.gold,xx,3.15,.1,.025,5.72,.04);
    for(const yy of [.40,2.3,5.9])b.box(m.gold,side*1.03,yy,.1,1.78,.025,.04);
    for(let xx=.4;xx<1.9;xx+=.27)for(let yy=2.6;yy<5.8;yy+=.40)b.box(m.dark,side*xx,yy,.10,.16,.29,.02);
    b.finish('Entrance');
  }
  beamDecoration(wb,m,0,6.65,16.8,9.0);
  // Visible structural rafters follow the roof curve.
  for(let z=-16.3;z<=16.4;z+=.62){
    for(const side of [-1,1]){
      cb.rod(m.wood,[0,10.73,z],[side*6.5,9.08,z],.065);
      cb.rod(m.wood,[side*6.5,9.08,z],[side*12.35,7.94,z],.065);
    }
  }
  for(const x of [-11.5,-8.6,-5.8,-2.9,0,2.9,5.8,8.6,11.5]){
    const y=10.65-Math.abs(x)*.23;
    cb.rod(m.red, [x,y,-16.8],[x,y,16.8],.15);
  }
  // A single stepped octagonal caisson at the hall's centre.
  const cofferPanel=m.teal.clone();cofferPanel.name='Caisson_Infill';cofferPanel.side=THREE.DoubleSide;
  for(let level=0;level<5;level++){
    const rad=2.50-level*.33, yy=8.28+level*.31;
    for(let i=0;i<8;i++){
      const a=(i+.5)*Math.PI/4;const len=2*rad*Math.sin(Math.PI/8);
      cb.box(level%2?m.red:m.teal,Math.cos(a)*rad*Math.cos(Math.PI/8),yy,Math.sin(a)*rad*Math.cos(Math.PI/8),len,.20,.16,-a+Math.PI/2);
      cb.box(m.gold,Math.cos(a)*rad*Math.cos(Math.PI/8),yy-.105,Math.sin(a)*rad*Math.cos(Math.PI/8),len,.016,.19,-a+Math.PI/2);
      if(level<4){
        const a0=i*Math.PI/4,a1=(i+1)*Math.PI/4,r1=rad-.33,y1=yy+.31;
        const pts=[Math.cos(a0)*rad,yy,Math.sin(a0)*rad,Math.cos(a1)*rad,yy,Math.sin(a1)*rad,Math.cos(a1)*r1,y1,Math.sin(a1)*r1,Math.cos(a0)*r1,y1,Math.sin(a0)*r1];
        const panel=new THREE.BufferGeometry();panel.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));panel.setIndex([0,1,2,0,2,3]);panel.computeVertexNormals();
        mesh(ceiling,'Caisson_SlopedPanel',panel,cofferPanel,[0,0,0]);
        cb.rod(m.gold,[Math.cos(a0)*rad,yy-.04,Math.sin(a0)*rad],[Math.cos(a0)*r1,y1-.04,Math.sin(a0)*r1],.021);
      }
    }
  }
  for(const side of [-1,1]){
    cb.box(m.red,side*2.32,8.14,0,.20,.26,6.26);
    cb.box(m.red,0,8.14,side*2.32,4.84,.26,.20);
    for(const z of [-3,3])cb.box(m.red,side*2.32,7.99,z,.25,.34,.30);
  }
  cb.add(G.oct,m.blue,0,9.65,0,1.12,.10,1.12,0,Math.PI/8);
  cb.add(G.oct,m.gold,0,9.57,0,.24,.08,.24,0,Math.PI/8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cb.add(G.sphere,m.gold,Math.cos(a)*.57,9.55,Math.sin(a)*.57,.15,.04,.22,0,-a,0);}
  const roofMat=material('Ochre_Glazed_Tiles',0xffffff,{map:tileTexture(),roughness:.5,metalness:.12,side:THREE.DoubleSide});
  mesh(roof,'CurvedRoof',roofGeometry(),roofMat,[0,0,0]);
  rb.rod(m.gold,[0,11.17,-13.2],[0,11.17,13.2],.17);
  for(const side of [-1,1]){
    for(let z=-18.6;z<=18.7;z+=.30)rb.add(G.cylinder,m.gold,side*13.55,8.75,z,.072,.20,.072,0,0,Math.PI/2);
    for(let x=-13.4;x<=13.4;x+=.34){const t=Math.abs(x)/13.6,y=11.1-3.4*t+1.1*t**6-1.8*(1-t)+.3;
      rb.add(G.sphere,m.gold,x,y+.03,side*19.13,.075,.075,.10);}
  }
  // Name plaque and scholar's landscape screen on the north axis.
  db.box(m.dark,0,5.62,-16.75,5.0,1.18,.22);db.box(m.gold,0,5.62,-16.61,4.82,1.03,.06);
  const plaque=mesh(details,'Guangwen_Plaque',new THREE.PlaneGeometry(4.68,.92),new THREE.MeshStandardMaterial({map:plaqueTexture('閣藏文觀'),roughness:.8}),[0,5.62,-16.565]);
  db.box(m.dark,0,2.87,-16.6,2.36,3.60,.20);db.box(m.gold,0,2.87,-16.48,2.23,3.48,.04);
  mesh(details,'Ink_Landscape_Scroll',new THREE.PlaneGeometry(2.08,3.33),new THREE.MeshStandardMaterial({map:inkPainting(),roughness:1}),[0,2.87,-16.45]);
  for(const yy of [1.17,4.57])db.rod(m.dark,[-1.28,yy,-16.4],[1.28,yy,-16.4],.045);
  const couplets=['讀書破萬卷','落筆有千秋'];
  for(let i=0;i<2;i++){
    const x=i?2.15:-2.15;db.box(m.dark,x,3.05,-16.62,.51,3.4,.16);
    mesh(details,`Calligraphy_${i}`,new THREE.PlaneGeometry(.44,3.26),new THREE.MeshStandardMaterial({map:plaqueTexture(couplets[i],128,1024,true),roughness:.8}),[x,3.05,-16.525]);
  }
  // An altar-shaped scholar's display table, without religious imagery.
  db.box(m.wood,0,.98,-15.35,3.45,.13,.88);db.box(m.dark,0,.78,-15.35,3.2,.22,.76);
  for(const x of [-1.42,1.42])for(const z of [-15.65,-15.07])db.box(m.wood,x,.43,z,.12,.86,.12);
  obstacles.push({minX:-1.77,maxX:1.77,minZ:-15.82,maxZ:-14.88});
  const lanterns=[];for(const z of [-9,3,12])for(const x of [-4.4,4.4])addLantern(db,m,x,z,lanterns);
  sb.finish('Structure');wb.finish('Envelope');cb.finish('Ceiling');db.finish('Details');rb.finish('Roof');
  return {group,roof,ceiling,envelope,obstacles,lanterns,stats:{columns,width:24,depth:34,height:11.3},materials:m};
}
