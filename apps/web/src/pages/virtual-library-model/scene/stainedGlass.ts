import * as THREE from "three";
import { tokens } from "../../../theme/generated-tokens";

export type MoonlitLibraryGlassVariant = "window" | "transom";

export const MOONLIT_LIBRARY_STAINED_GLASS = {
  motif: "moonlit-library",
  windowEmissiveIntensity: 0.34,
  transomEmissiveIntensity: 0.26,
} as const;

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  context.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 4;
    const pointRadius = point % 2 === 0 ? radius : radius * 0.38;
    const nextX = x + Math.cos(angle) * pointRadius;
    const nextY = y + Math.sin(angle) * pointRadius;
    if (point === 0) context.moveTo(nextX, nextY);
    else context.lineTo(nextX, nextY);
  }
  context.closePath();
  context.fill();
}

function drawOpenBook(
  context: CanvasRenderingContext2D,
  centerX: number,
  baselineY: number,
  width: number,
  height: number,
) {
  context.save();
  context.fillStyle = tokens.color.primitive.cream200;
  context.strokeStyle = tokens.color.primitive.amber600;
  context.lineWidth = Math.max(7, width * 0.018);
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(centerX, baselineY - height * 0.82);
  context.bezierCurveTo(
    centerX - width * 0.22,
    baselineY - height,
    centerX - width * 0.46,
    baselineY - height * 0.82,
    centerX - width * 0.48,
    baselineY - height * 0.08,
  );
  context.bezierCurveTo(
    centerX - width * 0.24,
    baselineY - height * 0.28,
    centerX - width * 0.08,
    baselineY - height * 0.2,
    centerX,
    baselineY,
  );
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(centerX, baselineY - height * 0.82);
  context.bezierCurveTo(
    centerX + width * 0.22,
    baselineY - height,
    centerX + width * 0.46,
    baselineY - height * 0.82,
    centerX + width * 0.48,
    baselineY - height * 0.08,
  );
  context.bezierCurveTo(
    centerX + width * 0.24,
    baselineY - height * 0.28,
    centerX + width * 0.08,
    baselineY - height * 0.2,
    centerX,
    baselineY,
  );
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(centerX, baselineY - height * 0.82);
  context.lineTo(centerX, baselineY);
  context.stroke();
  context.restore();
}

function tracePointedBorder(
  context: CanvasRenderingContext2D,
  variant: MoonlitLibraryGlassVariant,
  width: number,
  height: number,
  inset: number,
) {
  context.beginPath();
  context.moveTo(inset, height - inset);
  if (variant === "window") {
    context.lineTo(inset, height * 0.42);
    context.quadraticCurveTo(width * 0.08, height * 0.12, width / 2, inset);
    context.quadraticCurveTo(width * 0.92, height * 0.12, width - inset, height * 0.42);
    context.lineTo(width - inset, height - inset);
  } else {
    context.quadraticCurveTo(width * 0.12, height * 0.2, width / 2, inset);
    context.quadraticCurveTo(width * 0.88, height * 0.2, width - inset, height - inset);
  }
  context.closePath();
}

function drawPointedGlassBorder(
  context: CanvasRenderingContext2D,
  variant: MoonlitLibraryGlassVariant,
  width: number,
  height: number,
) {
  context.save();
  context.globalAlpha = 0.9;
  context.lineJoin = "round";

  const outerInset = width * 0.035;
  tracePointedBorder(context, variant, width, height, outerInset);
  context.strokeStyle = tokens.color.primitive.coral700;
  context.lineWidth = width * 0.045;
  context.stroke();

  const innerInset = width * 0.075;
  tracePointedBorder(context, variant, width, height, innerInset);
  context.strokeStyle = tokens.color.primitive.amber600;
  context.lineWidth = width * 0.018;
  context.stroke();
  context.restore();
}

export function createMoonlitLibraryStainedGlassTexture(
  variant: MoonlitLibraryGlassVariant,
) {
  const canvas = document.createElement("canvas");
  canvas.width = variant === "window" ? 768 : 1024;
  canvas.height = variant === "window" ? 1024 : 640;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  const { width, height } = canvas;
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, tokens.color.primitive.ink900);
  background.addColorStop(0.46, tokens.color.primitive.teal600);
  background.addColorStop(1, tokens.color.primitive.ink800);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const cellColors = [
    tokens.color.primitive.teal500,
    tokens.color.primitive.coral700,
    tokens.color.primitive.amber600,
    tokens.color.primitive.ink700,
  ];
  const columns = variant === "window" ? 5 : 7;
  const rows = variant === "window" ? 7 : 4;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  context.globalAlpha = 0.34;
  context.lineWidth = Math.max(5, width * 0.009);
  context.strokeStyle = tokens.color.primitive.ink900;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const inset = Math.max(4, width * 0.006);
      context.fillStyle = cellColors[(row * 3 + column * 5) % cellColors.length];
      context.beginPath();
      context.moveTo(column * cellWidth + inset, row * cellHeight + inset);
      context.lineTo((column + 1) * cellWidth - inset, row * cellHeight + inset * 0.5);
      context.lineTo((column + 1) * cellWidth - inset * 0.5, (row + 1) * cellHeight - inset);
      context.lineTo(column * cellWidth + inset * 0.5, (row + 1) * cellHeight - inset * 0.4);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
  context.globalAlpha = 1;
  drawPointedGlassBorder(context, variant, width, height);

  const moonX = variant === "window" ? width * 0.34 : width * 0.28;
  const moonY = variant === "window" ? height * 0.25 : height * 0.3;
  const moonRadius = Math.min(width, height) * (variant === "window" ? 0.12 : 0.105);
  context.fillStyle = tokens.color.primitive.cream100;
  context.beginPath();
  context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = tokens.color.primitive.ink900;
  context.beginPath();
  context.arc(
    moonX + moonRadius * 0.46,
    moonY - moonRadius * 0.12,
    moonRadius * 0.92,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = tokens.color.primitive.cream100;
  const stars = variant === "window"
    ? [[0.62, 0.2, 0.025], [0.73, 0.31, 0.018], [0.55, 0.38, 0.015]]
    : [[0.52, 0.24, 0.02], [0.67, 0.34, 0.014], [0.78, 0.2, 0.012]];
  stars.forEach(([x, y, radius]) => drawStar(context, width * x, height * y, width * radius));

  drawOpenBook(
    context,
    width * (variant === "window" ? 0.5 : 0.72),
    height * (variant === "window" ? 0.86 : 0.82),
    width * (variant === "window" ? 0.56 : 0.38),
    height * (variant === "window" ? 0.2 : 0.28),
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.userData.motif = MOONLIT_LIBRARY_STAINED_GLASS.motif;
  texture.userData.variant = variant;
  return texture;
}

export function createMoonlitLibraryStainedGlassMaterial(
  variant: MoonlitLibraryGlassVariant,
) {
  const texture = createMoonlitLibraryStainedGlassTexture(variant);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: tokens.color.primitive.cream100,
    emissive: tokens.color.primitive.teal600,
    emissiveIntensity: variant === "window"
      ? MOONLIT_LIBRARY_STAINED_GLASS.windowEmissiveIntensity
      : MOONLIT_LIBRARY_STAINED_GLASS.transomEmissiveIntensity,
    roughness: 0.7,
    metalness: 0.02,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  material.name = `Moonlit library stained glass ${variant} material`;
  material.userData.motif = MOONLIT_LIBRARY_STAINED_GLASS.motif;
  material.userData.variant = variant;
  return material;
}

export function createPointedWindowShape(width: number, height: number) {
  const archStart = height * 0.58;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, archStart);
  shape.quadraticCurveTo(-width * 0.42, height * 0.91, 0, height);
  shape.quadraticCurveTo(width * 0.42, height * 0.91, width / 2, archStart);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

export function createPointedTransomShape(width: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.quadraticCurveTo(width * 0.4, height * 0.84, 0, height);
  shape.quadraticCurveTo(-width * 0.4, height * 0.84, -width / 2, 0);
  shape.closePath();
  return shape;
}

export function createStainedGlassPaneGeometry(
  shape: THREE.Shape,
  width: number,
  height: number,
) {
  const geometry = new THREE.ShapeGeometry(shape, 24);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      THREE.MathUtils.clamp((positions.getX(index) + width / 2) / width, 0, 1),
      THREE.MathUtils.clamp(positions.getY(index) / height, 0, 1),
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

export function createStainedGlassCame(
  start: THREE.Vector2,
  end: THREE.Vector2,
  material: THREE.Material,
  name: string,
  z: number,
  thickness = 0.055,
  depth = 0.09,
) {
  const delta = end.clone().sub(start);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const came = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, delta.length(), depth),
    material,
  );
  came.name = name;
  came.position.set(midpoint.x, midpoint.y, z);
  came.rotation.z = -Math.atan2(delta.x, delta.y);
  came.castShadow = true;
  return came;
}
