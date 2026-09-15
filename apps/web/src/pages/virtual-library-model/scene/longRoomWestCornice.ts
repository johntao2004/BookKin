import * as THREE from 'three';
import { createWestStairFrieze } from './longRoomWestFrieze';

/** Small repeated relief visible at the ceiling perimeter in the 2019 photographs.
 * The profile, module pitch and foliation are estimated; this is not a surveyed order. */
export function createWestCorniceGeometries() {
  const bodyPositions:number[]=[],bodyIndices:number[]=[];
  const segments=24,arcSegments=16;
  const relief=(t:number)=>0.142+(0.09+0.025*Math.sin(t*Math.PI*2))*Math.pow(Math.sin(Math.PI*t),0.7);
  for(let row=0;row<=segments;row++) {
    const t=row/segments,width=0.065*Math.pow(Math.sin(Math.PI*t),0.4);
    for(let col=0;col<=arcSegments;col++) {
      const angle=(col/arcSegments-0.5)*Math.PI;
      bodyPositions.push(Math.sin(angle)*width,-0.13+t*0.26,
        0.142+(relief(t)-0.142)*Math.cos(angle));
    }
  }
  for(let row=0;row<segments;row++) for(let col=0;col<arcSegments;col++) {
    const a=row*(arcSegments+1)+col,b=a+1,c=a+arcSegments+1;
    bodyIndices.push(a,b,c,b,c+1,c);
  }
  const bracket=new THREE.BufferGeometry();
  bracket.setAttribute('position',new THREE.Float32BufferAttribute(bodyPositions,3));
  bracket.setIndex(bodyIndices);bracket.computeVertexNormals();
  const positions:number[]=[], indices:number[]=[];
  const rows=20,cols=8;
  for(let row=0;row<=rows;row++) {
    const t=row/rows,outline=Math.sin(Math.PI*t);
    const width=0.055*Math.pow(outline,0.6)*(0.9+0.1*Math.cos(t*Math.PI*6));
    for(let col=0;col<=cols;col++) {
      const u=col/cols*2-1;
      const bodyT=(0.015+t*0.24)/0.26;
      const bodyWidth=0.065*Math.pow(Math.sin(Math.PI*bodyT),0.4);
      const surface=0.142+(relief(bodyT)-0.142)*Math.sqrt(Math.max(0,1-(u*width/bodyWidth)**2));
      positions.push(u*width,-0.115+t*0.24,surface+0.004+0.018*outline*(1-u*u)
        +0.006*outline*Math.cos(u*Math.PI*3));
    }
  }
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const a=row*(cols+1)+col,b=a+1,c=a+cols+1;
    indices.push(a,b,c,b,c+1,c);
  }
  const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  leaf.setIndex(indices);leaf.computeVertexNormals();return {bracket,leaf};
}

export function createWestStairCornice(length:number, plaster:THREE.Material,
  geometry:ReturnType<typeof createWestCorniceGeometries>) {
  const root=createWestStairFrieze(length,plaster,false);
  root.name='West stair continuous ornamented ceiling cornice';
  root.userData.fidelity='photographic-perimeter-estimated-profile';
  // Keep units away from the crossing wall's projecting cornice at each corner.
  const clearLength=length-0.6,count=Math.floor(clearLength/0.28),pitch=clearLength/count;
  for(const [name,shape] of [['Curved plaster cornice brackets',geometry.bracket],
    ['Folded plaster cornice leaves',geometry.leaf]] as const) {
    const instances=new THREE.InstancedMesh(shape,plaster,count);instances.name=name;
    for(let index=0;index<count;index++) instances.setMatrixAt(index,
      new THREE.Matrix4().makeTranslation(-clearLength/2+(index+0.5)*pitch,0,0));
    instances.castShadow=instances.receiveShadow=true;root.add(instances);
  }
  return root;
}
