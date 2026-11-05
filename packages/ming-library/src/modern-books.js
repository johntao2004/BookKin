import * as THREE from 'three';

/**
 * Dynamic modern books for Guanwen Library.
 * No custom shaders: merged UV geometry + standard glTF-compatible materials.
 * Shelf slot origin = bottom centre of the spine, spine faces local +Z.
 * The book extends into the shelf along -Z. All dimensions are in metres.
 */

const PALETTE = ['#29434d','#773c34','#ccb88c','#354b3c','#485979','#9e6d42','#6b5865','#c8c8ba','#304c57','#887953','#5c6866','#b1a17c'];
const FONT = 'Silvae Serif, Noto Serif SC, serif';
const PER_PAGE = 64;
const FACES_PER_BOOK = 18; // Nine casing quads, two triangles per quad.
const VERTICES_PER_BOOK = 36;
const MAX_BOOKS = 16384;
const MAX_SLOTS = 60000;
const COVER_FIELDS = ['coverUrl','backCoverUrl','spineUrl'];

function hash(text) { let h=2166136261; for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619); return h>>>0; }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function numeric(value,fallback,min,max,label) {
  if(value===undefined||value===null||value==='')return fallback;
  const n=Number(value);if(!Number.isFinite(n))throw new TypeError(`${label} 必须是有限数值。`);
  return clamp(n,min,max);
}
function textValue(value,max=160) { return value===undefined||value===null?'':String(value).trim().slice(0,max); }
function normalizeURL(value,label='图片地址') {
  const input=value===undefined||value===null?'':String(value).trim();if(!input)return '';
  if(input.length>8_000_000)throw new RangeError(`${label}过大，请使用图片 URL 或压缩封面图片。`);
  if(/^data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml)(?:;|,)/i.test(input))return input;
  if(/^blob:/i.test(input))return input;
  const base=typeof location!=='undefined'&&/^https?:/.test(location.protocol)?location.href:'https://example.invalid/';
  let parsed;try{parsed=new URL(input,base);}catch{throw new TypeError(`${label}不是有效地址。`);}
  if(!['http:','https:'].includes(parsed.protocol))throw new TypeError(`${label}仅支持 HTTP(S)、图片 data URL 或本地 Blob。`);
  // Preserve relative URLs so imported data remains portable to its host site.
  return /^[a-z][a-z0-9+.-]*:/i.test(input)?parsed.href:input;
}
function normalizeReadURL(value) {
  if(!value)return '';
  const input=textValue(value,4096);const base=typeof location!=='undefined'&&/^https?:/.test(location.protocol)?location.href:'https://example.invalid/';
  const u=new URL(input,base);if(!['http:','https:'].includes(u.protocol))throw new TypeError('readUrl 仅支持 HTTP(S)或站内路径。');
  return /^[a-z][a-z0-9+.-]*:/i.test(input)?u.href:input;
}

/** Validate one record. Collection operations additionally reject duplicate IDs. */
export function normalizeBookData(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('每条书目必须是对象。');
  const title=textValue(input.title);if(!title)throw new TypeError('书名 title 不能为空。');
  const author=textValue(input.author,120);
  const id=textValue(input.id,160)||`book-${hash(`${title}|${author}`).toString(36)}`;
  const pageCount=Math.round(numeric(input.pageCount,360,24,2500,'pageCount'));
  const height=numeric(input.height,.38,.14,.70,'height');
  const width=numeric(input.width,.25,.09,.50,'width');
  const thickness=numeric(input.thickness,clamp(pageCount*.000135+.006,.018,.16),.012,.20,'thickness');
  let color=textValue(input.color,32);
  if(typeof input.color==='number'&&Number.isFinite(input.color))color='#'+(input.color>>>0).toString(16).padStart(6,'0').slice(-6);
  if(!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color))color=PALETTE[hash(id)%PALETTE.length];
  return {id,title,author,coverUrl:normalizeURL(input.coverUrl,'coverUrl'),
    spineUrl:normalizeURL(input.spineUrl,'spineUrl'),backCoverUrl:normalizeURL(input.backCoverUrl,'backCoverUrl'),
    pageCount,width,height,thickness,color,category:textValue(input.category,80)||'未分类',
    readUrl:normalizeReadURL(input.readUrl),description:textValue(input.description,1600),
    isbn:textValue(input.isbn,32)};
}

function normalizeBooks(books,max=MAX_BOOKS) {
  if(!Array.isArray(books))throw new TypeError('books 必须是书目数组。');
  if(books.length>max)throw new RangeError(`一次最多加载 ${max} 种书目，请按分馆或分类分批传入。`);
  const map=new Map();for(const raw of books){const book=normalizeBookData(raw);if(map.has(book.id))throw new Error(`书目 ID 重复：${book.id}`);map.set(book.id,book);}
  return map;
}

function makeCanvas(w,h) {
  if(typeof document==='undefined')throw new Error('书籍贴图需要浏览器 Canvas；请在浏览器中创建模型。');
  const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
function readableInk(color) {
  const c=new THREE.Color(color);return c.r*.2126+c.g*.7152+c.b*.0722>.42?'#233135':'#f1e9d9';
}
function roundedRect(ctx,x,y,w,h,r) {
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function wrapText(ctx,text,x,y,width,lineHeight,maxLines=5) {
  let line='',row=0;for(const ch of [...text]){if(ctx.measureText(line+ch).width>width&&line){ctx.fillText(line,x,y+row*lineHeight);row++;line='';if(row>=maxLines)return;}line+=ch;}
  if(line&&row<maxLines)ctx.fillText(line,x,y+row*lineHeight);
}

function drawCover(ctx,rect,book,image=null,{back=false}={}) {
  const {x,y,w,h}=rect;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.fillStyle=book.color;ctx.fillRect(x,y,w,h);
  if(image){
    // Preserve all artwork; letterbox to the physical cover ratio, never mirror.
    const iw=image.width||image.naturalWidth,ih=image.height||image.naturalHeight;
    const ar=iw/ih,target=book.width/book.height;let dw=w,dh=h;
    if(ar>target)dh=h*target/ar;else dw=w*ar/target;
    ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }else{
    const ink=readableInk(book.color);ctx.fillStyle=ink;
    ctx.globalAlpha=.07;for(let i=0;i<24;i++)ctx.fillRect(x+(i/24)*w,y,w*.004,h);
    ctx.globalAlpha=.9;ctx.textAlign='left';ctx.textBaseline='top';
    ctx.font=`${Math.max(7,w*.055)}px ${FONT}`;ctx.fillText(back?'GUANWEN COLLECTION':'觀文 · 現代藏書',x+w*.11,y+h*.08);
    ctx.fillRect(x+w*.11,y+h*.15,w*.78,Math.max(.5,w*.006));
    if(back){
      ctx.font=`${Math.max(7,w*.07)}px ${FONT}`;
      wrapText(ctx,book.description||`${book.title}。数字书库中的一册书，让阅读在空间中被看见。`,x+w*.12,y+h*.24,w*.76,h*.075,6);
      const yy=y+h*.80;for(let i=0;i<28;i++)if((hash(book.id)+i*7)%5>1)ctx.fillRect(x+w*.58+i*w*.009,yy,w*.004,h*.08);
    }else{
      ctx.font=`500 ${Math.max(10,w*.18)}px ${FONT}`;
      wrapText(ctx,book.title,x+w*.11,y+h*.25,w*.78,h*.145,4);
      ctx.font=`${Math.max(7,w*.07)}px ${FONT}`;ctx.fillText(book.author||'未署名',x+w*.12,y+h*.81,w*.76);
      ctx.font=`${Math.max(6,w*.047)}px ${FONT}`;ctx.fillText(book.category,x+w*.12,y+h*.91,w*.76);
    }
  }
  ctx.restore();
}

function drawSpine(ctx,rect,book,image=null) {
  const {x,y,w,h}=rect;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=book.color;ctx.fillRect(x,y,w,h);
  if(image){ctx.drawImage(image,x,y,w,h);ctx.restore();return;}
  const ink=readableInk(book.color);ctx.fillStyle=ink;ctx.globalAlpha=.18;ctx.fillRect(x+w*.06,y,w*.025,h);ctx.fillRect(x+w*.91,y,w*.025,h);ctx.globalAlpha=1;
  ctx.fillRect(x+w*.21,y+h*.055,w*.58,Math.max(.5,h*.003));ctx.fillRect(x+w*.21,y+h*.93,w*.58,Math.max(.5,h*.003));
  ctx.textAlign='center';ctx.textBaseline='middle';
  const chinese=/[\u3400-\u9fff]/.test(book.title);
  if(chinese){
    const chars=[...book.title].slice(0,14);const size=Math.min(w*.67,h*.65/(chars.length+.4));ctx.font=`500 ${Math.max(4,size)}px ${FONT}`;
    const start=y+h*.18;chars.forEach((ch,i)=>ctx.fillText(ch,x+w*.5,start+i*size*1.07));
  }else{
    ctx.translate(x+w*.5,y+h*.17);ctx.rotate(Math.PI/2);ctx.textAlign='left';ctx.font=`500 ${Math.max(5,w*.57)}px ${FONT}`;ctx.fillText(book.title,0,0,h*.64);
    ctx.rotate(-Math.PI/2);ctx.translate(-x-w*.5,-y-h*.17);
  }
  ctx.font=`${Math.max(4,w*.24)}px ${FONT}`;
  [...(book.author||'觀文').slice(0,5)].forEach((c,i)=>ctx.fillText(c,x+w*.5,y+h*.79+i*h*.024));
  ctx.restore();
}

function newTexture(canvas,name) {
  const texture=new THREE.CanvasTexture(canvas);texture.name=name;texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.anisotropy=4;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
}

function atlasRects(cellX,cellY,cellSize) {
  const p=Math.max(1,cellSize*.012),x=cellX*cellSize,y=cellY*cellSize;
  return {
    front:{x:x+p,y:y+p,w:cellSize*.37-p*2,h:cellSize*.65-p*2},
    back:{x:x+cellSize*.38+p,y:y+p,w:cellSize*.37-p*2,h:cellSize*.65-p*2},
    spine:{x:x+cellSize*.78+p,y:y+p,w:cellSize*.19-p*2,h:cellSize*.96-p*2},
    solid:{x:x+p,y:y+cellSize*.79,w:cellSize*.2,h:cellSize*.14},
  };
}
function drawAtlasCell(page,entry,book,artwork={}) {
  const ctx=page.ctx,c=page.cellSize;ctx.fillStyle=book.color;ctx.fillRect(entry.cellX*c,entry.cellY*c,c,c);
  drawCover(ctx,entry.rects.front,book,artwork.coverUrl);
  drawCover(ctx,entry.rects.back,book,artwork.backCoverUrl,{back:true});
  drawSpine(ctx,entry.rects.spine,book,artwork.spineUrl);
  page.texture.needsUpdate=true;
}
async function createAtlases(books,{atlasSize=2048,maxAtlasPixels=16_777_216}={},checkpoint=async()=>{}) {
  const count=Math.ceil(books.length/PER_PAGE);const cap=clamp(Number(atlasSize)||2048,256,4096);
  const budgetSide=Math.sqrt(maxAtlasPixels/Math.max(1,count));
  const size=2**Math.floor(Math.log2(Math.max(256,Math.min(cap,budgetSide))));
  const pages=[],entries=new Map();
  for(let pageIndex=0;pageIndex<count;pageIndex++){
    const canvas=makeCanvas(size,size),ctx=canvas.getContext('2d');
    const texture=newTexture(canvas,`Modern_Book_Atlas_${pageIndex}`);
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.72,metalness:.015,side:THREE.DoubleSide});material.name=`Book_Covers_Atlas_${pageIndex}`;
    pages.push({canvas,ctx,size,cellSize:size/8,texture,material,index:pageIndex});
    await checkpoint();
  }
  for(let i=0;i<books.length;i++){const book=books[i],pageIndex=Math.floor(i/PER_PAGE),slot=i%PER_PAGE,cellX=slot%8,cellY=Math.floor(slot/8);
    const page=pages[pageIndex],entry={pageIndex,cellX,cellY,rects:atlasRects(cellX,cellY,page.cellSize)};entries.set(book.id,entry);drawAtlasCell(page,entry,book);
    if((i&7)===7)await checkpoint();
  }
  return {pages,entries,size,totalPixels:pages.length*size*size};
}

function pageMaterial() {
  const c=makeCanvas(128,256),ctx=c.getContext('2d');ctx.fillStyle='#eee9df';ctx.fillRect(0,0,128,256);
  for(let y=0;y<256;y+=3){ctx.fillStyle=y%9?'rgba(110,103,86,.13)':'rgba(110,103,86,.23)';ctx.fillRect(0,y,128,.5);}
  const texture=newTexture(c,'Modern_Book_Page_Edges');texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  const material=new THREE.MeshStandardMaterial({map:texture,color:0xfffdf6,roughness:.92});material.name='Modern_Paper_Block';return material;
}

function createImageLoader({timeout=6500,concurrency=6,cacheLimit=96,maxSide=512}={}) {
  const cache=new Map(),queue=[];let active=0,disposed=false;
  const run=()=>{while(!disposed&&active<concurrency&&queue.length){const task=queue.shift();active++;
    load(task.url).then(task.resolve,task.reject).finally(()=>{active--;run();});}};
  const load=url=>new Promise((resolve,reject)=>{
    if(typeof Image==='undefined'){reject(new Error('当前环境无法加载图片。'));return;}
    const image=new Image();image.crossOrigin='anonymous';image.decoding='async';let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=image.onerror=null;
      if(error){image.src='';reject(error);}else{resolve(result);image.src='';}};
    const timer=setTimeout(()=>finish(new Error('封面加载超时，已保留文字封面。')),timeout);
    image.onerror=()=>finish(new Error('图片无法加载或未允许跨域访问，已保留文字封面。'));
    image.onload=()=>{
      try{if(!image.naturalWidth||!image.naturalHeight)throw new Error('图片内容为空。');
        const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
        const c=makeCanvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));
        const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);ctx.getImageData(0,0,1,1);finish(null,c);
      }catch{finish(new Error('图片不满足跨域读取要求，已保留文字封面。'));}
    };
    image.src=url;
  });
  return {load(url){
    if(disposed)return Promise.reject(new Error('图像加载器已释放。'));
    if(cache.has(url)){const p=cache.get(url);cache.delete(url);cache.set(url,p);return p;}
    const promise=new Promise((resolve,reject)=>{queue.push({url,resolve,reject});run();});cache.set(url,promise);
    while(cache.size>cacheLimit)cache.delete(cache.keys().next().value);return promise;
  },dispose(){disposed=true;for(const task of queue)task.reject(new Error('模型已释放。'));queue.length=0;cache.clear();}};
}

function dimensions(book,slot={}) {
  // Real metadata remains unchanged; a bounded shelf placement may use a smaller display size.
  return {thickness:Math.max(.009,Math.min(book.thickness,Number(slot.maxThickness)||Infinity)),
    height:Math.max(.08,Math.min(book.height,Number(slot.maxHeight)||Infinity)),
    width:Math.max(.06,Math.min(book.width,Number(slot.maxDepth)||Infinity))};
}

function casingQuads(d) {
  const {thickness:t,height:h,width:w}=d,a=t/2,c=Math.min(.0035,t*.13);
  return [
    {p:[[a,0,0],[a,0,-w],[a,h,-w],[a,h,0]],n:[1,0,0],r:'front'},
    {p:[[-a,0,-w],[-a,0,0],[-a,h,0],[-a,h,-w]],n:[-1,0,0],r:'back'},
    {p:[[-a,0,.001],[a,0,.001],[a,h,.001],[-a,h,.001]],n:[0,0,1],r:'spine'},
    {p:[[a-c,h,0],[a,h,0],[a,h,-w],[a-c,h,-w]],n:[0,1,0],r:'solid'},
    {p:[[-a,h,0],[-a+c,h,0],[-a+c,h,-w],[-a,h,-w]],n:[0,1,0],r:'solid'},
    {p:[[a-c,0,-w],[a,0,-w],[a,0,0],[a-c,0,0]],n:[0,-1,0],r:'solid'},
    {p:[[-a,0,-w],[-a+c,0,-w],[-a+c,0,0],[-a,0,0]],n:[0,-1,0],r:'solid'},
    {p:[[a,0,-w],[a-c,0,-w],[a-c,h,-w],[a,h,-w]],n:[0,0,-1],r:'solid'},
    {p:[[-a+c,0,-w],[-a,0,-w],[-a,h,-w],[-a+c,h,-w]],n:[0,0,-1],r:'solid'},
  ];
}

function mergedCasingGeometry(placements,page,entries,shapeCache=new Map()) {
  const n=placements.length,positions=new Float32Array(n*VERTICES_PER_BOOK*3),normals=new Float32Array(n*VERTICES_PER_BOOK*3),uvs=new Float32Array(n*VERTICES_PER_BOOK*2);
  const IndexArray=n*VERTICES_PER_BOOK>65535?Uint32Array:Uint16Array,indices=new IndexArray(n*FACES_PER_BOOK*3);
  let vertex=0,index=0;
  for(const placement of placements){
    const {slot,book,d}=placement,entry=entries.get(book.id),a=Number(slot.rotationY)||0,cos=Math.cos(a),sin=Math.sin(a);
    const shapeKey=`${d.thickness}/${d.height}/${d.width}`;
    let faces=shapeCache.get(shapeKey);if(!faces){faces=casingQuads(d);shapeCache.set(shapeKey,faces);}
    for(const face of faces){
      const rect=entry.rects[face.r],inset=face.r==='solid'?.3:0;
      const u0=(rect.x+rect.w*inset)/page.size,u1=(rect.x+rect.w*(1-inset))/page.size;
      const v0=1-(rect.y+rect.h*(1-inset))/page.size,v1=1-(rect.y+rect.h*inset)/page.size;
      const base=vertex;
      const nx=cos*face.n[0]+sin*face.n[2],nz=-sin*face.n[0]+cos*face.n[2];
      for(let q=0;q<4;q++){
        const p=face.p[q],v=vertex*3;positions[v]=slot.x+cos*p[0]+sin*p[2];positions[v+1]=slot.y+p[1];positions[v+2]=slot.z-sin*p[0]+cos*p[2];
        normals[v]=nx;normals[v+1]=face.n[1];normals[v+2]=nz;uvs[vertex*2]=(q===0||q===3)?u0:u1;uvs[vertex*2+1]=q<2?v0:v1;vertex++;
      }
      indices.set([base,base+1,base+2,base,base+2,base+3],index);index+=6;
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function safeSlot(raw,index) {
  if(!raw||typeof raw!=='object')throw new TypeError(`槽位 ${index} 无效。`);
  const slot={...raw,x:Number(raw.x??0),y:Number(raw.y??0),z:Number(raw.z??0),rotationY:Number(raw.rotationY??0)};
  if(![slot.x,slot.y,slot.z,slot.rotationY].every(Number.isFinite))throw new TypeError(`槽位 ${index} 的坐标不是有限数值。`);
  return slot;
}

function disposeTree(group) {
  const geometry=new Set(),materials=new Set(),textures=new Set();
  group.traverse(o=>{if(!o.isMesh)return;if(o.isInstancedMesh)o.dispose();geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();
}

// Browser tasks yield between bounded pieces of real geometry. A caller may
// disable yielding for offline export/benchmarks without changing the model.
function buildCheckpoint({yieldBuild=true,buildBudgetMs=8}={}) {
  let last=performance.now(),yields=0,maxSliceMs=0;
  const checkpoint=async()=>{
    const now=performance.now(),elapsed=now-last;
    if(elapsed<buildBudgetMs)return;
    maxSliceMs=Math.max(maxSliceMs,elapsed);
    if(yieldBuild){
      if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();
      else await new Promise(resolve=>setTimeout(resolve,0));
      yields++;
    }
    last=performance.now();
  };
  checkpoint.finish=()=>({yields,maxSliceMs:Math.max(maxSliceMs,performance.now()-last)});
  return checkpoint;
}

async function buildCollectionState(slots,bookMap,options) {
  const started=performance.now(),checkpoint=buildCheckpoint(options);
  const group=new THREE.Group();group.name='Modern_Books_Dynamic_Collection';
  const records=new Map([...bookMap].map(([id,b])=>[id,{...b,placements:[]}]));
  const ordered=[...bookMap.values()],placements=[],used=new Map(),warnings=[],seenMissing=new Set(),bookPlacements=new Map();
  for(let i=0;i<slots.length;i++){
    const slot=safeSlot(slots[i],i),id=slot.bookId===undefined?ordered[i]?.id:String(slot.bookId),book=bookMap.get(id);
    if(!book){if(id&&!seenMissing.has(id)){warnings.push({id,message:'槽位引用的书目不存在，已保留空位。'});seenMissing.add(id);}continue;}
    const d=dimensions(book,slot),placement={slotIndex:i,slot,book,d};placements.push(placement);used.set(id,book);
    if(!bookPlacements.has(id))bookPlacements.set(id,[]);bookPlacements.get(id).push(placement);
    records.get(id).placements.push({slotIndex:i,shelfId:slot.shelfId,floor:slot.floor,cellId:slot.cellId,rotationY:slot.rotationY,position:[slot.x,slot.y,slot.z],dimensions:d});
    if((i&255)===255)await checkpoint();
  }
  const atlases=await createAtlases([...used.values()],options,checkpoint),instanceMap=new Map(),spatial=new Map(),chunks=new Map();
  const chunkSize=clamp(Number(options.chunkSize)||12,2,32),maxChunkBooks=1024;
  for(let i=0;i<placements.length;i++){
    const p=placements[i],cell=`${Math.floor(p.slot.x/chunkSize)},${Math.floor(p.slot.z/chunkSize)}`;
    const floor=Number.isFinite(Number(p.slot.floor))?p.slot.floor:Math.floor(p.slot.y/6);
    const key=`${floor}:${cell}`;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);
    const spatialKey=`${Math.floor(p.slot.x/8)},${Math.floor(p.slot.z/8)}`;
    if(!spatial.has(spatialKey))spatial.set(spatialKey,[]);spatial.get(spatialKey).push(p);
    if((i&511)===511)await checkpoint();
  }
  const paperGeometry=placements.length?new THREE.BoxGeometry(1,1,1):null,paperMaterial=placements.length?pageMaterial():null,temp=new THREE.Object3D();
  let chunkCount=0,meshCount=0;const shapeCache=new Map();
  for(const [cell,chunkPlacements] of chunks){
    for(let offset=0;offset<chunkPlacements.length;offset+=maxChunkBooks){
      const items=chunkPlacements.slice(offset,offset+maxChunkBooks),chunk=new THREE.Group();
      chunk.name=`Modern_Book_Chunk_${cell}_${offset/maxChunkBooks}`;
      chunk.userData={type:'book-spatial-chunk',cell,placedBooks:items.length,chunkSize};
      const byPage=new Map();
      for(const p of items){const pageIndex=atlases.entries.get(p.book.id).pageIndex;if(!byPage.has(pageIndex))byPage.set(pageIndex,[]);byPage.get(pageIndex).push(p);}
      for(const [pageIndex,pageItems] of byPage){
        const page=atlases.pages[pageIndex],mesh=new THREE.Mesh(mergedCasingGeometry(pageItems,page,atlases.entries,shapeCache),page.material);
        mesh.name=`Modern_Covers_Atlas_${pageIndex}_Chunk_${chunkCount}`;mesh.castShadow=false;mesh.receiveShadow=true;
        chunk.add(mesh);instanceMap.set(mesh.uuid,{type:'casing',placements:pageItems,facesPerBook:FACES_PER_BOOK});meshCount++;
        await checkpoint();
      }
      const paper=new THREE.InstancedMesh(paperGeometry,paperMaterial,items.length);paper.name=`Modern_Book_Paper_Blocks_Chunk_${chunkCount}`;
      items.forEach((p,i)=>{const {slot,d}=p,a=slot.rotationY;temp.position.set(slot.x-Math.sin(a)*d.width*.5,slot.y+d.height*.5,slot.z-Math.cos(a)*d.width*.5);
        temp.rotation.set(0,a,0);temp.scale.set(Math.max(.004,d.thickness-.006),d.height-.012,Math.max(.035,d.width-.012));temp.updateMatrix();paper.setMatrixAt(i,temp.matrix);});
      paper.instanceMatrix.needsUpdate=true;paper.castShadow=false;paper.receiveShadow=true;paper.computeBoundingBox();paper.computeBoundingSphere();
      chunk.add(paper);instanceMap.set(paper.uuid,{type:'paper',placements:items});group.add(chunk);chunkCount++;meshCount++;
      await checkpoint();
    }
  }
  group.userData={type:'dynamic-modern-book-collection',placedBooks:placements.length,uniqueBooks:bookMap.size,units:'metres',binding:'modern-hardcover-and-paperback',spatialChunks:chunkCount};
  if(atlases.size<1024&&used.size)warnings.push({message:'书目较多，远景图谱已自动降低分辨率；选中书籍仍可单独加载清晰封面。'});
  const build={...checkpoint.finish(),durationMs:performance.now()-started};
  return {group,bookMap,records,placements,bookPlacements,atlases,instanceMap,spatial,warnings,coverStatus:new Map(),loads:new Map(),bookRevisions:new Map(),disposed:false,
    stats:{placedBooks:placements.length,uniqueBooks:bookMap.size,renderedUniqueBooks:used.size,atlasPages:atlases.pages.length,atlasSize:atlases.size,
      atlasPixels:atlases.totalPixels,drawCalls:meshCount,spatialChunks:chunkCount,triangles:placements.length*30,loadedCovers:0,warnings:warnings.length,build}};
}

/**
 * Standard-mesh collection with batched cover atlases and instanced page blocks.
 * Returns immediately with title artwork; .ready resolves the first cover batch.
 */
export async function createBookCollection({slots=[],books=[],renderer,atlasSize=2048,maxAtlasPixels=16_777_216,
  initialCoverCount=48,maxUniqueBooks=MAX_BOOKS,maxSlots=MAX_SLOTS,onUpdate,onChange,chunkSize=12,yieldBuild=true,buildBudgetMs=8}={}) {
  void renderer;
  if(!Array.isArray(slots))throw new TypeError('slots 必须是槽位数组。');
  if(slots.length>maxSlots)throw new RangeError(`当前集合最多支持 ${maxSlots} 个陈列位置，请分区加载。`);
  const options={atlasSize,maxAtlasPixels,chunkSize,yieldBuild,buildBudgetMs};
  const preparedAt=performance.now(),prepareCheckpoint=buildCheckpoint(options),originalSlots=[];
  for(let i=0;i<slots.length;i++){
    originalSlots.push(safeSlot(slots[i],i));if((i&255)===255)await prepareCheckpoint();
  }
  const preparation={...prepareCheckpoint.finish(),durationMs:performance.now()-preparedAt};
  const loader=createImageLoader();let generation=0,disposed=false;
  let current=await buildCollectionState(originalSlots,normalizeBooks(books,maxUniqueBooks),options);
  current.stats.build.yields+=preparation.yields;
  current.stats.build.maxSliceMs=Math.max(current.stats.build.maxSliceMs,preparation.maxSliceMs);
  current.stats.build.durationMs+=preparation.durationMs;
  current.stats.build.slotPreparationMs=preparation.durationMs;
  const group=new THREE.Group();group.name='Modern_Book_Library';group.add(current.group);
  let ready=Promise.resolve();
  const emit=(type,id)=>{if(disposed)return;const event={type,id,stats:{...current.stats}};
    if(typeof onUpdate==='function')onUpdate(event);if(typeof onChange==='function'&&onChange!==onUpdate)onChange(event);};
  const hydrate=(state,id,retry=false)=>{
    if(state.disposed||disposed||!state.atlases.entries.has(id))return Promise.resolve({id,status:'skipped'});
    if(!retry&&state.loads.has(id))return state.loads.get(id);
    const book=state.bookMap.get(id),entry=state.atlases.entries.get(id),page=state.atlases.pages[entry.pageIndex],revision=state.bookRevisions.get(id)||0;
    const promise=(async()=>{
      const artwork={};let failed=false,hasRemote=false;
      await Promise.all(COVER_FIELDS.map(async field=>{const url=book[field];if(!url)return;hasRemote=true;
        try{artwork[field]=await loader.load(url);}catch(error){failed=true;if(!state.disposed&&!disposed&&(state.bookRevisions.get(id)||0)===revision)state.warnings.push({id,field,message:error.message});}}));
      if(state.disposed||disposed||(state.bookRevisions.get(id)||0)!==revision)return {id,status:'cancelled'};
      drawAtlasCell(page,entry,book,artwork);
      const status=failed?'fallback':hasRemote?'loaded':'generated',previous=state.coverStatus.get(id);state.coverStatus.set(id,status);
      if(status==='loaded'&&previous!=='loaded')state.stats.loadedCovers++;
      if(previous==='loaded'&&status!=='loaded')state.stats.loadedCovers--;
      state.stats.warnings=state.warnings.length;
      if(current===state)emit('texture',id);return {id,status};
    })();state.loads.set(id,promise);return promise;
  };
  const api={group,
    get records(){return current.records;},get instanceMap(){return current.instanceMap;},get stats(){return {...current.stats};},
    get warnings(){return current.warnings.slice();},get ready(){return ready;},
    async loadCovers(ids,{retry=false}={}){if(disposed)return [];return Promise.all([...new Set(ids)].map(id=>hydrate(current,String(id),retry)));},
    async refreshVisibleBooks(camera,{radius=12,max=48}={}){
      if(disposed)return [];
      const p=new THREE.Vector3();camera.getWorldPosition(p);group.worldToLocal(p);const candidates=new Map(),r=Math.ceil(radius/8),bx=Math.floor(p.x/8),bz=Math.floor(p.z/8),r2=radius*radius;
      for(let ix=bx-r;ix<=bx+r;ix++)for(let iz=bz-r;iz<=bz+r;iz++)for(const item of current.spatial.get(`${ix},${iz}`)||[]){
        if(current.loads.has(item.book.id))continue;const dx=item.slot.x-p.x,dy=item.slot.y+item.d.height*.5-p.y,dz=item.slot.z-p.z,d=dx*dx+dy*dy+dz*dz;
        if(d<=r2&&(!candidates.has(item.book.id)||candidates.get(item.book.id)>d))candidates.set(item.book.id,d);
      }
      return api.loadCovers([...candidates].sort((a,b)=>a[1]-b[1]).slice(0,max).map(([id])=>id));
    },
    async updateBook(id,patch){
      if(disposed)throw new Error('此书籍集合已释放。');id=String(id);if(!current.bookMap.has(id))throw new Error(`找不到书目：${id}`);
      if(patch?.id!==undefined&&String(patch.id)!==id)throw new Error('更新书籍时不能修改其稳定 ID。');
      const previous=current.bookMap.get(id),book=normalizeBookData({...previous,...patch,id});
      if(['width','height','thickness'].some(key=>book[key]!==previous[key])){
        const list=[...current.bookMap.values()].map(item=>item.id===id?book:item);
        return {...await api.setBooks(list),reusedGeometry:false};
      }
      // Book identity and occupied slots do not change when editing text or
      // artwork. Repaint this atlas cell rather than rebuilding 28,560 books.
      const target=current,revision=(target.bookRevisions.get(id)||0)+1;target.bookRevisions.set(id,revision);
      target.bookMap.set(id,book);Object.assign(target.records.get(id),book);
      for(const placement of target.bookPlacements.get(id)||[])placement.book=book;
      target.warnings=target.warnings.filter(warning=>warning.id!==id);
      if(target.coverStatus.get(id)==='loaded')target.stats.loadedCovers--;
      target.coverStatus.delete(id);target.loads.delete(id);target.stats.warnings=target.warnings.length;
      const entry=target.atlases.entries.get(id);
      if(entry)drawAtlasCell(target.atlases.pages[entry.pageIndex],entry,book);
      ready=entry?hydrate(target,id):Promise.resolve();emit('metadata',id);
      await ready;
      return {applied:!disposed&&current===target&&target.bookRevisions.get(id)===revision,reusedGeometry:true,book,stats:api.stats};
    },
    async setBooks(nextBooks){
      if(disposed)throw new Error('此书籍集合已释放。');const revision=++generation;
      const normalized=normalizeBooks(nextBooks,maxUniqueBooks);const replacement=await buildCollectionState(originalSlots,normalized,options);
      if(disposed||revision!==generation){replacement.disposed=true;disposeTree(replacement.group);return {applied:false};}
      const previous=current;current=replacement;group.add(current.group);group.remove(previous.group);previous.disposed=true;disposeTree(previous.group);
      ready=api.loadCovers([...current.atlases.entries.keys()].slice(0,initialCoverCount));emit('collection');return {applied:true,stats:api.stats};
    },
    findBookByIntersection(hit){
      const map=current.instanceMap.get(hit?.object?.uuid);if(!map)return null;
      const i=map.type==='paper'?hit.instanceId:Math.floor(hit.faceIndex/map.facesPerBook),placement=map.placements[i];if(!placement)return null;
      const record=current.records.get(placement.book.id);return {...record,bookId:record.id,slotIndex:placement.slotIndex,slot:{...placement.slot},
        dimensions:{...placement.d},position:[placement.slot.x,placement.slot.y,placement.slot.z]};
    },
    dispose(){if(disposed)return;disposed=true;generation++;current.disposed=true;loader.dispose();disposeTree(current.group);group.clear();},
  };
  ready=api.loadCovers([...current.atlases.entries.keys()].slice(0,initialCoverCount));
  return api;
}

/** High-detail standalone book: front cover +Z, spine -X, bottom Y=0. */
export async function createModernBook(input,options={}) {
  const book=normalizeBookData(input),loader=createImageLoader({maxSide:options.maxTextureSize||1024,concurrency:3,cacheLimit:3,timeout:options.timeout||6500});
  const artwork={},warnings=[];
  await Promise.all(COVER_FIELDS.map(async field=>{if(!book[field])return;try{artwork[field]=await loader.load(book[field]);}catch(e){warnings.push({field,message:e.message});}}));
  loader.dispose();
  const size=clamp(options.atlasSize||2048,512,4096),canvas=makeCanvas(size,size),texture=newTexture(canvas,`Book_${book.id}`);
  const page={canvas,ctx:canvas.getContext('2d'),size,cellSize:size,texture};
  const entry={pageIndex:0,cellX:0,cellY:0,rects:atlasRects(0,0,size)};drawAtlasCell(page,entry,book,artwork);
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.57,metalness:.025,side:THREE.DoubleSide});material.name='Modern_Book_Cover_Artwork';
  const d=dimensions(book),shelfBook=new THREE.Group();
  const cover=new THREE.Mesh(mergedCasingGeometry([{slot:{x:0,y:0,z:0,rotationY:0},book,d}],page,new Map([[book.id,entry]])),material);cover.name='Front_Back_Spine_Casing';cover.castShadow=true;cover.receiveShadow=true;shelfBook.add(cover);
  const paper=new THREE.Mesh(new THREE.BoxGeometry(d.thickness-.006,d.height-.012,d.width-.012),pageMaterial());paper.position.set(0,d.height/2,-d.width/2);paper.castShadow=true;paper.receiveShadow=true;paper.name='Recessed_Paper_Block';shelfBook.add(paper);
  // Endpaper lips reinforce the actual distinction between a cover and page block.
  const endpaper=new THREE.MeshStandardMaterial({color:0xdad7ce,roughness:.95});endpaper.name='Modern_Endpapers';
  for(const side of [-1,1]){const lip=new THREE.Mesh(new THREE.BoxGeometry(.0008,d.height-.008,d.width-.007),endpaper);lip.position.set(side*(d.thickness/2-.003),d.height/2,-d.width/2);lip.name='Inner_Endpaper';shelfBook.add(lip);}
  const group=new THREE.Group();group.name=`Modern_Book_${book.id}`;
  if(options.orientation==='shelf'){group.add(shelfBook);}else{shelfBook.rotation.y=-Math.PI/2;shelfBook.position.x=-d.width/2;group.add(shelfBook);}
  group.userData={type:'modern-book',bookId:book.id,title:book.title,author:book.author,category:book.category,units:'metres',dimensions:d,warnings,
    coverStatus:artwork.coverUrl?'loaded':book.coverUrl?'fallback':'generated'};
  group.dispose=()=>disposeTree(group);return group;
}

const DEMO_TITLES=[
  '城市与时间','未来的边界','光与建筑','算法之美','设计的秩序','山海之间','阅读的力量','宇宙来信',
  '植物的秘密','慢生活笔记','数学的形状','文明的长河','人工智能导论','现代建筑之旅','万物有声','深度思考',
  '海洋与星辰','中国艺术史','商业的逻辑','自然观察手册','机器学习基础','平凡的远方','摄影的语言','山川与风物',
  '科学的故事','文学与人生','数字世界','人类简史札记','可持续设计','东方园林','全球经济观察','声音的地图',
  '材料与工艺','数据的价值','空间的诗学','鸟类图鉴','心理与认知','光影之间','绿色能源','世界博物馆',
  '写给未来的信','软件设计之道','历史的细节','旅行与发现','生命的秩序','星空观测指南','艺术的日常','知识的尺度',
];
const DEMO_CATEGORIES=['文学艺术','建筑设计','科技计算','历史人文','自然科学','经济管理'];
const demoCache=new Map();

/** Original graphic demo covers, not scans of real published books. */
export function generateDemoBooks(count=48) {
  count=Math.round(clamp(Number(count)||48,1,256));if(demoCache.has(count))return demoCache.get(count).map(b=>({...b}));
  const records=[];
  for(let i=0;i<count;i++){
    const id=`demo-${String(i+1).padStart(3,'0')}`,title=DEMO_TITLES[i%DEMO_TITLES.length]+(i>=DEMO_TITLES.length?` ${Math.floor(i/DEMO_TITLES.length)+1}`:''),color=PALETTE[i%PALETTE.length];
    const book=normalizeBookData({id,title,author:'观文编辑部',category:DEMO_CATEGORIES[Math.floor(i/8)%DEMO_CATEGORIES.length],color,pageCount:240+(i*37)%480,
      height:.345+(i%6)*.012,width:.22+(i%4)*.009,description:'原创示范书目，用于展示书籍封面、书脊和网站数据驱动建模。'});
    const c=makeCanvas(320,480),ctx=c.getContext('2d'),ink=readableInk(color);ctx.fillStyle=color;ctx.fillRect(0,0,320,480);
    ctx.fillStyle=ink;ctx.globalAlpha=.065;for(let line=0;line<90;line++)ctx.fillRect((line*37)%320,0,.5,480);ctx.globalAlpha=1;
    const style=i%4;
    if(style===0){ctx.strokeStyle=ink;ctx.globalAlpha=.4;ctx.lineWidth=1;for(let k=0;k<7;k++){ctx.beginPath();ctx.arc(250,310,48+k*17,Math.PI*.4,Math.PI*1.5);ctx.stroke();}ctx.globalAlpha=1;}
    if(style===1){ctx.fillStyle=ink;ctx.globalAlpha=.13;for(let k=0;k<5;k++)ctx.fillRect(35+k*45,280-k*15,26,116+k*15);ctx.globalAlpha=1;}
    if(style===2){ctx.strokeStyle=ink;ctx.globalAlpha=.35;for(let k=0;k<10;k++){ctx.beginPath();ctx.moveTo(28,290+k*9);ctx.bezierCurveTo(110,230+k*8,190,380+k*4,296,288+k*9);ctx.stroke();}ctx.globalAlpha=1;}
    if(style===3){ctx.strokeStyle=ink;ctx.globalAlpha=.35;ctx.lineWidth=1;for(let k=0;k<6;k++){roundedRect(ctx,55+k*13,250+k*10,210-k*26,150-k*20,2);ctx.stroke();}ctx.globalAlpha=1;}
    ctx.fillStyle=ink;ctx.textAlign='left';ctx.textBaseline='top';ctx.font=`12px ${FONT}`;ctx.fillText('GUANWEN / COLLECTION',28,25);
    ctx.fillRect(28,52,264,1);ctx.font=`500 38px ${FONT}`;wrapText(ctx,title,28,82,250,51,3);
    ctx.font=`15px ${FONT}`;ctx.fillText(book.author,29,208);ctx.font=`11px ${FONT}`;ctx.fillText(book.category,29,428);
    ctx.fillText('示范书目 · 可替换封面',29,451);ctx.textAlign='right';ctx.font='12px Silvae Serif, Noto Serif SC, serif';ctx.fillText(String(i+1).padStart(2,'0'),289,430);
    book.coverUrl=c.toDataURL('image/png');records.push(book);
  }
  demoCache.set(count,records);return records.map(b=>({...b}));
}

export function disposeBookModel(group){if(typeof group?.dispose==='function')group.dispose();else if(group)disposeTree(group);}
