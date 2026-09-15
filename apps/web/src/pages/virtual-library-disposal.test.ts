import * as THREE from 'three';
import { disposeScene } from './virtual-library-scene';

it('releases cached light shadows and shared bump textures when leaving the library', () => {
  const scene=new THREE.Scene(), light=new THREE.SpotLight();
  light.shadow.map=new THREE.WebGLRenderTarget(16,16);
  const shadowDisposed=vi.spyOn(light.shadow.map,'dispose');
  const bump=new THREE.Texture(), bumpDisposed=vi.spyOn(bump,'dispose');
  const material=new THREE.MeshStandardMaterial({bumpMap:bump});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);
  scene.add(light,mesh,mesh.clone());
  disposeScene(scene);
  expect(shadowDisposed).toHaveBeenCalledOnce();
  expect(bumpDisposed).toHaveBeenCalledOnce();
});
