import * as THREE from 'three';

/** Layout reconstructed from Irish Aesthete's 2019 west-stair ceiling photographs.
 * Four outward cartouches, diagonal tendrils, four inner floral groups, open centre.
 * All coordinates and carved profiles are estimates, not a measured/traced ceiling. */
export function createWestStairCeilingRelief(plaster: THREE.Material) {
  const root = new THREE.Group(); root.name = 'West stair rococo ceiling relief';
  root.userData.fidelity = 'photographic-layout-estimated-carving';
  const leafPositions:number[] = [], indices:number[] = [];
  const rows=24, columns=10;
  for(let row=0;row<=rows;row++) {
    const t=row/rows, envelope=Math.sin(Math.PI*t);
    const width=0.145*Math.pow(envelope,0.7)*(0.86+0.14*Math.cos(t*Math.PI*8));
    for(let col=0;col<=columns;col++) {
      const u=col/columns*2-1;
      leafPositions.push(u*width,t*0.42-0.055*t**6,
        0.007+0.048*envelope*(1-u*u)+0.008*envelope*Math.cos(u*Math.PI*3)+0.045*t**5);
    }
  }
  for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
    const a=row*(columns+1)+col,b=a+1,c=a+columns+1;
    indices.push(a,b,c,b,c+1,c);
  }
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
  leafGeometry.setIndex(indices); leafGeometry.computeVertexNormals();
  const leaf=(parent:THREE.Group,x:number,y:number,angle:number,scale=1)=>{
    const mesh=new THREE.Mesh(leafGeometry,plaster); mesh.name='Folded ceiling foliage';
    mesh.position.set(x,y,0.025);mesh.rotation.z=angle;mesh.scale.setScalar(scale);parent.add(mesh);
  };
  const ribbon=(path:THREE.CatmullRomCurve3,width:number)=>{
    const positions:number[]=[],faces:number[]=[];const steps=96,across=10;
    for(let i=0;i<=steps;i++) {
      const t=i/steps,p=path.getPoint(t),tangent=path.getTangent(t);
      const halfWidth=width*(0.3+0.7*Math.sqrt(Math.sin(Math.PI*t)))*(1-0.4*t);
      for(let j=0;j<=across;j++) {
        const u=j/across*2-1;
        positions.push(p.x+tangent.y*u*halfWidth,p.y-tangent.x*u*halfWidth,
          p.z+0.026*(1-u*u)+0.009*Math.cos(u*Math.PI*2));
      }
    }
    for(let i=0;i<steps;i++) for(let j=0;j<across;j++) {
      const a=i*(across+1)+j,b=a+1,c=a+across+1;faces.push(a,b,c,b,c+1,c);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(faces);geometry.computeVertexNormals();return geometry;
  };
  const stem=(parent:THREE.Group,points:THREE.Vector3[],radius=0.014,bandWidth=0)=>{
    const path=new THREE.CatmullRomCurve3(points);
    const mesh=new THREE.Mesh((bandWidth ? ribbon(path,bandWidth) : new THREE.TubeGeometry(path,64,radius,8,false)),plaster);
    mesh.name=bandWidth?'Modeled rococo ribbon scroll':'Ceiling raised scroll stem';parent.add(mesh);return path;
  };
  // Construct one cardinal ornament then rotate shared geometry into four positions.
  const cardinal=new THREE.Group();cardinal.name='Outward shell and open cartouche';
  for(const side of [-1,1]) {
    const path=stem(cardinal,[[0,1.45],[side*0.31,1.67],[side*0.34,1.98],
      [side*0.2,2.14],[side*0.08,2.04],[side*0.15,1.97]].map(([x,y])=>new THREE.Vector3(x,y,0.035)),0.021,0.055);
    const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(0.017,12,8),plaster,10);
    beads.name='Cartouche inner scalloped beadwork';
    for(let i=0;i<10;i++) {
      const p=path.getPoint(0.14+i*0.06);
      beads.setMatrixAt(i,new THREE.Matrix4().compose(
        new THREE.Vector3(p.x-side*0.045,p.y,0.046),new THREE.Quaternion(),new THREE.Vector3(1,1,0.75)));
    }
    cardinal.add(beads);
    for(const t of [0.2,0.4,0.58]) {
      const p=path.getPoint(t);leaf(cardinal,p.x,p.y,-side*0.9,0.78);
    }
    const outer=stem(cardinal,[[side*0.2,1.68],[side*0.61,1.67],[side*0.88,1.99],
      [side*0.62,2.31],[side*0.41,2.23]].map(([x,y])=>new THREE.Vector3(x,y,0.025)),0.014,0.045);
    for(const t of [0.15,0.34,0.53,0.7]) {
      const p=outer.getPoint(t),v=outer.getTangent(t);
      leaf(cardinal,p.x,p.y,Math.atan2(-v.x,v.y)-side*0.65,1.25);
    }
  }
  // Radiating lobes describe the shell-shaped outer crest rather than a solid medallion.
  for(let i=-4;i<=4;i++) leaf(cardinal,i*0.018,2.13,-i*0.145,0.78+0.18*(1-Math.abs(i)/4));
  leaf(cardinal,0,1.5,Math.PI,0.58);
  // Each large cartouche contains its own small flower, separate from the four inner sprays.
  for(let i=0;i<8;i++) leaf(cardinal,0,1.83,i*Math.PI/4,0.23);
  const cartoucheBud=new THREE.Mesh(new THREE.SphereGeometry(0.018,16,10),plaster);
  cartoucheBud.name='Cartouche central flower heart';cartoucheBud.position.set(0,1.83,0.05);
  cartoucheBud.scale.z=0.65;cardinal.add(cartoucheBud);
  for(let i=0;i<4;i++) {const ornament=cardinal.clone();ornament.rotation.z=i*Math.PI/2;root.add(ornament);}
  const diagonal=new THREE.Group();diagonal.name='Diagonal trailing ceiling foliage';
  const diagonalPath=stem(diagonal,[[1.22,1.18],[1.52,1.59],[1.88,1.95],[2.19,2.31],[2.52,2.65]]
    .map(([x,y])=>new THREE.Vector3(x,y,0.018)),0.012);
  for(let i=0;i<8;i++) {
    const t=0.08+i*0.11,p=diagonalPath.getPoint(t);
    leaf(diagonal,p.x,p.y,-Math.PI/4+(i%2?0.85:-0.85),1.3-t*0.8);
  }
  for(let i=0;i<4;i++) {const spray=diagonal.clone();spray.rotation.z=i*Math.PI/2;root.add(spray);}
  const flower=new THREE.Group();flower.name='Inner ceiling floral spray';
  for(let i=0;i<7;i++) leaf(flower,0,0,i*Math.PI*2/7,0.66);
  const bud=new THREE.Mesh(new THREE.SphereGeometry(0.038,16,12),plaster);bud.scale.z=0.5;bud.position.z=0.04;flower.add(bud);
  for(const x of [-0.79,0.79]) for(const y of [-0.79,0.79]) {
    const spray=flower.clone();spray.position.set(x,y,0);root.add(spray);
  }
  root.scale.y=1.13;
  root.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=true;});
  return root;
}
