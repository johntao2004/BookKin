import * as THREE from 'three';

/** A photographic sky over a colour-matched lower atmosphere. The bottom of
 * the background fades to stone-grey rather than leaving the courtyard slab
 * floating against white. This is background, never extra walkable land. */
export function createPalaceSky({dayTexture=null,eveningTexture=null}={}){
  const radius=360,geometry=new THREE.SphereGeometry(radius,96,48),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  const colors=new Float32Array(position.count*3),dayColors=new Float32Array(position.count*3),eveningColors=new Float32Array(position.count*3),indices=geometry.index;
  const interpolate=(elevation,evening=false)=>{
    const stops=evening?[[-1,0x586367],[-.08,0x79858a],[0,0x8f9fa9],[.30,0x4c687f],[1,0x243e59]]:[[-1,0x78817c],[-.12,0x8d9790],[0,0x9fbee0],[.32,0x79a9c7],[1,0x427fa9]];
    let i=0;while(i<stops.length-2&&elevation>stops[i+1][0])i++;
    return new THREE.Color(stops[i][1]).lerp(new THREE.Color(stops[i+1][1]),THREE.MathUtils.clamp((elevation-stops[i][0])/(stops[i+1][0]-stops[i][0]),0,1));
  };
  for(let i=0;i<position.count;i++){
    const y=position.getY(i)/radius,d=interpolate(y),e=interpolate(y,true);
    dayColors.set([d.r,d.g,d.b],i*3);eveningColors.set([e.r,e.g,e.b],i*3);
    // The supplied panorama's photographed horizon is at 60% image height
    // (v=.40). Fit only its sky hemisphere, leaving the lower ground haze
    // independent. No stretching of the image's lower half into the sky.
    uv.setY(i,Math.max(0,uv.getY(i)*1.2-.2));
  }
  colors.set(dayColors);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.clearGroups();
  let start=0,current=-1;
  for(let i=0;i<indices.count;i+=3){
    const height=(position.getY(indices.getX(i))+position.getY(indices.getX(i+1))+position.getY(indices.getX(i+2)))/3;
    const materialIndex=height>=0?0:1;
    if(current!==materialIndex){if(i>start)geometry.addGroup(start,i-start,current);start=i;current=materialIndex;}
  }
  geometry.addGroup(start,indices.count-start,current);
  const skyMaterial=new THREE.MeshBasicMaterial({map:dayTexture,color:0xffffff,vertexColors:!dayTexture,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false});
  // A tiny procedural colour ramp is sampled per pixel in both renderers.
  // The CPU fallback averages vertex colours per face, which would otherwise
  // expose large triangular bands in the unobstructed lower atmosphere.
  const hazeRamp=evening=>{
    const data=new Uint8Array(4*256*4);
    for(let row=0;row<256;row++){
      const v=(row+.5)/256,elevation=Math.sin(((v+.2)/1.2-.5)*Math.PI),c=interpolate(elevation,evening).convertLinearToSRGB();
      for(let col=0;col<4;col++){const p=(row*4+col)*4;data[p]=Math.round(c.r*255);data[p+1]=Math.round(c.g*255);data[p+2]=Math.round(c.b*255);data[p+3]=255;}
    }
    const texture=new THREE.DataTexture(data,4,256);texture.name='ArchitecturalDetail_Continuous_Lower_Atmosphere_'+(evening?'Evening':'Day');
    texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
  };
  const dayHaze=hazeRamp(false),eveningHaze=hazeRamp(true);
  const hazeMaterial=new THREE.MeshBasicMaterial({map:dayHaze,color:0xffffff,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false});
  skyMaterial.name='V13_Natural_Blue_Sky_Thin_Clouds';hazeMaterial.name='V13_Stone_Coloured_Lower_Atmosphere';
  if(dayTexture){dayTexture.colorSpace=THREE.SRGBColorSpace;dayTexture.needsUpdate=true;}
  if(eveningTexture){eveningTexture.colorSpace=THREE.SRGBColorSpace;eveningTexture.needsUpdate=true;}
  const group=new THREE.Mesh(geometry,[skyMaterial,hazeMaterial]);group.name='V13_Natural_Palace_Sky';group.userData={backgroundOnly:true,collision:'none',photographicSky:!!dayTexture,lowerAtmosphere:true,photographHorizonV:.4};group.rotation.y=Math.PI;group.renderOrder=-100;
  return{group,setEvening(value){
    const texture=value?eveningTexture:dayTexture;skyMaterial.map=texture;skyMaterial.vertexColors=!texture;hazeMaterial.map=value?eveningHaze:dayHaze;hazeMaterial.needsUpdate=true;
    geometry.attributes.color.array.set(value?eveningColors:dayColors);geometry.attributes.color.needsUpdate=true;skyMaterial.needsUpdate=true;
  }};
}
