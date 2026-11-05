import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMingLibraryAsync, createModernBook, createBookCollection, normalizeBookData } from './library.js';
import { disposeBookModel } from './modern-books.js';
import { createLibraryNavigation } from './navigation-v2.js';
import { CanvasFallbackRenderer } from './canvas-renderer.js';
import { createCameraCollision, cameraCollisionRadius } from './camera-collision.js';
import {createPalaceSky} from './environment-v12.js';
import {PALACE_PLAN_SCALE as PLAN} from './design-v12.js';
import {batchStaticLibrary} from './static-batches-v14.js';
import {createDemandLoop,AdaptiveResolution,yieldToBrowser} from './runtime-performance-v14.js';
import {createBookTapGesture} from './book-interaction-v16.js';
import {createEntranceZoom} from './entrance-zoom-v16.js';
import {bindEntranceZoomInput} from './entrance-input-v16.js';

import {connectSilvae} from './silvae-host.js';
import {shelfCategories,shelfCategoryPose} from './shelf-category-navigation.js';
const $=s=>document.querySelector(s);
const state={mode:'orbit',view:'gate',cutaway:false,night:false,quality:'auto',selected:null,source:'custom',busy:false};
import {poses} from './views-v13.js';

let renderer,scene,camera,controls,library,navigation,collection,sun,fill,sky,ambient,palaceSky,windowLights=[],ceremonyLights=[];
let cameraCollision,cameraGuardBusy=false,lastCollisionRadius=.20;
let entranceZoom,entranceTravel=null,entranceInput,pendingEntranceTravel=0,lastGateZoomNotice=-Infinity;
const safeCamera=new THREE.Vector3(),safeTarget=new THREE.Vector3();
let transition=null,needsRender=true,lastFrame=0,lastCoverRefresh=0,lastRender=0,yaw=0,pitch=0,dragging=false;
let catalogBooks=[],collectionRevision=0,selectionRevision=0,uploadedCover=null,toastTimer;
let stageRenderer,stageScene,stageCamera,stageControls,stageModel,stageDirty=false,stageObserver;
const keys=new Set(),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const bookTap=createBookTapGesture();
let resolveReady,rejectReady;
let mutationQueue=Promise.resolve();
let frameLoop,adaptiveResolution,staticBatches,runtimeReady=false,coverTimer=null,coverRevision=-1;
const coverAnchor=new THREE.Vector3(Infinity,Infinity,Infinity);
const runtimeMetrics={started:performance.now(),readyMs:0,frames:0,lastFrameCpuMs:0,textureCount:0,phases:{},culling:null};
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
// A failed WebGL boot is also presented visibly below.
ready.catch(()=>{});
const requestRender=()=>{needsRender=true;if(runtimeReady)frameLoop?.request();};
const compact=n=>Number(n).toLocaleString('zh-CN');
const plainBook=b=>{const {placements,...book}=b;return {...book};};
function queueMutation(operation){const result=mutationQueue.then(operation);mutationQueue=result.catch(()=>{});return result;}
const scheduleCollection=(books,options)=>queueMutation(()=>replaceCollection(books,options));

function normalizeCollection(input){
  const data=Array.isArray(input)?input:input?.books;
  if(!Array.isArray(data))throw new Error('请传入书目数组，或包含 books 数组的对象。');
  if(data.length>16384)throw new Error('单次最多接入 16,384 种书目；更大的书库请按分类或分页加载。');
  const seen=new Set();return data.map(raw=>{const b=normalizeBookData(raw);if(seen.has(b.id))throw new Error('书目 ID 重复：'+b.id);seen.add(b.id);return b;});
}
async function loadBookFont(books){
  const text=books.map(b=>(b.title||'')+(b.author||'')+(b.category||'')+(b.description||'')).join('');
  if(text){
    await document.fonts.ready;
    await document.fonts.load('500 24px "Silvae Serif"',text.slice(0,200000));
    await document.fonts.load('400 24px "Noto Serif SC"',text.slice(0,200000));
  }
}
async function replaceCollection(input,{demo=false,loadFont=true}={}){
  const revision=++collectionRevision;
  const books=normalizeCollection(input);
  if(loadFont)await loadBookFont(books);
  const slots=library.allocateBooks(books,{repeat:demo,maxBooks:30000});
  if(!demo&&slots.length!==books.length)throw new Error('这批书的尺寸超出当前书架容量，请分批导入或缩小厚度。原有藏书未改变。');
  const next=await createBookCollection({slots,books,renderer,onUpdate:requestRender});
  if(revision!==collectionRevision){next.dispose();return {applied:false};}
  const previous=collection;collection=next;library.group.add(next.group);
  if(previous){library.group.remove(previous.group);previous.dispose();}
  catalogBooks=books;state.source=demo?'demo':'custom';state.selected=null;
  closeSelection();renderCatalog();requestRender();
  next.ready.then(()=>{if(next===collection){requestRender();reportCoverWarnings();}}).catch(console.error);
  const detail={applied:true,...getState()};window.dispatchEvent(new CustomEvent('guanwen:books-changed',{detail}));
  return detail;
}
function reportCoverWarnings(){
  const imageWarnings=collection?.warnings.filter(w=>w.field)||[];
  if(imageWarnings.length){$('#data-status').textContent=imageWarnings.length+' 张图片加载失败，已保留书名封面。请检查图片地址、访问权限或 CORS。';}
}
function getState(){return {version:'2.14.0',floors:2,shelves:library?.stats.shelves||0,source:state.source,mode:state.mode,
  view:state.view,selectedBookId:state.selected,renderMode:renderer?.isFallback?'canvas-compatibility':'webgl',books:collection?.stats||{},dimensions:{width:52.8,depth:74.4,upperWidth:43.2,upperDepth:62.4,upperFloorY:8.4,planScale:PLAN},roofCount:2,
  gateOpen:library?.entrance?.gate.isOpen??true,entranceDirection:'+X',entranceFacadeLength:74.4,entrancePassageWidth:5.52,doorLeaves:library?.entrance?.doors.length??2,plaqueText:'文華殿',hallAxis:'X',throneFacing:'+X',shelfOrientation:'transverse-Z',stairWidth:library?.architecture.stats.stairWidth,
  throneAccessible:true,seated:state.mode==='seated',stoneTerraceLevels:3,mainContinuousColumns:library?.architecture.continuousColumns.length??0,visiblePalaceLamps:0,compound:library?.courtyard.metadata,cameraCollision:!!cameraCollision,cameraClearance:camera?cameraCollisionRadius(camera):.20,
  quality:state.quality,warnings:collection?.warnings||[]};}
async function updateBook(id,patch){
  await ready;return queueMutation(()=>applyBookUpdate(id,patch));
}
async function applyBookUpdate(id,patch){
  id=String(id);
  if(patch?.id!==undefined&&String(patch.id)!==id)throw new Error('更新时不能改变书籍的稳定 ID。');
  const existing=collection.records.get(id);if(!existing)throw new Error('未找到书目：'+id);
  const next=normalizeBookData({...plainBook(existing),...patch,id});
  await loadBookFont([next]);
  const wasSelected=state.selected===id;
  const sameDimensions=['width','height','thickness'].every(key=>Math.abs(next[key]-existing[key])<1e-10);
  const result=sameDimensions?await collection.updateBook(id,next):await replaceCollection(catalogBooks.map(b=>b.id===id?next:b),{demo:state.source==='demo',loadFont:false});
  if(!result.applied)return result;
  if(sameDimensions)catalogBooks=catalogBooks.map(b=>b.id===id?next:b);
  renderCatalog();requestRender();
  if(sameDimensions)window.dispatchEvent(new CustomEvent('guanwen:books-changed',{detail:{applied:true,...getState()}}));
  await collection.loadCovers([id]);
  if(wasSelected)await selectBook(id,{focus:false});
  reportCoverWarnings();return {...result,...getState(),book:next};
}
async function loadBooksFromUrl(url){
  await ready;const u=new URL(url,location.href);if(!['http:','https:'].includes(u.protocol))throw new Error('书目接口只支持 HTTP(S)。');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{const response=await fetch(u.href,{signal:abort.signal,credentials:'same-origin',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('书目接口返回 HTTP '+response.status);
    return await scheduleCollection(await response.json());
  }finally{clearTimeout(timer);}
}

async function init(){
  try{
    const inscriptionText='观文藏阁現代書籍文華殿重檐庑殿建極綏猷崇文尚學0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    // Wait for imported font stylesheets before requesting fonts used by canvas textures.
    if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
    // This fixed inscription is completely covered by the bundled interface subset.
    await document.fonts.load('500 32px "Silvae Serif"',inscriptionText);
    renderer=makeRenderer();
    adaptiveResolution=new AdaptiveResolution({coarse:matchMedia('(pointer: coarse)').matches,fallback:renderer.isFallback});
    applyResolution();renderer.setSize(innerWidth,innerHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
    renderer.domElement.setAttribute('aria-label','两层明式藏书阁三维场景，拖动旋转，点击书籍查看详情');renderer.domElement.tabIndex=0;
    $('#viewport').appendChild(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color(0xb9d3e6);scene.fog=new THREE.Fog(0xb4c8d3,170,530);
    scene.updateMatrix();scene.matrixAutoUpdate=false;
    // Broad reflected light makes carved gilt and glazed enamel readable in
    // WebGL, while the separate sky stays outside camera collision.
    if(!renderer.isFallback){
      const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
      try{scene.environment=pmrem.fromScene(environment,.045).texture;scene.environmentIntensity=.28;}
      catch(error){console.warn('环境反射未启用，保留场景灯光。',error);}
      finally{environment.dispose();pmrem.dispose();}
    }
    camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.06,650);camera.position.fromArray(poses.gate.position);
    controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(poses.gate.target);
    controls.enableDamping=false;controls.rotateSpeed=.40;controls.panSpeed=.65;
    controls.minDistance=.55;controls.maxDistance=112;controls.maxPolarAngle=Math.PI*.94;controls.update();
    $('#loading-note').textContent='正在读取建筑纹样与原字贴图';await yieldToBrowser();
    const textureStarted=performance.now();
    const architecturalTexture=async(url,name)=>{
      try{const t=await new THREE.TextureLoader().loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;
        t.anisotropy=Math.min(16,renderer.capabilities?.getMaxAnisotropy?.()??16);t.name='ArchitecturalDetail_'+name;
        t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;runtimeMetrics.textureCount++;return t;
      }catch{return null;}
    };
    const [paintTexture,reliefTexture,carpetTexture,caissonTexture,throneAtlasTexture,plaqueReferenceTexture,leftCoupletReferenceTexture,ceremonyReferenceTexture,exteriorPlaqueTexture,ridgeBeastAtlasTexture,ritualSurfaceTexture,ridgeCeramicTexture,palaceSkyTexture]=await Promise.all([
      architecturalTexture('./assets/runtime-v14/palace-frieze-v7.webp','Dragon_Frieze'),
      architecturalTexture('./assets/runtime-v14/throne-relief-v7.webp','Throne_Gold_Relief'),
      architecturalTexture('./assets/runtime-v14/imperial-carpet-v8.webp','Woven_Imperial_Carpet'),
      architecturalTexture('./assets/runtime-v14/caisson-atlas-v10.webp','Caisson_Dragon_Atlas_V10'),
      architecturalTexture('./assets/runtime-v14/throne-atlas-v11.webp','Throne_Pierced_Reference_V11'),
      architecturalTexture('./assets/runtime-v14/imperial-plaque-reference-v11.webp','Original_Plaque_Calligraphy'),
      architecturalTexture('./assets/runtime-v14/imperial-left-couplet-reference-v11.webp','Original_Left_Couplet'),
      architecturalTexture('./assets/runtime-v14/imperial-hall-reference-v11.webp','Original_Right_Couplet'),
      architecturalTexture('./assets/runtime-v14/wenhuadian-original-v11.webp','Original_Wen_Hua_Dian_Calligraphy'),
      architecturalTexture('./assets/runtime-v14/ridge-beast-reference-atlas-v11.webp','Reference_Seven_Ridge_Figures_V11'),
      architecturalTexture('./assets/runtime-v14/ritual-surface-atlas-v11.webp','Ritual_Engraved_Surfaces_V11'),
      architecturalTexture('./assets/runtime-v14/chiwen-glaze-v12.webp','Chiwen_Engraved_Ceramic_Scales_V12'),
      architecturalTexture('./assets/runtime-v14/palace-sky-v13.webp','Natural_Palace_Sky_V13'),
    ]);
    runtimeMetrics.phases.textures=performance.now()-textureStarted;
    palaceSky=createPalaceSky({dayTexture:palaceSkyTexture});scene.add(palaceSky.group);
    library=await createMingLibraryAsync({paintTexture,reliefTexture,carpetTexture,caissonTexture,throneAtlasTexture,plaqueReferenceTexture,leftCoupletReferenceTexture,ceremonyReferenceTexture,exteriorPlaqueTexture,ridgeBeastAtlasTexture,ritualSurfaceTexture,ridgeCeramicTexture},{onProgress:label=>{$('#loading-note').textContent=label;}});scene.add(library.group);
    Object.assign(runtimeMetrics.phases,library.performance.stages);
    $('#loading-note').textContent='正在准备通行与碰撞防护';await yieldToBrowser();
    const collisionStarted=performance.now();
    navigation=createLibraryNavigation({architecture:library.architecture,entrance:library.entrance,ceremonial:library.ceremonial,obstacles:library.obstacles});
    cameraCollision=createCameraCollision({library,radius:.20,groundY:-3.6});
    entranceZoom=createEntranceZoom({library,navigation,collision:cameraCollision,start:poses.gate});
    runtimeMetrics.phases.collision=performance.now()-collisionStarted;
    $('#loading-note').textContent='正在优化可见区域';await yieldToBrowser();
    const batchingStarted=performance.now();staticBatches=await batchStaticLibrary(library);
    runtimeMetrics.phases.batching=performance.now()-batchingStarted;
    placeCameraSafely(poses.gate.position,poses.gate.target,{ignoreInvisible:false});
    sky=new THREE.HemisphereLight(0xc9def0,0x6d6251,1.4);ambient=new THREE.AmbientLight(0xe9dfcd,.22);scene.add(sky,ambient);
    sun=new THREE.DirectionalLight(0xfff3dc,2.15);sun.position.set(56,65,-38);sun.target.position.set(0,2,0);scene.add(sun,sun.target);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-66,right:66,top:78,bottom:-78,near:1,far:180});sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;
    fill=new THREE.DirectionalLight(0xd9e7ef,.55);fill.position.set(26,14,31);scene.add(fill);
    const front=new THREE.DirectionalLight(0xffedda,.35);front.position.set(36,12,0);scene.add(front);
    for(const side of[-1,1]){const light=new THREE.DirectionalLight(0xe5eced,.48);light.position.set(-16,12,side*38);light.target.position.set(0,5,0);scene.add(light,light.target);windowLights.push(light);}
    for(const side of [-1,1]){
      const light=new THREE.SpotLight(0xffdda3,290,30,.70,.65,1.5);light.position.set(9.5,14.5,side*7.2);
      light.target.position.set(0,4.4,0);scene.add(light,light.target);ceremonyLights.push(light);
    }

    $('#loading-note').textContent='正在排布两层书架与现代书籍';
    await yieldToBrowser();const booksStarted=performance.now();
    await replaceCollection([],{loadFont:false});
    runtimeMetrics.phases.books=performance.now()-booksStarted;
    renderShelfCategories();bindEvents();updateGateControl();setView('gate',true);
    if(!renderer.isFallback&&renderer.compileAsync){
      $('#loading-note').textContent='正在准备材质与光影';await yieldToBrowser();
      const shadersStarted=performance.now();await renderer.compileAsync(scene,camera);runtimeMetrics.phases.shaders=performance.now()-shadersStarted;
    }
    renderer.shadowMap.needsUpdate=true;renderMainScene();
    $('#loading').classList.add('loaded');$('#app').classList.add('ready');updateSeatControl();
    window.__guanwen={state,library,collection:()=>collection,camera,renderer,navigation,cameraCollision,staticBatches,getState,getPerformance};
    runtimeMetrics.readyMs=performance.now()-runtimeMetrics.started;runtimeReady=true;
    resolveReady(getState());if(needsRender)frameLoop.request();updatePerformanceReadout();
    if(renderer.isFallback)toast('当前使用兼容预览；在支持图形加速的浏览器中打开，可获得更流畅的漫游。');
  }catch(error){console.error(error);rejectReady(error);$('#loading-title').textContent='场景未能启动';$('#loading-note').textContent='请使用开启硬件加速的现代浏览器。'+error.message;$('#loading').classList.add('failed');}
}
function makeRenderer({alpha=false}={}){
  if(renderer?.isFallback)return new CanvasFallbackRenderer({alpha});
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:true,alpha,powerPreference:'high-performance'});
  if(!context)return new CanvasFallbackRenderer({alpha});
  return new THREE.WebGLRenderer({canvas,context,antialias:true,alpha,powerPreference:'high-performance'});
}
function renderCatalog(){
  const term=($('#catalog-search').value||'').trim().toLowerCase();const books=catalogBooks.filter(b=>(b.title+' '+b.author+' '+b.category).toLowerCase().includes(term));
  const list=$('#catalog-list');list.replaceChildren();
  if(!books.length){const p=document.createElement('p');p.className='empty-note';p.textContent=term?'未找到匹配书目。':'书架已准备好，可从“书目接入”导入你的藏书。';list.append(p);}
  for(const [index,b] of books.slice(0,160).entries()){
    const button=document.createElement('button');button.className='catalog-item';button.dataset.bookId=b.id;
    const n=document.createElement('span');n.className='catalog-index';n.textContent=String(index+1).padStart(2,'0');
    const copy=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');
    title.textContent=b.title;meta.textContent=b.author+' · '+b.category;copy.append(title,meta);
    const mark=document.createElement('span');mark.className='catalog-mark';mark.style.backgroundColor=b.color;
    button.append(n,copy,mark);button.onclick=()=>selectBook(b.id,{focus:true});list.append(button);
  }
  if(books.length>160){const p=document.createElement('p');p.className='empty-note';p.textContent='当前显示前 160 本，请输入书名继续筛选。';list.append(p);}
}
function showPanel(id){
  for(const panel of ['catalog-panel','data-panel'])$('#'+panel).hidden=panel!==id;
  closeSelection();$('#help').hidden=true;updateWalkInteraction();
}
function scenePanelOpen(){return ['selection','catalog-panel','data-panel','help'].some(id=>{const panel=$('#'+id);return panel&&!panel.hidden;});}
function isWalkInputPaused(){return state.mode==='walk'&&scenePanelOpen();}
function resetScenePointer(){bookTap.reset();dragging=false;}
function updateWalkInteraction(){
  keys.clear();resetScenePointer();
  if(scenePanelOpen()){pendingEntranceTravel=0;entranceInput?.cancel();}
  if(state.mode!=='walk')return;
  const paused=scenePanelOpen();$('#touch-move').classList.toggle('enabled',!paused);
  $('#walk-hint').hidden=false;
  $('#walk-hint').innerHTML=paused?'漫游已暂停 · 关闭面板或按 <kbd>Esc</kbd> 继续原地漫游':'<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动　拖动转向　点击书籍查看　<kbd>Esc</kbd> 退出漫游';
  if(!paused)renderer?.domElement.focus();
  requestRender();
}
function closeSelection(){
  selectionRevision++;if($('#selection'))$('#selection').hidden=true;
  if(stageModel){stageScene?.remove(stageModel);disposeBookModel(stageModel);stageModel=null;}
  updateWalkInteraction();
}
function stageInit(){
  if(stageRenderer)return;
  stageRenderer=makeRenderer({alpha:true});stageRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));stageRenderer.outputColorSpace=THREE.SRGBColorSpace;
  stageRenderer.toneMapping=THREE.ACESFilmicToneMapping;stageRenderer.toneMappingExposure=1.1;stageRenderer.setClearColor(0,0);
  $('#book-stage').appendChild(stageRenderer.domElement);stageRenderer.domElement.setAttribute('aria-label','选中书籍的三维模型，拖动可查看封面、书脊和封底');
  stageScene=new THREE.Scene();stageScene.add(new THREE.HemisphereLight(0xffffff,0x847568,3.0));
  const l=new THREE.DirectionalLight(0xfff0d7,3.5);l.position.set(-2,3,4);stageScene.add(l);
  const rim=new THREE.DirectionalLight(0xdae8f6,2);rim.position.set(2,2,-1);stageScene.add(rim);
  stageCamera=new THREE.PerspectiveCamera(34,1,.01,10);
  stageControls=new OrbitControls(stageCamera,stageRenderer.domElement);stageControls.enablePan=false;stageControls.enableZoom=true;stageControls.minDistance=.2;stageControls.maxDistance=2.5;stageControls.enableDamping=true;
  stageControls.addEventListener('change',()=>{stageDirty=true;frameLoop?.request();});
  stageObserver=new ResizeObserver(stageSize);stageObserver.observe($('#book-stage'));
}
function stageSize(){if(!stageRenderer)return;const r=$('#book-stage').getBoundingClientRect();if(!r.width||!r.height)return;stageRenderer.setSize(r.width,r.height);stageCamera.aspect=r.width/r.height;stageCamera.updateProjectionMatrix();
  if(stageModel){const s=new THREE.Box3().setFromObject(stageModel).getBoundingSphere(new THREE.Sphere());stageControls.minDistance=s.radius+cameraCollisionRadius(stageCamera,.035)+.025;stageControls.update();}stageDirty=true;frameLoop?.request();}
async function selectBook(id,{focus=false,hit=null}={}){
  const record=collection?.records.get(String(id));if(!record)throw new Error('未找到书目：'+id);
  closeSelection();const revision=++selectionRevision;state.selected=record.id;
  $('#catalog-panel').hidden=true;$('#data-panel').hidden=true;$('#selection').hidden=false;
  updateWalkInteraction();
  const placement=hit?.slot?{position:hit.position,shelfId:hit.slot.shelfId,floor:hit.slot.floor,slotIndex:hit.slotIndex}:record.placements[0];
  $('#selection-title').textContent=record.title;$('#selection-author').textContent=record.author||'未署名';
  $('#selection-meta').textContent=record.category;
  $('#selection-position').textContent=placement?(placement.floor+'F · '+placement.shelfId+' 架'+(state.source==='demo'?' · 演示书目有重复陈列':'')):'暂无陈列位置';
  $('#selection-read').hidden=!record.readUrl;if(record.readUrl)$('#selection-read').href=record.readUrl;
  if(focus&&placement&&state.mode!=='walk'){
    const cell=library.furniture.compartments.find(c=>c.id===placement.cellId);const angle=hit?.slot?.rotationY??placement.rotationY??cell?.rotationY??0;
    const p=placement.position;startTransition([p[0]+Math.sin(angle)*1.60+.12,p[1]+.85,p[2]+Math.cos(angle)*1.60],[p[0],p[1]+record.height*.55,p[2]-.06],'shelf');
  }
  stageInit();stageSize();
  const model=await createModernBook(plainBook(record),{atlasSize:2048,maxTextureSize:1024});
  if(revision!==selectionRevision){disposeBookModel(model);return;}
  stageModel=model;stageScene.add(model);const h=record.height;
  const bookSphere=new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  stageControls.minDistance=bookSphere.radius+cameraCollisionRadius(stageCamera,.035)+.025;
  stageControls.target.copy(bookSphere.center);stageCamera.position.copy(bookSphere.center).add(new THREE.Vector3(-.94,.20,1.9).normalize().multiplyScalar(Math.max(h*2.2,stageControls.minDistance*1.4)));
  stageControls.update();stageDirty=true;frameLoop?.request();
  const detail={id:record.id,title:record.title,author:record.author,readUrl:record.readUrl,shelfId:placement?.shelfId,floor:placement?.floor};
  window.dispatchEvent(new CustomEvent('guanwen:book-selected',{detail}));notifyParent({type:'book:selected',book:detail});
  if(model.userData.warnings.length)toast('封面暂时无法读取，已显示书名封面。可上传本地图片替换。');
  return detail;
}
function fillBookForm(id){
  const book=collection.records.get(id)||collection.records.values().next().value;
  uploadedCover=null;$('#book-upload').value='';
  $('#book-id').value=book?.id||'';$('#book-title').value=book?.title||'';$('#book-author').value=book?.author||'';$('#book-pages').value=book?.pageCount||320;
  $('#book-cover').value=book?.coverUrl?.startsWith('data:')?'':book?.coverUrl||'';
  $('#book-cover').dataset.original=book?.coverUrl||'';
  $('#book-form-note').textContent=book?(state.source==='demo'?'当前为演示书目，修改会同步更新该书在阁内的所有陈列。封面地址留空将保留现有封面。':'修改后同步更新书架和三维书籍。封面地址留空将保留现有封面。'):'请先导入书目，再选择要编辑的书。';
  $('#book-save').disabled=!book;
}
function rememberSafeCamera(){
  if(cameraCollision&&!cameraCollision.isSafe(camera.position,{radius:cameraCollisionRadius(camera)}))return false;
  safeCamera.copy(camera.position);safeTarget.copy(controls.target);lastCollisionRadius=cameraCollisionRadius(camera);
  return true;
}
function safeOrbitTarget(eye,requested){
  const offset=eye.clone().sub(requested);
  if(offset.lengthSq()<1e-12)offset.set(0,0,4);
  const spherical=new THREE.Spherical().setFromVector3(offset);
  spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance+.002,controls.maxDistance-.002);
  spherical.phi=THREE.MathUtils.clamp(spherical.phi,Math.max(.0001,controls.minPolarAngle+.0001),Math.min(Math.PI-.0001,controls.maxPolarAngle-.0001));
  if(Number.isFinite(controls.minAzimuthAngle))spherical.theta=Math.max(spherical.theta,controls.minAzimuthAngle);
  if(Number.isFinite(controls.maxAzimuthAngle))spherical.theta=Math.min(spherical.theta,controls.maxAzimuthAngle);
  return eye.clone().sub(new THREE.Vector3().setFromSpherical(spherical));
}
function placeCameraSafely(position,target,{ignoreInvisible=true}={}){
  const radius=cameraCollisionRadius(camera),desired=new THREE.Vector3(...(Array.isArray(position)?position:position.toArray()));
  const safe=cameraCollision.findSafePosition(desired,{radius,ignoreInvisible,maxDistance:3,fallback:poses.hall.position});
  if(!safe)throw new Error('此处没有可用的安全视角，请返回一层大殿。');
  cameraGuardBusy=true;
  try{
    const requested=Array.isArray(target)?new THREE.Vector3(...target):target;
    // OrbitControls also applies angle and distance limits. Adjust the target,
    // not the validated eye, so update() cannot push it back into a restored wall.
    controls.target.copy(safeOrbitTarget(safe,requested));camera.position.copy(safe);controls.update();
    if(!cameraCollision.isSafe(camera.position,{radius,ignoreInvisible}))camera.position.copy(safe);
    camera.lookAt(controls.target);
    if(!rememberSafeCamera())throw new Error('相机安全定位失败，请返回一层大殿。');
  }
  finally{cameraGuardBusy=false;}
  requestRender();return safe;
}
/** Every ordinary camera movement sweeps its full near-plane safety volume. */
function guardCameraMovement(){
  if(!cameraCollision||cameraGuardBusy)return;
  const radius=cameraCollisionRadius(camera);
  if(camera.position.distanceToSquared(safeCamera)<1e-12&&Math.abs(radius-lastCollisionRadius)<1e-8){safeTarget.copy(controls.target);return;}
  cameraGuardBusy=true;
  try{
    const desired=camera.position.clone();
    let origin=safeCamera;
    if(!cameraCollision.isSafe(origin,{radius}))origin=cameraCollision.findSafePosition(origin,{radius,fallback:poses.hall.position});
    if(!origin)throw new Error('未找到安全的相机位置。');
    const result=cameraCollision.resolve(origin,desired,{radius,slide:true});
    camera.position.copy(result.position);
    if(result.blocked&&controls.target.distanceToSquared(safeTarget)>1e-12){
      // A pan moves eye and target together; remove only its blocked component.
      controls.target.add(camera.position.clone().sub(desired));
    }
    camera.lookAt(controls.target);rememberSafeCamera();
    if(result.blocked)requestRender();
  }finally{cameraGuardBusy=false;}
}
function stopEntranceZoom(){
  entranceTravel=null;pendingEntranceTravel=0;
  entranceInput?.cancel();if(controls)controls.enableZoom=true;
}
function armEntranceZoom(name){
  stopEntranceZoom();
  if(name!=='gate'||!entranceZoom||!entranceZoom.isOnRoute(camera.position,0))return;
  entranceTravel={progress:0,position:camera.position.clone(),target:controls.target.clone()};
  controls.enableZoom=false;
}
function entranceZoomActive(){return !!entranceTravel&&state.mode==='orbit'&&!state.cutaway&&!transition&&!scenePanelOpen();}
function queueEntranceTravel(distance){
  if(!entranceZoomActive()||!Number.isFinite(distance))return;
  // A large far-away approach eases to smaller steps near the doorway.
  const scale=THREE.MathUtils.clamp((entranceZoom.length-entranceTravel.progress)/35,.65,3);
  if(pendingEntranceTravel*distance<0)pendingEntranceTravel=0;
  pendingEntranceTravel=THREE.MathUtils.clamp(pendingEntranceTravel+distance*scale,-18,18);requestRender();
}
function advanceEntranceCamera(dt){
  if(!entranceZoomActive()||Math.abs(pendingEntranceTravel)<1e-6)return false;
  const distance=Math.sign(pendingEntranceTravel)*Math.min(Math.abs(pendingEntranceTravel),2,Math.max(.08,dt*40));
  const result=entranceZoom.advance({...entranceTravel,position:camera.position,target:controls.target},distance,{radius:cameraCollisionRadius(camera)});
  if(!result.onRoute){stopEntranceZoom();return false;}
  entranceTravel=result;pendingEntranceTravel-=result.travelled;
  if(result.blocked||result.atStart||result.atEnd)pendingEntranceTravel=0;
  if(result.blockedByDoor&&performance.now()-lastGateZoomNotice>2500){lastGateZoomNotice=performance.now();toast('宫门已关闭，请先使用右上角的“打开宫门”。');}
  cameraGuardBusy=true;
  try{camera.position.copy(result.position);controls.target.copy(result.target);controls.update();camera.lookAt(controls.target);rememberSafeCamera();}
  finally{cameraGuardBusy=false;}
  updateSeatControl();requestRender();return Math.abs(result.travelled)>1e-7;
}
function cancelCameraTransition(){
  if(transition?.timer)clearTimeout(transition.timer);
  transition=null;$('#viewport').classList.remove('camera-fade');if(controls)controls.enabled=state.mode==='orbit';
}
function setView(name,instant=false){
  if(!poses[name])return;
  toggleCutaway(name==='overview');startTransition(poses[name].position,poses[name].target,name,instant);closeSelection();
}
function updateShelfCategory(selection=null){
  const categories=shelfCategories(library?.furniture.racks??[]);
  document.querySelectorAll('[data-shelf-category]').forEach(button=>{
    const selected=button.dataset.shelfCategory===selection?.category;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
  $('#view-name').textContent=selection?.category??'书架分类';
  $('#view-subtitle').textContent=selection?`${selection.floor}F · ${selection.shelfId} 书架`:'';
  const index=categories.findIndex(category=>category.id===selection?.category);
  $('#view-index').textContent=index<0?'':String(index+1).padStart(2,'0');
}
function renderShelfCategories(){
  const container=$('#shelf-category-buttons');container.replaceChildren();
  for(const category of shelfCategories(library.furniture.racks)){
    const button=document.createElement('button');button.type='button';button.className='view-button';
    button.dataset.shelfCategory=category.id;button.textContent=category.label;button.setAttribute('aria-pressed','false');
    button.onclick=()=>{
      // Validate against the complete building even when its cutaway is currently enabled.
      const selection=shelfCategoryPose(library.furniture.racks,category.id,{
        isSafe:position=>cameraCollision.isSafe(new THREE.Vector3(...position),{radius:cameraCollisionRadius(camera),ignoreInvisible:false}),
      });
      if(!selection){toast('暂时无法定位到该分类书架，请稍后重试。');return;}
      toggleCutaway(false);startTransition(selection.position,selection.target,'shelf');closeSelection();
      $('#catalog-panel').hidden=true;$('#data-panel').hidden=true;$('#help').hidden=true;
      updateShelfCategory(selection);updateWalkInteraction();
    };
    container.append(button);
  }
}
function startTransition(position,target,name,instant=false){
  cancelCameraTransition();stopEntranceZoom();if(state.mode==='seated')leaveSeat(false);leaveWalk();state.view=name;
  camera.fov=poses[name].fov??62;camera.updateProjectionMatrix();
  const requestedDistance=new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...target));
  const entranceDistance=new THREE.Vector3(...poses.gate.position).distanceTo(new THREE.Vector3(...poses.gate.target));
  controls.maxDistance=Math.max(entranceDistance,requestedDistance)+.01;
  updateShelfCategory();
  updateSeatControl();
  // Presets and book focus may be on opposite sides of walls. Only validated
  // endpoints are displayed; a short fade replaces the former through-wall flyby.
  if(instant||matchMedia('(prefers-reduced-motion: reduce)').matches){placeCameraSafely(position,target);armEntranceZoom(name);updateSeatControl();return;}
  const move={position,target,timer:null};transition=move;controls.enabled=false;$('#viewport').classList.add('camera-fade');
  move.timer=setTimeout(()=>{
    if(transition!==move)return;
    placeCameraSafely(move.position,move.target);guardCameraMovement();
    if(document.hidden)requestRender();else renderMainScene();
    transition=null;controls.enabled=true;armEntranceZoom(name);updateSeatControl();
    requestAnimationFrame(()=>{if(!transition)$('#viewport').classList.remove('camera-fade');});
  },170);
  requestRender();
}
function toggleCutaway(force){
  const next=typeof force==='boolean'?force:!state.cutaway;
  if(next)stopEntranceZoom();
  if(!next&&state.cutaway&&cameraCollision&&!cameraCollision.isSafe(camera.position,{radius:cameraCollisionRadius(camera),ignoreInvisible:false})){
    // Validate against restored geometry before showing it around the camera.
    placeCameraSafely(camera.position,controls.target,{ignoreInvisible:false});
  }
  state.cutaway=next;
  library.architecture.roof.visible=!state.cutaway;library.architecture.ceiling.visible=!state.cutaway;library.architecture.envelope.visible=!state.cutaway;
  library.entrance.group.visible=!state.cutaway;
  $('#cutaway').classList.toggle('active',state.cutaway);$('#cutaway').setAttribute('aria-pressed',state.cutaway);
  if(cameraCollision)guardCameraMovement();
  renderer.shadowMap.needsUpdate=true;requestRender();return state.cutaway;
}
function setLighting(night){
  state.night=night;sun.intensity=night?.12:2.15;fill.intensity=night?.30:.55;sky.intensity=night?.95:1.4;ambient.intensity=night?.30:.22;
  scene.environmentIntensity=night?.14:.28;
  sky.color.set(night?0xaab9cd:0xc9def0);scene.background.set(night?0x43566b:0xb9d3e6);scene.fog.color.set(night?0x72818b:0xb4c8d3);palaceSky.setEvening(night);
  windowLights.forEach(l=>l.intensity=night?.22:.48);ceremonyLights.forEach(l=>l.intensity=night?430:290);renderer.toneMappingExposure=night?1.20:.96;
  library.architecture.materials.window.emissiveIntensity=night?.08:.28;
  const lightingButton=$('#daylight');
  if(lightingButton){
    const mode=night?'暮色':'日光',nextMode=night?'日光':'暮色';
    lightingButton.classList.add('active');
    lightingButton.querySelector('[data-lighting-icon="day"]').toggleAttribute('hidden',night);
    lightingButton.querySelector('[data-lighting-icon="evening"]').toggleAttribute('hidden',!night);
    lightingButton.querySelector('span').textContent=mode;
    const label=`当前光照为${mode}，点击切换为${nextMode}`;
    lightingButton.setAttribute('aria-label',label);lightingButton.title=label;
  }
  renderer.shadowMap.needsUpdate=true;requestRender();
}
function updateSeatControl(){
  const button=$('#throne-seat');if(!button)return;
  button.hidden=!(state.mode==='seated'||state.mode==='walk'||['hall','throne','objects','dais'].includes(state.view));
  button.classList.toggle('active',state.mode==='seated');
  $('#throne-seat span').textContent=state.mode==='seated'?'起身漫游':'御座入座';
  button.setAttribute('aria-pressed',String(state.mode==='seated'));
}
function enterWalk(){
  if(state.mode==='seated'){leaveSeat(true);return;}
  const keepEntrancePosition=!!entranceTravel&&entranceTravel.progress>=entranceZoom.approachDistance&&navigation.canStand(camera.position.x,camera.position.z,camera.position.y-navigation.eyeHeight);
  stopEntranceZoom();
  cancelCameraTransition();
  if(['overview','ceiling','roof','terrace','beasts','plaque'].includes(state.view))setView('hall',true);
  camera.fov=62;camera.updateProjectionMatrix();
  if(state.cutaway)toggleCutaway(false);state.mode='walk';controls.enabled=false;
  const currentFoot=camera.position.y-navigation.eyeHeight;
  let floor=state.view==='upper'?navigation.upperY:navigation.getWalkHeight(camera.position.x,camera.position.z,currentFoot);
  if(floor===null)floor=camera.position.y>navigation.upperY+1&&navigation.canStand(camera.position.x,camera.position.z,navigation.upperY)?navigation.upperY:0;
  const spawn=state.view==='gate'?navigation.spawns.entrance:state.view==='stairs'?navigation.spawns.stairs:state.view==='throne'&&navigation.spawns.throne?navigation.spawns.throne:floor>=navigation.upperY?navigation.spawns.upper:navigation.spawns.ground;
  if((!keepEntrancePosition&&['stairs','gate','throne'].includes(state.view))||!navigation.canStand(camera.position.x,camera.position.z,floor))camera.position.fromArray(spawn);
  else camera.position.y=floor+navigation.eyeHeight;
  if(!cameraCollision.isSafe(camera.position,{radius:cameraCollisionRadius(camera)}))camera.position.fromArray(spawn);
  if(!cameraCollision.isSafe(camera.position,{radius:cameraCollisionRadius(camera)}))camera.position.fromArray(navigation.spawns.ground);
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);yaw=['gate','stairs'].includes(state.view)?Math.PI/2:Math.atan2(-dir.x,-dir.z);pitch=0;
  camera.rotation.set(pitch,yaw,0,'YXZ');rememberSafeCamera();setWalkUI();
  toast('WASD 移动 · 拖动转向 · 点击书籍查看详情 · 左右宽梯通往二层');
}
function setWalkUI(){
  $('#walk').classList.add('active');$('#walk span').textContent='退出漫游';$('#walk-hint').hidden=false;
  $('#walk-hint').innerHTML='<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动　拖动转向　点击书籍查看　<kbd>Esc</kbd> 退出漫游';
  $('#touch-move').classList.add('enabled');$('#catalog-panel').hidden=true;$('#data-panel').hidden=true;closeSelection();renderer.domElement.focus();updateSeatControl();requestRender();
}
function enterSeat(){
  const seat=library.ceremonial.seatEye;if(!seat)return;
  stopEntranceZoom();
  cancelCameraTransition();leaveWalk();if(state.cutaway)toggleCutaway(false);
  camera.fov=62;camera.updateProjectionMatrix();
  const eye=new THREE.Vector3(...seat);
  if(!cameraCollision.isSafe(eye,{radius:cameraCollisionRadius(camera)})){toast('御座坐姿位置需要留出视角净空，请先从高台近观。');return;}
  // A deliberate viewpoint change uses a fade, never a flight through solids.
  $('#viewport').classList.add('camera-fade');state.mode='seated';state.view='throne';controls.enabled=false;keys.clear();
  camera.position.copy(eye);yaw=-Math.PI/2;pitch=-.08;camera.rotation.set(pitch,yaw,0,'YXZ');
  controls.target.set(eye.x+10,eye.y-.8,eye.z);rememberSafeCamera();
  $('#walk-hint').hidden=false;$('#walk-hint').textContent='已入座 · 拖动画面环视大殿 · 点击“起身漫游”或按 Esc 起身';
  $('#touch-move').classList.remove('enabled');updateShelfCategory();
  updateSeatControl();requestRender();setTimeout(()=>$('#viewport').classList.remove('camera-fade'),170);
}
function leaveSeat(walkAfter=true){
  if(state.mode!=='seated')return;
  const exit=library.ceremonial.standingExit??navigation.spawns.throne;
  if(exit)camera.position.fromArray(exit);state.mode=walkAfter?'walk':'orbit';controls.enabled=!walkAfter;
  yaw=-Math.PI/2;pitch=0;camera.rotation.set(0,yaw,0,'YXZ');controls.target.copy(camera.position).add(new THREE.Vector3(8,0,0));rememberSafeCamera();
  if(walkAfter){updateShelfCategory();setWalkUI();}
  else{$('#walk-hint').hidden=true;updateSeatControl();requestRender();}
}

function leaveWalk(){
  if(state.mode!=='walk')return;const dir=new THREE.Vector3();camera.getWorldDirection(dir);controls.target.copy(camera.position).addScaledVector(dir,4);
  state.mode='orbit';controls.enabled=true;rememberSafeCamera();keys.clear();$('#walk').classList.remove('active');$('#walk span').textContent='步行漫游';$('#walk-hint').hidden=true;$('#touch-move').classList.remove('enabled');requestRender();
}
function walk(dt){
  if(isWalkInputPaused())return;
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.6:2.6)*dt;
  let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  let r=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const n=Math.hypot(f,r);if(n){
    f/=n;r/=n;const before=camera.position.clone(),candidate=before.clone();
    navigation.step(candidate,(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed);
    const result=cameraCollision.resolve(before,candidate,{radius:cameraCollisionRadius(camera),slide:false});
    if(!result.blocked)camera.position.copy(candidate);
    else{
      const partial=before.clone();navigation.step(partial,result.position.x-before.x,result.position.z-before.z);
      if(!cameraCollision.sweep(before,partial,{radius:cameraCollisionRadius(camera)})&&cameraCollision.isSafe(partial,{radius:cameraCollisionRadius(camera)}))camera.position.copy(partial);
    }
    requestRender();updateSeatControl();
  }
  camera.rotation.set(pitch,yaw,0,'YXZ');rememberSafeCamera();
}
function pick(e){
  mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);raycaster.far=18;
  const hits=raycaster.intersectObject(collection.group,true);for(const hit of hits){const book=collection.findBookByIntersection(hit);if(book){selectBook(book.id,{hit:book});break;}}
}
async function busyAction(button,action,success){
  if(state.busy)return;state.busy=true;const label=button.textContent;button.disabled=true;button.textContent='处理中…';$('#data-status').textContent='正在生成书籍模型…';
  try{const result=await action();$('#data-status').textContent=success;toast(success);return result;}
  catch(e){$('#data-status').textContent=e.name==='AbortError'?'接口请求超时，请检查地址后重试。':e.message;toast($('#data-status').textContent);}
  finally{state.busy=false;button.disabled=false;button.textContent=label;}
}
function bindEvents(){
  $('#walk').onclick=()=>state.mode==='walk'?leaveWalk():enterWalk();$('#throne-seat').onclick=()=>state.mode==='seated'?leaveSeat(true):enterSeat();$('#cutaway').onclick=()=>toggleCutaway();
  $('#daylight').onclick=()=>setLighting(!state.night);
  $('#gate-toggle').onclick=()=>setGateOpen(!library.entrance.gate.isOpen);
  $('#catalog-toggle').onclick=()=>{const was=$('#catalog-panel').hidden;showPanel('catalog-panel');$('#catalog-panel').hidden=!was;updateWalkInteraction();if(was)$('#catalog-search').focus();};
  $('#catalog-close').onclick=()=>{$('#catalog-panel').hidden=true;updateWalkInteraction();};$('#catalog-search').addEventListener('input',renderCatalog);
  $('#data-toggle').onclick=()=>{showPanel('data-panel');fillBookForm(state.selected);};$('#data-close').onclick=()=>{$('#data-panel').hidden=true;updateWalkInteraction();};
  $('#selection-close').onclick=closeSelection;
  $('#selection-edit').onclick=()=>{const id=state.selected;showPanel('data-panel');fillBookForm(id);};
  $('#book-form').addEventListener('submit',e=>{e.preventDefault();const id=$('#book-id').value;
    busyAction($('#book-save'),async()=>{
      const original=collection.records.get(id),pages=Number($('#book-pages').value);
      const patch={title:$('#book-title').value,author:$('#book-author').value,pageCount:pages,
        coverUrl:uploadedCover||$('#book-cover').value.trim()||$('#book-cover').dataset.original,
        thickness:pages===original.pageCount?original.thickness:undefined};
      await updateBook(id,patch);$('#data-panel').hidden=false;$('#selection').hidden=true;fillBookForm(id);
    },'书名、封面与书籍模型已更新');
  });
  $('#book-upload').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')){toast('请选择图片文件。');return;}
    if(file.size>5*1024*1024){toast('请使用小于 5 MB 的封面图片。');e.target.value='';return;}
    try{uploadedCover=await readFile(file,'data');$('#book-form-note').textContent='已选择 '+file.name+'，点击“更新三维书籍”应用封面。';}catch(e){toast(e.message);}
  });
  $('#book-cover').addEventListener('input',()=>{uploadedCover=null;$('#book-upload').value='';});
  $('#json-import').onclick=()=>busyAction($('#json-import'),async()=>{await scheduleCollection(JSON.parse($('#json-input').value));fillBookForm();if(catalogBooks.length)await selectBook(catalogBooks[0].id,{focus:true});$('#data-panel').hidden=false;$('#selection').hidden=true;},'书目已导入，每条记录已生成一册三维书籍');

  $('#json-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;
    if(file.size>15*1024*1024){toast('JSON 文件请小于 15 MB；较大书库请分批加载。');return;}
    try{$('#json-input').value=await readFile(file,'text');$('#data-status').textContent='已读取 '+file.name+'，点击“替换藏书”应用。';}catch(e){toast(e.message);}
  });
  $('#feed-load').onclick=()=>busyAction($('#feed-load'),async()=>{const url=$('#feed-url').value.trim();if(!url)throw new Error('请输入书目 JSON 接口地址。');await loadBooksFromUrl(url);fillBookForm();},'接口书目已载入，模型已同步生成');
  $('#quality').onclick=()=>{const modes=['auto','high','balanced'];state.quality=modes[(modes.indexOf(state.quality)+1)%modes.length];adaptiveResolution.reset();applyResolution();renderer.shadowMap.enabled=!renderer.isFallback&&state.quality!=='balanced';renderer.shadowMap.needsUpdate=true;$('#quality span').textContent={auto:'自动画质',high:'精细画质',balanced:'流畅画质'}[state.quality];requestRender();updatePerformanceReadout();};
  $('#help-toggle').onclick=()=>{$('#help').hidden=false;updateWalkInteraction();updatePerformanceReadout();};$('#help-close').onclick=()=>{$('#help').hidden=true;updateWalkInteraction();};
  $('#performance-refresh').onclick=updatePerformanceReadout;
  $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前容器暂不支持全屏，可在新标签页打开预览。');}};
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();applyResolution();renderer.setSize(innerWidth,innerHeight);guardCameraMovement();requestRender();});
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){
      const hadPanel=scenePanelOpen();$('#help').hidden=true;$('#catalog-panel').hidden=true;$('#data-panel').hidden=true;closeSelection();
      if(!hadPanel){if(state.mode==='seated')leaveSeat(true);else leaveWalk();}
      e.preventDefault();return;
    }
    if(e.target.matches('input,textarea,select'))return;
    if(isWalkInputPaused())return;
    if(state.mode==='walk'&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);frameLoop?.request();}
    if(e.code==='KeyR')setView('hall');
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();resetScenePointer();});
  renderer.domElement.addEventListener('pointerdown',e=>{
    if(isWalkInputPaused())return;
    dragging=bookTap.begin(e);
    if(dragging&&(state.mode==='walk'||state.mode==='seated'))renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    const delta=bookTap.move(e);
    if(delta&&(state.mode==='walk'||state.mode==='seated')&&dragging&&!isWalkInputPaused()){
      yaw-=delta.x*.003;pitch=THREE.MathUtils.clamp(pitch-delta.y*.003,-1.3,1.3);requestRender();
    }
  });
  window.addEventListener('pointerup',e=>{
    const tap=bookTap.end(e);dragging=false;
    if(tap&&e.target===renderer.domElement&&!isWalkInputPaused()&&(state.mode==='orbit'||state.mode==='walk'))pick(e);
  },{capture:true});
  window.addEventListener('pointercancel',e=>{bookTap.cancel(e);dragging=false;});
  renderer.domElement.addEventListener('lostpointercapture',e=>{bookTap.cancel(e);dragging=false;});
  document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(state.mode!=='walk'||isWalkInputPaused())return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);frameLoop?.request();});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.move));});
  controls.addEventListener('start',cancelCameraTransition);
  controls.addEventListener('change',()=>{guardCameraMovement();if(entranceTravel&&!cameraGuardBusy&&!entranceZoom.isOnRoute(camera.position,entranceTravel.progress))stopEntranceZoom();updateSeatControl();requestRender();});
  entranceInput=bindEntranceZoomInput({element:renderer.domElement,controls,isActive:entranceZoomActive,onTravel:queueEntranceTravel});
  document.addEventListener('visibilitychange',()=>{keys.clear();resetScenePointer();if(document.hidden){pendingEntranceTravel=0;entranceInput?.cancel();frameLoop?.suspend();clearTimeout(coverTimer);coverTimer=null;}else{lastFrame=0;requestRender();}});
}
function readFile(file,mode){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('文件无法读取。'));mode==='data'?reader.readAsDataURL(file):reader.readAsText(file);});}
function updateGateControl(){
  const open=library.entrance.gate.isOpen,label=open?'关闭宫门':'打开宫门';
  $('#gate-toggle').hidden=false;
  $('#gate-toggle span').textContent=label;$('#gate-toggle').setAttribute('aria-label',label);$('#gate-toggle').setAttribute('aria-pressed',String(open));
}
function setGateOpen(open){
  const previous=library.entrance.gate.isOpen;library.entrance.gate.setOpen(Boolean(open));cameraCollision.refreshDynamic();
  const bodySafe=state.mode!=='walk'||navigation.canStand(camera.position.x,camera.position.z,camera.position.y-navigation.eyeHeight);
  if(!bodySafe||!cameraCollision.isSafe(camera.position,{radius:cameraCollisionRadius(camera)})){
    library.entrance.gate.setOpen(previous);cameraCollision.refreshDynamic();toast('请先离开门扇范围，再开合宫门。');return {applied:false,open:previous};
  }
  updateGateControl();renderer.shadowMap.needsUpdate=true;requestRender();
  return {applied:true,open:library.entrance.gate.isOpen};
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4800);}
function applyResolution(){
  if(!renderer)return;
  const ratio=state.quality==='high'?1.25:state.quality==='balanced'?.8:adaptiveResolution.ratio;
  if(renderer.isFallback){renderer.maxRenderTriangles=240000;renderer.maxRasterPixels=state.quality==='high'?1600000:state.quality==='balanced'?400000:750000;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,ratio));
}
function getPerformance(){return{version:'2.14.0',backend:renderer?.isFallback?'canvas-compatibility':'webgl',quality:state.quality,
  pixelRatio:renderer?.getPixelRatio(),startupMs:runtimeMetrics.readyMs,stagesMs:{...runtimeMetrics.phases},
  frames:runtimeMetrics.frames,lastFrameCpuMs:runtimeMetrics.lastFrameCpuMs,render:{...renderer?.info?.render},
  memory:{...renderer?.info?.memory},scheduler:{...frameLoop?.stats,pending:frameLoop?.pending},
  architecture:staticBatches?.stats,visibleArchitecture:runtimeMetrics.culling,books:collection?.stats,
  textureFilesLoaded:runtimeMetrics.textureCount,measurement:'CPU timings and renderer counters, not GPU frame-time or guaranteed FPS'};}
function updatePerformanceReadout(){
  const output=$('#performance-readout');if(!output||!renderer)return;
  const p=getPerformance(),r=p.render;
  output.textContent=`版本 ${p.version} · ${p.backend==='webgl'?'WebGL 图形加速':'Canvas 兼容预览'}\n`+
    `启动完成 ${(p.startupMs/1000).toFixed(2)} 秒 · 当前像素比例 ${p.pixelRatio.toFixed(2)}\n`+
    `实际绘制 ${p.frames} 帧 · 最近主线程绘制 ${p.lastFrameCpuMs.toFixed(1)} ms\n`+
    `本帧绘制调用 ${compact(r.calls||0)} · 三角面 ${compact(r.triangles||0)}\n`+
    `建筑剔除 ${(p.visibleArchitecture?.durationMs??0).toFixed(2)} ms · 书籍 ${compact(p.books?.placedBooks||0)} 册\n`+
    `调度回调 ${p.scheduler.callbacks} 次 · ${p.scheduler.pending?'交互更新中':'静止休眠'}\n`+
    (p.backend==='webgl'?'主线程时间不等同于 GPU 帧率。':'兼容预览通过 CPU 绘制；大型场景漫游建议使用支持图形加速的浏览器。');
}
function scheduleCoverRefresh(){
  if(!collection||coverTimer!==null||document.hidden)return;
  if(coverRevision===collectionRevision&&coverAnchor.distanceToSquared(camera.position)<.25)return;
  coverTimer=setTimeout(()=>{coverTimer=null;if(document.hidden||!collection)return;
    lastCoverRefresh=performance.now();coverAnchor.copy(camera.position);coverRevision=collectionRevision;
    collection.refreshVisibleBooks(camera,{radius:14,max:32}).catch(console.error);
  },Math.max(0,1200-(performance.now()-lastCoverRefresh)));
}
function renderMainScene(){
  const start=performance.now();needsRender=false;
  const full=!renderer.isFallback&&renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate;
  runtimeMetrics.culling=staticBatches?.update(camera,{full});
  renderer.render(scene,camera);
  runtimeMetrics.frames++;runtimeMetrics.lastFrameCpuMs=performance.now()-start;
  if(full&&runtimeMetrics.culling?.requiresRefine)requestRender();
  scheduleCoverRefresh();
}
function animate(time=0){
  if(document.hidden||!runtimeReady)return false;
  const interval=lastFrame?time-lastFrame:16;
  const dt=Math.min(interval/1000||.016,renderer.isFallback?.3:.05);lastFrame=time;
  const approaching=advanceEntranceCamera(dt);
  const moving=state.mode==='walk'&&!isWalkInputPaused()&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
  if(state.mode==='walk'&&!isWalkInputPaused()&&(moving||needsRender))walk(dt);else if(state.mode==='seated'&&needsRender){camera.rotation.set(pitch,yaw,0,'YXZ');rememberSafeCamera();}
  if(needsRender){
    guardCameraMovement();renderMainScene();lastRender=time;
    const activeSample=interval>250?runtimeMetrics.lastFrameCpuMs:Math.max(interval,runtimeMetrics.lastFrameCpuMs);
    if(state.quality==='auto'&&(moving||dragging||approaching)&&adaptiveResolution.sample(activeSample,time)){applyResolution();requestRender();}
  }
  let stageChanged=false;
  if(stageControls&&!$('#selection').hidden){stageChanged=stageControls.update();if(stageDirty){stageRenderer.render(stageScene,stageCamera);stageDirty=false;}}
  return needsRender||moving||stageChanged||Math.abs(pendingEntranceTravel)>1e-6;
}
let parentOrigin=null;
function notifyParent(message){if(window.parent!==window&&parentOrigin)window.parent.postMessage({channel:'guanwen-library',...message},parentOrigin);}
window.GuanwenLibrary={ready,
  async setBooks(books){await ready;return scheduleCollection(books);},updateBook,
  getBooks:()=>catalogBooks.map(b=>({...b})),getState,getPerformance,
  async selectBook(id){await ready;return selectBook(id,{focus:true});},

  async setView(view){await ready;setView(view);},
  async sitOnThrone(){await ready;enterSeat();return getState();},
  async standFromThrone(){await ready;leaveSeat(true);return getState();},
  async setGateOpen(open){await ready;return setGateOpen(open);},
};
connectSilvae(window.GuanwenLibrary, {captureView, restoreView});
frameLoop=createDemandLoop(animate);init();

// Reader navigation restores a validated camera pose through the existing collision guards.
function captureView(){return {view:state.view,mode:state.mode,position:camera.position.toArray(),target:controls.target.toArray(),yaw,pitch,cutaway:state.cutaway,night:state.night,gateOpen:library.entrance.gate.isOpen};}
async function restoreView(saved){
  if(!saved||!poses[saved.view])return;
  const valid=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=650);
  if(!valid(saved.position)||!valid(saved.target))return;
  setView(saved.view,true);setGateOpen(saved.gateOpen!==false);toggleCutaway(saved.cutaway===true);setLighting(saved.night===true);
  stopEntranceZoom();cancelCameraTransition();placeCameraSafely(saved.position,saved.target,{ignoreInvisible:state.cutaway});
  if(saved.mode==='walk')enterWalk();else if(saved.mode==='seated')enterSeat();
  if(state.mode!=='orbit'&&Number.isFinite(saved.yaw)&&Number.isFinite(saved.pitch)){yaw=saved.yaw;pitch=Math.max(-1.35,Math.min(1.35,saved.pitch));camera.rotation.set(pitch,yaw,0,'YXZ');}
  rememberSafeCamera();updateSeatControl();requestRender();
}
