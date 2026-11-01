import * as THREE from 'three';

/** Actual horizontal paving faces. Dark joints expose the backing slab 8 mm
 * below them, rather than relying on a white flat surface or a screen overlay.
 * Coordinates here follow the parent builder's world/local setting-out. */
export function createJointedPavingV13({rects,exclude=[],pitchX=1.2,pitchZ=1.2,joint=.018,stagger=false,colors=[0x8b908b,0x93968f,0x858c89,0x999b92],name='V13_Jointed_Paving',mapPoint=(x,y,z)=>[x,y,z]}){
  const positions=[],normals=[],colorValues=[],uv=[],indices=[],records=[];
  const palette=colors.map(c=>new THREE.Color(c));
  const subtract=(r,h)=>{
    const x0=Math.max(r.minX,h.minX),x1=Math.min(r.maxX,h.maxX),z0=Math.max(r.minZ,h.minZ),z1=Math.min(r.maxZ,h.maxZ);
    if(x1<=x0||z1<=z0)return[r];
    return[{...r,maxX:x0},{...r,minX:x1},{...r,minX:x0,maxX:x1,maxZ:z0},{...r,minX:x0,maxX:x1,minZ:z1}].filter(p=>p.maxX-p.minX>.001&&p.maxZ-p.minZ>.001);
  };
  let tileCount=0;
  for(const source of rects){
    const pieces=exclude.reduce((rs,e)=>rs.flatMap(r=>subtract(r,e)),[source]);
    for(const r of pieces){
      for(let row=Math.floor(r.minZ/pitchZ);row<Math.ceil(r.maxZ/pitchZ);row++){
        const shift=stagger&&(row&1)?pitchX/2:0;
        for(let col=Math.floor((r.minX-shift)/pitchX);col<Math.ceil((r.maxX-shift)/pitchX);col++){
          const minX=Math.max(r.minX,col*pitchX+shift+joint/2),maxX=Math.min(r.maxX,(col+1)*pitchX+shift-joint/2);
          const minZ=Math.max(r.minZ,row*pitchZ+joint/2),maxZ=Math.min(r.maxZ,(row+1)*pitchZ-joint/2);
          if(maxX-minX<.025||maxZ-minZ<.025)continue;
          const hash=((row*73856093)^(col*19349663))>>>0,c=palette[hash%palette.length],base=positions.length/3;
          // Horizontal positions are clockwise from above in x,z, so the
          // triangle order below produces upward normals after the basis map.
          for(const [x,z]of[[minX,minZ],[minX,maxZ],[maxX,maxZ],[maxX,minZ]]){
            positions.push(...mapPoint(x,r.y,z));normals.push(0,1,0);colorValues.push(c.r,c.g,c.b);uv.push((x-minX)/pitchX,(z-minZ)/pitchZ);
          }
          indices.push(base,base+1,base+2,base,base+2,base+3);tileCount++;
          if(records.length<32)records.push({minX,maxX,minZ,maxZ,y:r.y});
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colorValues,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.96,metalness:0});material.name=name+'_Weathered_Grey_Stone';
  // The solid substrate already closes the ground. Individual paving faces
  // use normal projected-area selection in the bounded CPU renderer, so
  // thousands of distant bricks cannot evict windows, doors or the sky.
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.userData={collision:'none',paving:true,actualJoints:true,tileCount,joint,pitchX,pitchZ,stagger,sampleTiles:records};
  return mesh;
}
