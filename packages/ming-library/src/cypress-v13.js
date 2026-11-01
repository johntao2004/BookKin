import * as THREE from 'three';

/** A branching cypress silhouette with visible timber forks and fine planar
 * scale-leaf sprays. No stacked spheres or conical topiary crowns are used. */
export function buildCourtyardCypressV13({index=0,x=0,z=0,groundY=-3.6,scale=1}={}){
  const group=new THREE.Group();group.name=`V13_Naturally_Branched_Cypress_${index}`;group.position.set(x,groundY,z);group.scale.setScalar(scale);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:0x645b47,roughness:.96});trunkMaterial.name='V13_Cypress_Weathered_Bark';
  const leafMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96,side:THREE.DoubleSide});leafMaterial.name='V13_Cypress_Fine_Scale_Leaves';
  const trunkMatrices=[],tmp=new THREE.Object3D(),cylinder=new THREE.CylinderGeometry(.72,1,1,7),up=new THREE.Vector3(0,1,0),positions=[],colors=[];
  let branchCount=0,frondCount=0;
  const hash=n=>{const v=Math.sin(n*12.9898+index*78.233)*43758.5453;return v-Math.floor(v);};
  const branch=(a,b,radius)=>{
    const delta=b.clone().sub(a);tmp.position.copy(a).add(b).multiplyScalar(.5);tmp.quaternion.setFromUnitVectors(up,delta.clone().normalize());tmp.scale.set(radius,delta.length(),radius);tmp.updateMatrix();trunkMatrices.push(tmp.matrix.clone());branchCount++;
  };
  const palette=[0x243c2d,0x2c4632,0x36543b,0x496147,0x3a573b].map(c=>new THREE.Color(c));
  const triangle=(a,b,c,color)=>{for(const p of[a,b,c]){positions.push(...p.toArray());colors.push(color.r,color.g,color.b);}};
  const frond=(origin,direction,length,width,seed)=>{
    const d=direction.clone().normalize(),side=new THREE.Vector3(-d.z,.15,d.x).normalize(),normal=new THREE.Vector3().crossVectors(d,side).normalize();
    const c=palette[Math.floor(hash(seed)*palette.length)],count=7;
    for(let i=0;i<count;i++)for(const sign of[-1,1]){
      const t=(i+.5)/count,base=origin.clone().addScaledVector(d,t*length),span=width*Math.sin(Math.PI*t)*(.82+.22*hash(seed+i));
      const tip=base.clone().addScaledVector(side,sign*span).addScaledVector(d,length*.13).addScaledVector(normal,(hash(seed+i*3)-.5)*.1);
      triangle(base.clone().addScaledVector(d,-length*.07),tip,base.clone().addScaledVector(d,length*.15),c);
    }
    triangle(origin.clone().addScaledVector(d,length*.77).addScaledVector(side,width*.12),origin.clone().addScaledVector(d,length*1.11),origin.clone().addScaledVector(d,length*.77).addScaledVector(side,-width*.12),c);frondCount++;
  };
  const stem=[new THREE.Vector3(0,.12,0),new THREE.Vector3(.12,2.3,-.14),new THREE.Vector3(-.12,4.3,.09),new THREE.Vector3(.24,6.5,.18),new THREE.Vector3(.10,8.4,-.08)];
  for(let i=0;i<stem.length-1;i++)branch(stem[i],stem[i+1],.36-i*.075);
  // An uneven, open crown: lower branches spread laterally, upper ones sweep
  // upward. Growth is deterministic, but every tree receives a different seed.
  for(let i=0;i<22;i++){
    const azimuth=i*2.399963+index*.71,y=2.5+i*.245,length=2.8-1.0*(i/22)+.35*hash(i+20);
    const start=new THREE.Vector3(.03,y,.03),direction=new THREE.Vector3(Math.cos(azimuth),.28+hash(i)*.30,Math.sin(azimuth)).normalize();
    const elbow=start.clone().addScaledVector(direction,length*.58),end=start.clone().addScaledVector(direction,length);elbow.y-=.20;
    branch(start,elbow,.095*(1-i/32));branch(elbow,end,.065*(1-i/30));
    for(let j=0;j<4;j++){
      const root=elbow.clone().lerp(end,j/4),angle=azimuth+(j%2?-1:1)*(.45+.45*hash(i*17+j));
      const twigDirection=new THREE.Vector3(Math.cos(angle),.20+hash(i*9+j)*.48,Math.sin(angle)).normalize(),tip=root.clone().addScaledVector(twigDirection,.65+.45*hash(i+j));
      branch(root,tip,.024);
      for(let k=0;k<8;k++){
        const origin=root.clone().lerp(tip,.30+k*.1),fanAngle=angle+(k%2?-1:1)*(.48+hash(i*77+j*9+k)*.7);
        const fd=new THREE.Vector3(Math.cos(fanAngle),.10+(hash(k+i)-.5)*.48,Math.sin(fanAngle));
        frond(origin,fd,.55+.38*hash(i*54+j*13+k),.23+.16*hash(k*17+i),i*1000+j*100+k);
      }
    }
  }
  for(let i=0;i<28;i++){
    const angle=i*2.3999,origin=new THREE.Vector3(.10+Math.cos(angle)*.19,7.3+i*.036,-.08+Math.sin(angle)*.19);
    frond(origin,new THREE.Vector3(Math.cos(angle)*.6,.45,Math.sin(angle)*.6),.62,.20,9000+i);
  }
  const branches=new THREE.InstancedMesh(cylinder,trunkMaterial,trunkMatrices.length);trunkMatrices.forEach((matrix,i)=>branches.setMatrixAt(i,matrix));branches.name=`V13_Cypress_${index}_Forking_Timber`;branches.castShadow=branches.receiveShadow=true;branches.userData={tree:true,collision:'none'};branches.computeBoundingBox();branches.computeBoundingSphere();group.add(branches);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // Fine, intentionally open foliage can use projected-area detail selection.
  // It is not a closed casting whose subpixel facets must be protected ahead
  // of palace windows and the courtyard's visible paving.
  const leaves=new THREE.Mesh(geometry,leafMaterial);leaves.name=`V13_Cypress_${index}_Fine_Needle_Sprays`;leaves.castShadow=leaves.receiveShadow=true;leaves.userData={tree:true,collision:'none'};group.add(leaves);
  // Keep the actual trunk collidable without making the decorative crown a
  // solid wall. This mesh lives inside the visible wooden lower trunk.
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.28,.36,4.4,10),trunkMaterial);core.position.y=2.3;core.name=`V13_Cypress_${index}_Walk_Collision_Trunk`;core.userData={tree:true};group.add(core);
  group.userData={tree:true,branchCount,frondCount,foliageTriangles:positions.length/9,naturalForks:true,stackedSpheres:false};
  return group;
}
