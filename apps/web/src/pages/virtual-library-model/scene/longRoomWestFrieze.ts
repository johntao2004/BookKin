import * as THREE from 'three';

/** Photographic/textual character study; module dimensions are not surveyed. */
export function createWestStairFrieze(length: number, plaster: THREE.Material, withScrolls = true) {
  const root = new THREE.Group(); root.name = 'West study running scroll frieze';
  const section = new THREE.Shape();
  section.moveTo(-0.21,0.12); section.lineTo(-0.21,0.17);
  section.lineTo(-0.18,0.17); section.quadraticCurveTo(-0.15,0.15,-0.13,0.145);
  section.lineTo(0.13,0.145); section.quadraticCurveTo(0.16,0.17,0.18,0.185);
  section.lineTo(0.21,0.185); section.lineTo(0.21,0.12); section.closePath();
  const backing = new THREE.ExtrudeGeometry(section,{depth:length,steps:1,bevelEnabled:false,curveSegments:8});
  // Section coordinates describe height and relief depth; extrusion spans the wall.
  backing.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),
  ));
  backing.translate(-length/2,0,0);
  const band = new THREE.Mesh(backing,plaster); band.name = 'Profiled plaster frieze bed';
  band.castShadow=band.receiveShadow=true; root.add(band);
  if (!withScrolls) return root;
  const stem = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.3,-0.095,0),new THREE.Vector3(-0.13,-0.095,0),
    new THREE.Vector3(-0.16,0.12,0),new THREE.Vector3(0.025,0.12,0),
  );
  const points = stem.getPoints(32);
  // A tightening curl has a curved silhouette, unlike stacked circles or square blocks.
  for(let i=1;i<=56;i++) {
    const t=i/56, angle=Math.PI/2-t*Math.PI*1.7, radius=0.095*(1-t)+0.014*t;
    points.push(new THREE.Vector3(0.025+Math.cos(angle)*radius,0.025+Math.sin(angle)*radius,0));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve,96,0.014,8,false);
  const count=Math.floor(length/0.62), spacing=length/count;
  const curls=new THREE.InstancedMesh(geometry,plaster,count); curls.name='Continuous curved plaster scroll studies';
  const transform=new THREE.Matrix4();
  for(let i=0;i<count;i++) {
    transform.makeTranslation(-length/2+(i+0.5)*spacing,0,0.16);
    curls.setMatrixAt(i,transform);
  }
  root.add(curls);
  root.traverse(object=>{if(object instanceof THREE.Mesh) object.castShadow=object.receiveShadow=true;});
  return root;
}
