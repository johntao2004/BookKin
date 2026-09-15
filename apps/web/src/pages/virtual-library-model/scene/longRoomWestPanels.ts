import * as THREE from 'three';

type Point = [number,number];

function inset(points:Point[], distance:number):Point[] {
  return points.map((point,i)=>{
    const before=new THREE.Vector2(...point).sub(new THREE.Vector2(...points[(i+points.length-1)%points.length])).normalize();
    const after=new THREE.Vector2(...points[(i+1)%points.length]).sub(new THREE.Vector2(...point)).normalize();
    const scale=distance/(1+before.dot(after));
    return [point[0]-(before.y+after.y)*scale,point[1]+(before.x+after.x)*scale];
  });
}

function molding(points:Point[], width:number, depth:number, material:THREE.Material) {
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  shape.closePath();
  const hole=new THREE.Path(inset(points,width).reverse().map(p=>new THREE.Vector2(...p)));
  hole.closePath(); shape.holes.push(hole);
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,
    bevelSize:0.004,bevelThickness:0.004,bevelSegments:3,steps:1}),material);
}

/** Scalloped plaster leaf with a raised central fold; local +Y points to the tip. */
function leafGeometry() {
  const rows=24, columns=8, positions:number[]=[], faces:number[]=[];
  for(let row=0;row<=rows;row++) {
    const t=row/rows, envelope=Math.pow(Math.sin(Math.PI*t),0.7);
    const halfWidth=0.006+0.095*envelope*(0.76+0.24*Math.cos(t*Math.PI*10));
    for(let column=0;column<=columns;column++) {
      const u=column/columns*2-1;
      positions.push(u*halfWidth,t*0.4-0.045*Math.pow(t,8),0.008+envelope*(0.032*(1-Math.abs(u))
        +0.009*Math.cos(t*Math.PI*10-Math.abs(u)*3))+0.065*Math.pow(t,5));
    }
  }
  for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
    const a=row*(columns+1)+column,b=a+1,c=a+columns+1;
    faces.push(a,b,c,b,c+1,c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(faces); geometry.computeVertexNormals(); return geometry;
}

/** Casey 2018 photo character: narrow plain field beside a lugged, foliate field.
 * Widths, heights, contour offsets and carving proportions remain estimates. */
export function createWestStairPanel(width:number,height:number,plaster:THREE.Material,decorated=true) {
  const root=new THREE.Group(); root.name=decorated?'West study lugged foliate wall panel':'West study narrow plain wall panel';
  root.userData.fidelity='photo-character-unmeasured-panel-study';
  const w=width/2,h=height/2;
  const outline:Point[]=decorated
    ? [[-w,-h],[-w+0.3,-h],[-w+0.3,-h+0.12],[w-0.3,-h+0.12],[w-0.3,-h],[w,-h],
      [w,h-0.3],[w+0.16,h-0.3],[w+0.16,h],[w-0.16,h],[w-0.16,h+0.14],
      [-w+0.16,h+0.14],[-w+0.16,h],[-w-0.16,h],[-w-0.16,h-0.3],[-w,h-0.3]]
    : [[-w,-h],[w,-h],[w,h],[-w,h]];
  const outer=molding(outline,0.065,0.035,plaster); outer.name='Beveled plaster outer molding'; root.add(outer);
  const inner=molding(inset(outline,0.11),0.018,0.018,plaster); inner.name='Recessed inner plaster bead'; root.add(inner);
  if(decorated) {
    const leaf=leafGeometry();
    const addLeaf=(x:number,y:number,angle:number,scale:number)=>{
      const mesh=new THREE.Mesh(leaf,plaster); mesh.name='Scalloped acanthus crest leaf';
      mesh.position.set(x,y,0.035); mesh.rotation.z=angle; mesh.scale.setScalar(scale); root.add(mesh);
    };
    for(const side of [-1,1]) {
      const branch=new THREE.CubicBezierCurve3(new THREE.Vector3(0,h+0.19,0.03),
        new THREE.Vector3(side*0.38,h+0.57,0.03),new THREE.Vector3(side*(w+0.42),h+0.44,0.03),
        new THREE.Vector3(side*(w+0.27),h-0.29,0.03));
      const stem=new THREE.Mesh(new THREE.TubeGeometry(branch,48,0.014,8,false),plaster);
      stem.name='Curved acanthus crest stem'; root.add(stem);
      for(let i=1;i<=5;i++) {
        const t=i/6,point=branch.getPoint(t),tangent=branch.getTangent(t);
        const direction=Math.atan2(-tangent.x,tangent.y);
        addLeaf(point.x,point.y,direction+side*0.9,1.05);
        if(i<5) addLeaf(point.x,point.y,direction-side*0.95,0.78);
      }
      const curlPoints=Array.from({length:49},(_,i)=>{
        const t=i/48,angle=-Math.PI/2+t*Math.PI*1.6,radius=0.16*(1-t)+0.025*t;
        return new THREE.Vector3(side*(w*0.52+Math.cos(angle)*radius),h+0.3+Math.sin(angle)*radius,0.06);
      });
      const curl=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curlPoints),48,0.017,8,false),plaster);
      curl.name='Crest inward curled volute'; root.add(curl);
    }
    for(const angle of [-0.55,0,0.55]) addLeaf(0,h+0.12,angle,1.25);
  }
  root.traverse(object=>{if(object instanceof THREE.Mesh) object.castShadow=object.receiveShadow=true;});
  return root;
}
