import {
  AmbientLight,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { tokens } from "../../theme/generated-tokens";
import {
  PAGE_CURL_HORIZONTAL_SEGMENTS,
  PAGE_CURL_VERTICAL_SEGMENTS,
  pageCurlPath,
  pageCurlPointForColumn,
  type PageTurnDirection,
} from "./page-turn-geometry";
import { pageTurnPixelRatio } from "./page-turn-rendering";

const PAGE_CAMERA_Z = 6;
const PAGE_SHADOW_OPACITY = 0.22;
const PAGE_TEXTURE_FADE_START = 0.12;
const PAGE_TEXTURE_FADE_END = 0.48;
const PAGE_TEXTURE_MID_TURN_OPACITY = 0.12;

export type PageCurlRenderer = {
  render: (progress: number) => void;
  setBackSnapshot: (snapshot: HTMLCanvasElement) => void;
  dispose: () => void;
};

type PageTextureRegion = {
  start: number;
  width: number;
};

export type PageCurlTextureLayout = {
  turning: PageTextureRegion;
  back: PageTextureRegion;
  static?: PageTextureRegion;
};

const FULL_PAGE_TEXTURE: PageTextureRegion = { start: 0, width: 1 };

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export function pageTextureFacingOpacity(facing: number) {
  const position = clampUnit(
    (Math.abs(facing) - PAGE_TEXTURE_FADE_START)
    / (PAGE_TEXTURE_FADE_END - PAGE_TEXTURE_FADE_START),
  );
  return position * position * (3 - 2 * position);
}

export function pageTextureMotionOpacity(progress: number) {
  const distanceFromMiddle = Math.abs(2 * clampUnit(progress) - 1);
  const easedDistance = distanceFromMiddle * distanceFromMiddle
    * (3 - 2 * distanceFromMiddle);
  return PAGE_TEXTURE_MID_TURN_OPACITY
    + (1 - PAGE_TEXTURE_MID_TURN_OPACITY) * easedDistance;
}

export function pageCurlTextureLayout(direction: PageTurnDirection, spread: boolean): PageCurlTextureLayout {
  if (!spread) return { turning: FULL_PAGE_TEXTURE, back: FULL_PAGE_TEXTURE };
  return direction === "NEXT"
    ? {
        turning: { start: 0.5, width: 0.5 },
        back: { start: 0, width: 0.5 },
        static: { start: 0, width: 0.5 },
      }
    : {
        turning: { start: 0, width: 0.5 },
        back: { start: 0.5, width: 0.5 },
        static: { start: 0.5, width: 0.5 },
      };
}

function pageTexture(
  renderer: WebGLRenderer,
  source: HTMLCanvasElement,
  region: PageTextureRegion,
  mirrored = false,
) {
  const texture = new CanvasTexture(source);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (mirrored || region.width !== 1 || region.start !== 0) {
    texture.wrapS = RepeatWrapping;
  }
  texture.repeat.x = (mirrored ? -1 : 1) * region.width;
  texture.offset.x = mirrored ? region.start + region.width : region.start;
  texture.needsUpdate = true;
  return texture;
}

function pageBackgroundColor(source: HTMLCanvasElement) {
  try {
    const pixel = source.getContext("2d", { willReadFrequently: true })
      ?.getImageData(0, 0, 1, 1).data;
    if (pixel) return new Color(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
  } catch {
    // Cross-origin images can make a snapshot unreadable. The semantic canvas
    // color is still a safe paper-color fallback for the edge-on fold.
  }
  return new Color(tokens.color.semantic.canvas);
}

function softenEdgeOnText(
  material: MeshStandardMaterial,
  source: HTMLCanvasElement,
  motionOpacityUniform: { value: number },
) {
  const backgroundUniform = { value: pageBackgroundColor(source) };
  material.customProgramCacheKey = () => "page-texture-facing-fade-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.pageTextureBackground = backgroundUniform;
    shader.uniforms.pageTextureMotionOpacity = motionOpacityUniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
#ifndef FLAT_SHADED
  float pageTextureFacing = smoothstep(
    ${PAGE_TEXTURE_FADE_START.toFixed(2)},
    ${PAGE_TEXTURE_FADE_END.toFixed(2)},
    abs(normalize(vNormal).z)
  );
  diffuseColor.rgb = mix(
    pageTextureBackground,
    diffuseColor.rgb,
    pageTextureFacing * pageTextureMotionOpacity
  );
#endif`,
    ).replace(
      "#include <common>",
      `#include <common>
uniform vec3 pageTextureBackground;
uniform float pageTextureMotionOpacity;`,
    );
  };
  return backgroundUniform;
}

export function createPageCurlRenderer({
  canvas,
  frontSnapshot,
  direction,
  spread = false,
}: {
  canvas: HTMLCanvasElement;
  frontSnapshot: HTMLCanvasElement;
  direction: PageTurnDirection;
  spread?: boolean;
}): PageCurlRenderer {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) throw new Error("翻页画布没有可用尺寸");

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });
  renderer.setPixelRatio(pageTurnPixelRatio(window.devicePixelRatio || 1));
  renderer.setSize(bounds.width, bounds.height, false);
  renderer.setClearColor(new Color(tokens.color.primitive.black), 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const aspect = bounds.width / bounds.height;
  const pageHeight = 2;
  const pageWidth = pageHeight * aspect;
  const turningPageWidth = spread ? pageWidth / 2 : pageWidth;
  const turningPageOffset = spread
    ? (direction === "NEXT" ? pageWidth / 4 : -pageWidth / 4)
    : 0;
  const staticPageOffset = -turningPageOffset;
  const textureLayout = pageCurlTextureLayout(direction, spread);
  const camera = new OrthographicCamera(
    -pageWidth / 2,
    pageWidth / 2,
    pageHeight / 2,
    -pageHeight / 2,
    0.1,
    20,
  );
  camera.position.set(0, 0, PAGE_CAMERA_Z);
  camera.lookAt(0, 0, 0);

  const scene = new Scene();
  const geometry = new PlaneGeometry(
    turningPageWidth,
    pageHeight,
    PAGE_CURL_HORIZONTAL_SEGMENTS,
    PAGE_CURL_VERTICAL_SEGMENTS,
  );
  const originalPositions = Float32Array.from(geometry.attributes.position.array as ArrayLike<number>);
  const frontTexture = pageTexture(renderer, frontSnapshot, textureLayout.turning);
  let backTexture = pageTexture(renderer, frontSnapshot, textureLayout.back, true);

  const frontMaterial = new MeshStandardMaterial({
    color: new Color(tokens.color.primitive.white),
    map: frontTexture,
    metalness: 0,
    roughness: 0.96,
    side: FrontSide,
  });
  const backMaterial = new MeshStandardMaterial({
    color: new Color(tokens.color.primitive.white),
    map: backTexture,
    metalness: 0,
    roughness: 1,
    side: BackSide,
  });
  const motionOpacityUniform = { value: 1 };
  softenEdgeOnText(frontMaterial, frontSnapshot, motionOpacityUniform);
  const backBackgroundUniform = softenEdgeOnText(
    backMaterial,
    frontSnapshot,
    motionOpacityUniform,
  );
  const frontPage = new Mesh(geometry, frontMaterial);
  const backPage = new Mesh(geometry, backMaterial);
  frontPage.position.set(turningPageOffset, 0, 0.002);
  backPage.position.copy(frontPage.position);
  frontPage.castShadow = true;
  backPage.castShadow = true;
  scene.add(frontPage, backPage);

  const staticTexture = textureLayout.static
    ? pageTexture(renderer, frontSnapshot, textureLayout.static)
    : null;
  const staticMaterial = staticTexture
    ? new MeshStandardMaterial({
        color: new Color(tokens.color.primitive.white),
        map: staticTexture,
        metalness: 0,
        roughness: 0.96,
        side: FrontSide,
      })
    : null;
  const staticGeometry = staticMaterial ? new PlaneGeometry(turningPageWidth, pageHeight) : null;
  if (staticGeometry && staticMaterial) {
    const staticPage = new Mesh(staticGeometry, staticMaterial);
    staticPage.position.x = staticPageOffset;
    scene.add(staticPage);
  }

  const shadowMaterial = new ShadowMaterial({
    color: new Color(tokens.color.primitive.black),
    opacity: PAGE_SHADOW_OPACITY,
    transparent: true,
  });
  const shadowReceiver = new Mesh(new PlaneGeometry(pageWidth, pageHeight), shadowMaterial);
  shadowReceiver.position.z = -0.035;
  shadowReceiver.receiveShadow = true;
  scene.add(shadowReceiver);

  scene.add(new AmbientLight(new Color(tokens.color.primitive.white), 2.1));
  const keyLight = new DirectionalLight(new Color(tokens.color.primitive.white), 1.15);
  keyLight.position.set(direction === "NEXT" ? 2.4 : -2.4, 2.8, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -pageWidth * 1.6;
  keyLight.shadow.camera.right = pageWidth * 1.6;
  keyLight.shadow.camera.top = pageHeight * 1.4;
  keyLight.shadow.camera.bottom = -pageHeight * 1.4;
  scene.add(keyLight);

  const render = (progress: number) => {
    motionOpacityUniform.value = pageTextureMotionOpacity(progress);
    const positions = geometry.attributes.position;
    const rowLength = PAGE_CURL_HORIZONTAL_SEGMENTS + 1;
    for (let row = 0; row <= PAGE_CURL_VERTICAL_SEGMENTS; row += 1) {
      const rowStart = row * rowLength;
      const firstPositionIndex = rowStart * 3;
      const originalY = originalPositions[firstPositionIndex + 1];
      const rowPosition = (originalY + pageHeight / 2) / pageHeight;
      const path = pageCurlPath({
        progress,
        direction,
        width: turningPageWidth,
        segments: PAGE_CURL_HORIZONTAL_SEGMENTS,
        rowPosition,
      });
      for (let column = 0; column <= PAGE_CURL_HORIZONTAL_SEGMENTS; column += 1) {
        const vertexIndex = rowStart + column;
        const point = pageCurlPointForColumn(path, column, direction);
        positions.setXYZ(vertexIndex, point.x, originalY, point.z);
      }
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    renderer.render(scene, camera);
  };

  return {
    render,
    setBackSnapshot(snapshot) {
      const nextTexture = pageTexture(renderer, snapshot, textureLayout.back, true);
      backMaterial.map = nextTexture;
      backMaterial.needsUpdate = true;
      backBackgroundUniform.value.copy(pageBackgroundColor(snapshot));
      backTexture.dispose();
      backTexture = nextTexture;
    },
    dispose() {
      frontTexture.dispose();
      backTexture.dispose();
      staticTexture?.dispose();
      frontMaterial.dispose();
      backMaterial.dispose();
      staticMaterial?.dispose();
      staticGeometry?.dispose();
      shadowMaterial.dispose();
      shadowReceiver.geometry.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
