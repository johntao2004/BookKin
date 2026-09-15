import * as THREE from 'three';
import type {LibraryMaterials} from './materials';
import {markCameraCollider} from '../../virtual-library-collision';

/** Y1.002/003 and XS-4A/B: independent winder stair beside the lift.
 * Levels are source annotations relative to the Long Room floor; plan dimensions,
 * riser count, rail section and intermediate winding heights remain estimates.
 * The live core uses only the first-to-second-floor flight. Other levels remain review-only. */
export const EAST_SERVICE_STAIR={levels:[-4.58,0,5.49,8.89,12.42],
  startX:-6.4,turnX:-3.7,centerZ:1.8,radius:0.7,width:0.86,winders:8} as const;
export function createEastServiceStair(materials:LibraryMaterials,levels:readonly number[]=EAST_SERVICE_STAIR.levels) {
  const S=EAST_SERVICE_STAIR,root=new THREE.Group();root.name='East independent service stair';
  root.userData.fidelity='Y1.002/003 and XS-4A/B topology; source floor levels; estimated stair dimensions';
  const surfaces=new THREE.Group();surfaces.name='Service stair walking surfaces';root.add(surfaces);
  const route:THREE.Vector3[]=[];
  const posts:THREE.Matrix4[]=[];
  const geometry=new THREE.CylinderGeometry(0.013,0.013,1,8);
  const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Group=root)=>{
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,parent=surfaces)=>{
    const m=add(name,new THREE.BoxGeometry(w,h,d),materials.woodWarm,parent);m.position.set(x,y,z);return m;
  };
  const rails=(points:THREE.Vector3[])=>{
    const curve=new THREE.CurvePath<THREE.Vector3>();
    for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
    add('Service stair continuous round handrail',new THREE.TubeGeometry(curve,points.length*3,0.03,8,false),materials.woodWarm);
  };
  for(const y of levels)box('Service stair floor landing',1.05,0.16,2*S.radius+S.width,
    S.startX-0.525,y-0.08,S.centerZ);
  for(let level=0;level<levels.length-1;level++) {
    const bottom=levels[level],rise=levels[level+1]-bottom;
    const count=Math.ceil(rise/0.18/2)*2,straight=(count-S.winders)/2;
    const riser=rise/count,going=(S.turnX-S.startX)/straight;
    const outside:THREE.Vector3[]=[],inside:THREE.Vector3[]=[];
    const guard=(p:THREE.Vector3,tangent:THREE.Vector3,index:number)=>{
      const normal=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
      for(const side of [-1,1]) {
        const q=p.clone().addScaledVector(normal,side*S.width/2);
        posts.push(new THREE.Matrix4().compose(new THREE.Vector3(q.x,q.y+0.5,q.z),new THREE.Quaternion(),new THREE.Vector3(1,1,1)));
        (side===-1?outside:inside).push(q.clone().add(new THREE.Vector3(0,1.02,0)));
        const winding=index>=straight&&index<straight+S.winders;
        const segments=winding?4:1;
        for(let segment=0;segment<segments;segment++) {
          const angle=(index-straight+(segment+0.5)/segments)*Math.PI/S.winders;
          const r=S.radius-side*S.width/2;
          const c=winding?new THREE.Vector3(S.turnX+r*Math.sin(angle),q.y,S.centerZ-r*Math.cos(angle)):q;
          markCameraCollider(root,{id:`east-service-${level}-${index}-${side}-${segment}`,shape:'box',
            center:{x:c.x,y:c.y+1,z:c.z},size:{x:0.06,y:2,z:winding?r*Math.PI/S.winders/segments+0.005:going+0.015},
            rotationY:winding?Math.PI/2-angle:Math.atan2(tangent.x,tangent.z)});
        }
      }
      route.push(p);
    };
    for(let i=0;i<straight;i++) {
      const y=bottom+(i+1)*riser,x=S.startX+(i+0.5)*going,z=S.centerZ-S.radius;
      box('Service stair straight tread',going+0.012,0.055,S.width,x,y-0.0275,z);
      box('Service stair closed riser',0.025,riser,S.width,x-going/2,y-riser/2,z);
      guard(new THREE.Vector3(x,y,z),new THREE.Vector3(1,0,0),i);
    }
    // Eight genuinely curved wedge treads turn around a clear open well.
    for(let i=0;i<S.winders;i++) {
      const a=i*Math.PI/S.winders,b=(i+1)*Math.PI/S.winders;
      const shape=new THREE.Shape();
      for(const [radius,reverse] of [[S.radius+S.width/2,false],[S.radius-S.width/2,true]] as const) {
        for(let j=0;j<=8;j++) {
          const angle=reverse?b-(b-a)*j/8:a+(b-a)*j/8;
          const x=radius*Math.sin(angle),z=-radius*Math.cos(angle);
          if(!reverse&&j===0)shape.moveTo(x,z);else shape.lineTo(x,z);
        }
      }
      shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:riser,bevelEnabled:false});g.rotateX(Math.PI/2);
      const y=bottom+(straight+i+1)*riser;
      const tread=add('Service stair curved winder tread',g,materials.woodWarm,surfaces);tread.position.set(S.turnX,y,S.centerZ);
      const mid=(a+b)/2;
      guard(new THREE.Vector3(S.turnX+S.radius*Math.sin(mid),y,S.centerZ-S.radius*Math.cos(mid)),
        new THREE.Vector3(Math.cos(mid),0,Math.sin(mid)),straight+i);
    }
    for(let i=0;i<straight;i++) {
      const y=bottom+(straight+S.winders+i+1)*riser,x=S.turnX-(i+0.5)*going,z=S.centerZ+S.radius;
      box('Service stair straight tread',going+0.012,0.055,S.width,x,y-0.0275,z);
      box('Service stair closed riser',0.025,riser,S.width,x+going/2,y-riser/2,z);
      guard(new THREE.Vector3(x,y,z),new THREE.Vector3(-1,0,0),straight+S.winders+i);
    }
    rails(outside);rails(inside);
    for(const edge of [outside,inside]) {
      const vertices:number[]=[],indices:number[]=[];
      edge.forEach((p,i)=>{
        const direction=edge[Math.min(i+1,edge.length-1)].clone().sub(edge[Math.max(0,i-1)]);
        const n=new THREE.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(0.035);
        for(const [side,drop] of [[-1,1.12],[1,1.12],[1,1.34],[-1,1.34]])
          vertices.push(p.x+side*n.x,p.y-drop,p.z+side*n.z);
        if(i>0)for(let face=0;face<4;face++) {
          const a=(i-1)*4+face,b=(i-1)*4+(face+1)%4,c=i*4+(face+1)%4,d=i*4+face;
          indices.push(a,b,d,b,c,d);
        }
      });
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      g.setIndex(indices);g.computeVertexNormals();add('Service stair continuous timber stringer',g,materials.woodWarm);
    }
    // Cross the common landing before starting the next storey.
    for(let j=0;j<=12;j++)route.push(new THREE.Vector3(S.startX-0.5,levels[level+1],S.centerZ+S.radius-2*S.radius*j/12));
  }
  const balusters=new THREE.InstancedMesh(geometry,materials.iron,posts.length);balusters.name='Service stair slender vertical balusters';
  posts.forEach((matrix,i)=>balusters.setMatrixAt(i,matrix));balusters.computeBoundingBox();balusters.computeBoundingSphere();root.add(balusters);
  root.userData.walkingSamples=route.map(p=>({x:p.x,y:p.y,z:p.z}));
  return root;
}
