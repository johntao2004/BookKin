import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {MeshoptEncoder} from 'meshoptimizer/encoder';
import {MeshoptDecoder} from '../../apps/web/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(ROOT,'apps/web/public/assets/hogwarts-library');
await fs.mkdir(OUT,{recursive:true});
const SOURCE=path.resolve(process.argv[2]??path.join(ROOT,'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'));
const source=await fs.readFile(SOURCE),jl=source.readUInt32LE(12),original=JSON.parse(source.toString('utf8',20,20+jl)),bin=source.subarray(28+jl);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
function view(id){const v=original.bufferViews[id];return bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)}
function accessor(id){const a=original.accessors[id],v=view(a.bufferView);assert.equal(a.byteOffset??0,0);return {a,bytes:v};}
function fineRegion(cx,cy,cz,min,max,material){
 if(max[1]<.08)return 'core-floor';
 if(min[1]>5.7&&max[1]<6.24&&(Math.abs(cx)>8.5||Math.abs(cz)>15))return 'core-gallery-floor';
 if((min[0]>14.74||max[0]<-14.74)||(min[2]>17.84||max[2]<-17.84))return 'core-enclosure';
 if(min[1]>=13.5&&Math.abs(cx)<9.1)return 'core-main-vault';
 if(material==='Stone • carved pale scholar')return `scholar-${cx<0?'left':'right'}-${Math.round(cz/5)*5}`;
 if(material==='Bronze • end niche scholar')return 'a-end-bronze-pair';
 if(Math.abs(cx)<1.4&&Math.abs(cz+11.7)<1.4&&cy>.08&&cy<3.2)return 'globe';
 if(cy<8&&Math.hypot(Math.abs(cx)-6.8,cz+13.5)<2.6)return `stair-${cx<0?'left':'right'}`;
 if(cy>=5.75&&cy<7.9&&Math.abs(cx)>8.1&&Math.abs(cx)<9.3)return 'core-gallery-guards';
 if(cz<-15.3)return 'a-end';
 if(cz>15.3)return 'b-end';
 if(Math.abs(cx)>8.2)return `bay-${cx<0?'left':'right'}-${Math.max(0,Math.min(5,Math.floor((cz+15)/5)))}`;
 if(cy>=6)return 'central-lighting';
 return cz<0?'central-furniture-south':'central-furniture-north';
}
function region(cx,cy,cz,min,max,material){
 const id=fineRegion(cx,cy,cz,min,max,material);
 if(id.startsWith('core-'))return 'core';
 if(id.startsWith('bay-')||id.startsWith('scholar-')){
  // A few source triangles cross many bays; retain them whole in structural core.
  if(max[2]-min[2]>6)return 'core';
  const sector=Math.max(0,Math.min(2,Math.floor((cz+15)/10)));
  return `sector-${cx<0?'left':'right'}-${sector}`;
 }
 if(id.startsWith('stair-'))return `sector-${cx<0?'left':'right'}-0`;
 if(id==='a-end-bronze-pair')return 'a-end';
 return id;
}

const parts=new Map();let total=0;
for(const [meshId,mesh] of original.meshes.entries())for(const [primId,p] of mesh.primitives.entries()){
 const positions=accessor(p.attributes.POSITION);const P=new Float32Array(positions.bytes.buffer,positions.bytes.byteOffset,positions.bytes.length/4);
 const inds=accessor(p.indices),I=inds.a.componentType===5123?new Uint16Array(inds.bytes.buffer,inds.bytes.byteOffset,inds.a.count):new Uint32Array(inds.bytes.buffer,inds.bytes.byteOffset,inds.a.count);
 const per=new Map();
 for(let t=0;t<I.length;t+=3){
  const ids=[I[t],I[t+1],I[t+2]],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],c=[0,0,0];
  for(const id of ids)for(let a=0;a<3;a++){const n=P[id*3+a];c[a]+=n/3;min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n)}
  const id=region(...c,min,max,original.materials[p.material].name),entry=per.get(id)??[];entry.push(...ids);per.set(id,entry);total++;
 }
 for(const [name,indices] of per){
  const part=parts.get(name)??{name,primitives:[],sourceTriangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  const remap=new Map(),unique=[];for(const i of indices)if(!remap.has(i)){remap.set(i,unique.length);unique.push(i)}
  const attributes={};
  for(const [semantic,id] of Object.entries(p.attributes)){
   const input=accessor(id),stride=input.bytes.length/input.a.count;const bytes=Buffer.alloc(unique.length*stride);
   for(let k=0;k<unique.length;k++)input.bytes.copy(bytes,k*stride,unique[k]*stride,(unique[k]+1)*stride);
   attributes[semantic]={bytes,stride,componentType:input.a.componentType,type:input.a.type,count:unique.length};
  }
  const IndexArray=unique.length<=65535?Uint16Array:Uint32Array;
  const ix=new IndexArray(indices.map(i=>remap.get(i)));
  for(const i of unique)for(let a=0;a<3;a++){part.min[a]=Math.min(part.min[a],P[i*3+a]);part.max[a]=Math.max(part.max[a],P[i*3+a])}
  part.primitives.push({attributes,indices:ix,material:p.material,sourceMesh:meshId,sourcePrimitive:primId,sourceTriangleCount:indices.length/3});
  part.sourceTriangles+=indices.length/3;parts.set(name,part);
 }
}
const textures=[];await fs.mkdir(path.join(OUT,'textures'),{recursive:true});
for(const [i,img]of original.images.entries()){const bytes=view(img.bufferView),filename=`${sha(bytes)}.png`;await fs.writeFile(path.join(OUT,'textures',filename),bytes);textures.push({id:i,name:img.name,bytes:bytes.length,sha256:sha(bytes),uri:`../textures/${filename}`})}
await fs.mkdir(path.join(OUT,'modules'),{recursive:true});const inventory=[];
for(const part of parts.values()){
 let offset=0,decoded=0;const chunks=[],views=[],accessors=[],primitives=[];
 const append=(bytes)=>{const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad}const start=offset;chunks.push(Buffer.from(bytes));offset+=bytes.length;return start};
 function encode(bytes,count,stride,mode,componentType,type,min,max){
  const compressed=MeshoptEncoder.encodeGltfBuffer(bytes,count,stride,mode,1),out=new Uint8Array(bytes.length);MeshoptDecoder.decodeGltfBuffer(out,count,stride,compressed,mode,'NONE');assert.ok(Buffer.from(out).equals(bytes));
  const id=views.length,access=accessors.length;views.push({buffer:1,byteOffset:decoded,byteLength:bytes.length,extensions:{KHR_meshopt_compression:{buffer:0,byteOffset:append(compressed),byteLength:compressed.length,byteStride:stride,count,mode,filter:'NONE'}}});decoded+=bytes.length;
  accessors.push({bufferView:id,componentType,count,type,...(min?{min,max}:{})});return access;
 }
 for(const primitive of part.primitives){const attrs={};for(const [semantic,a]of Object.entries(primitive.attributes)){
  let min,max;if(semantic==='POSITION'){min=[Infinity,Infinity,Infinity];max=[-Infinity,-Infinity,-Infinity];const f=new Float32Array(a.bytes.buffer,a.bytes.byteOffset,a.bytes.length/4);for(let j=0;j<f.length;j++){min[j%3]=Math.min(min[j%3],f[j]);max[j%3]=Math.max(max[j%3],f[j]);}}
  attrs[semantic]=encode(a.bytes,a.count,a.stride,'ATTRIBUTES',a.componentType,a.type,min,max);
 }const ix=primitive.indices,indexSize=ix.BYTES_PER_ELEMENT,indices=encode(Buffer.from(ix.buffer),ix.length,indexSize,'INDICES',indexSize===2?5123:5125,'SCALAR');primitives.push({attributes:attrs,indices,material:primitive.material});}
 const doc={asset:original.asset,extensionsUsed:[...original.extensionsUsed,'KHR_meshopt_compression'],extensionsRequired:['KHR_meshopt_compression'],scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:part.name}],meshes:[{primitives}],materials:original.materials,textures:original.textures,images:original.images.map((x,i)=>({name:x.name,mimeType:x.mimeType,uri:textures[i].uri})),samplers:original.samplers,accessors,bufferViews:views,buffers:[{byteLength:offset},{byteLength:decoded,extensions:{KHR_meshopt_compression:{fallback:true}}}]};
 const json=Buffer.from(JSON.stringify(doc)),jp=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(jp);const bb=Buffer.concat(chunks),bp=Buffer.alloc(Math.ceil(bb.length/4)*4);bb.copy(bp);
 const result=Buffer.alloc(28+jp.length+bp.length);result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(jp.length,12);result.writeUInt32LE(0x4e4f534a,16);jp.copy(result,20);result.writeUInt32LE(bp.length,20+jp.length);result.writeUInt32LE(0x004e4942,24+jp.length);bp.copy(result,28+jp.length);
 await fs.writeFile(path.join(OUT,'modules',`${part.name}.glb`),result);
 const materialIds=[...new Set(part.primitives.map(p=>p.material))];inventory.push({name:part.name,fileBytes:result.length,sha256:sha(result),triangles:part.sourceTriangles,primitives:part.primitives.length,decodedGeometryBytes:decoded,bounds:{min:part.min,max:part.max},materialIds});
}
assert.equal(inventory.reduce((s,p)=>s+p.triangles,0),1552983);
const report={sourceBytes:source.length,sourceSha256:sha(source),modules:inventory.sort((a,b)=>a.name.localeCompare(b.name)),textures,totals:{modules:inventory.length,triangles:total,moduleBytes:inventory.reduce((s,p)=>s+p.fileBytes,0),texturesBytes:textures.reduce((s,p)=>s+p.bytes,0),decodedGeometryBytes:inventory.reduce((s,p)=>s+p.decodedGeometryBytes,0),primitives:inventory.reduce((s,p)=>s+p.primitives,0)}};
await fs.writeFile(path.join(ROOT,'docs/verification/reference-library-modules.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.totals));console.log(JSON.stringify(inventory.sort((a,b)=>b.fileBytes-a.fileBytes).slice(0,10).map(({name,fileBytes,triangles,primitives})=>({name,fileBytes,triangles,primitives})),null,2));

const bank={asset:original.asset,extensionsUsed:original.extensionsUsed,scene:0,scenes:[{nodes:[]}],nodes:[],
 materials:original.materials,textures:original.textures,samplers:original.samplers,
 images:original.images.map((im,i)=>({name:im.name,mimeType:im.mimeType,uri:`textures/${path.basename(textures[i].uri)}`}))};
const bankBytes=Buffer.from(JSON.stringify(bank));await fs.writeFile(path.join(OUT,'materials.gltf'),bankBytes);
const startup=new Set(['core','a-end','sector-left-2','sector-right-2','globe','central-furniture-north','central-furniture-south','central-lighting']);
const materialCapacityLimits=original.materials.map((m,id)=>({name:m.name,vertices:0,indices:0}));
for(const part of parts.values())for(const p of part.primitives){materialCapacityLimits[p.material].vertices+=p.attributes.POSITION.count;materialCapacityLimits[p.material].indices+=p.indices.length;}
const manifest={materialCapacityLimits,version:1,revision:'20261008-reference-modules-r3',
 source:{sha256:report.sourceSha256,bytes:report.sourceBytes,triangles:total},
 materialsUrl:`/assets/hogwarts-library/materials.gltf?v=${sha(bankBytes).slice(0,16)}`,
 chunks:inventory.map(m=>({id:m.name,url:`/assets/hogwarts-library/modules/${m.name}.glb?v=${m.sha256.slice(0,16)}`,
 bytes:m.fileBytes,sha256:m.sha256,triangles:m.triangles,primitives:m.primitives,decodedGeometryBytes:m.decodedGeometryBytes,
 bounds:m.bounds,core:m.name==='core',startup:startup.has(m.name)})),
 textures:textures.map(t=>({...t,uri:`textures/${path.basename(t.uri)}`}))};
await fs.writeFile(path.join(OUT,'library-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
