import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import {
  CATALOG_BOOK_MODEL_SIZE,
  getShelvedBookTransform,
  type ShelfBookModelSize,
} from '../../virtual-library-scene';
import {
  REFERENCE_LIBRARY as R,
  REFERENCE_BOOK_CENTER_OFFSET,
} from '../hogwartsLibraryLayout';
import { createReferenceCatalogAnchors } from './referenceLibrary';

interface ShelfBand {
  baseY: number;
  pitch: number;
  rows: number;
  xMin: number;
  xMax: number;
}

interface GeneratedShelves {
  lower: ShelfBand;
  upper: ShelfBand;
  depth: number;
  frontOffset: number;
  boardThickness: number;
  backThickness: number;
  bookDepth: number;
  bookCenterOffset: number;
  bookRearGap: number;
  bookFrontInset: number;
}

function generatedShelves(): GeneratedShelves {
  const config = JSON.parse(
    readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'),
  ) as { shelves: GeneratedShelves };
  return config.shelves;
}

function transformedModelBounds(
  slot: ReturnType<typeof createReferenceCatalogAnchors>['catalogSlots'][number],
  modelSize: ShelfBookModelSize,
) {
  const transform = getShelvedBookTransform(slot, modelSize);
  const matrix = new THREE.Matrix4().compose(
    transform.position,
    new THREE.Quaternion().setFromEuler(transform.rotation),
    transform.scale,
  );
  return new THREE.Box3(
    new THREE.Vector3(-modelSize.width / 2, -modelSize.height / 2, -modelSize.depth / 2),
    new THREE.Vector3(modelSize.width / 2, modelSize.height / 2, modelSize.depth / 2),
  ).applyMatrix4(matrix);
}

function boxCorners(bounds: THREE.Box3) {
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => ({
    x: x < 0 ? bounds.min.x : bounds.max.x,
    y: y < 0 ? bounds.min.y : bounds.max.y,
    z: z < 0 ? bounds.min.z : bounds.max.z,
  }))));
}

describe('reference-library shelf depth contract', () => {
  it('publishes the target depth in runtime and generated shelf data', () => {
    expect(R).toMatchObject({
      caseDepth: 0.82,
      shelfFrontOffset: 0.41,
      shelfBackThickness: 0.16,
      shelfBoardThickness: 0.168,
      shelfRows: 6,
      lowerShelfBase: 0.30,
      upperShelfBase: 7.74,
      lowerShelfPitch: 0.924,
      upperShelfPitch: 1.056,
      book: { coverWidth: 0.30, spineWidth: 0.16, height: 0.48 },
    });
    expect(R.caseDepth / 2).toBeCloseTo(R.shelfFrontOffset, 6);
    expect(REFERENCE_BOOK_CENTER_OFFSET).toBeCloseTo(0.248, 6);

    const renderedDepth = R.book.coverWidth * 0.96;
    const rearGap = REFERENCE_BOOK_CENTER_OFFSET - renderedDepth / 2
      - R.shelfBackThickness / 2;
    const frontInset = R.shelfFrontOffset
      - (REFERENCE_BOOK_CENTER_OFFSET + renderedDepth / 2);
    expect(renderedDepth).toBeCloseTo(0.288, 6);
    expect(rearGap).toBeCloseTo(0.024, 6);
    expect(frontInset).toBeCloseTo(0.018, 6);

    const shelves = generatedShelves();
    expect(shelves.depth).toBeCloseTo(R.caseDepth, 6);
    expect(shelves.frontOffset).toBeCloseTo(R.shelfFrontOffset, 6);
    expect(shelves.boardThickness).toBeCloseTo(R.shelfBoardThickness, 6);
    expect(shelves.backThickness).toBeCloseTo(R.shelfBackThickness, 6);
    expect(shelves.bookDepth).toBeCloseTo(renderedDepth, 6);
    expect(shelves.bookCenterOffset).toBeCloseTo(REFERENCE_BOOK_CENTER_OFFSET, 6);
    expect(shelves.bookRearGap).toBeCloseTo(rearGap, 6);
    expect(shelves.bookFrontInset).toBeCloseTo(frontInset, 6);
    expect(shelves.lower.rows).toBe(R.shelfRows);
    expect(shelves.upper.rows).toBe(R.shelfRows);
  });

  it('allocates all 56 cases on both faces with six complete rows', () => {
    const { shelfSections, catalogSlots } = createReferenceCatalogAnchors();
    expect(shelfSections).toHaveLength(56);
    expect(catalogSlots).toHaveLength(56 * R.shelfRows * R.booksPerRow);

    for (const level of [0, R.galleryY]) for (const side of [-1, 1]) for (const face of [-1, 1]) {
      const matching = shelfSections.filter(section => (
        section.baseY === level
        && Math.sign(section.centerX ?? 0) === side
        && Math.round(-Math.sin(section.angle)) === face
      ));
      expect(matching).toHaveLength(7);
      expect(new Set(matching.map(section => section.centerZ)).size).toBe(7);
    }

    for (const section of shelfSections) {
      const face = Math.round(-Math.sin(section.angle));
      const sectionSlots = catalogSlots.filter(slot => slot.sectionId === section.id);
      const rows = new Map<number, number>();
      expect(section.shelfCount).toBe(6);
      expect(section.depth).toBeCloseTo(R.caseDepth, 6);
      expect(section.frontOffset).toBeCloseTo(R.shelfFrontOffset, 6);
      expect(section.bookCenterOffset).toBeCloseTo(REFERENCE_BOOK_CENTER_OFFSET, 6);
      for (const slot of sectionSlots) {
        expect(slot.spineFace).toBe(face);
        expect(slot.position.x).toBeCloseTo(section.centerX!, 6);
        expect(face * (slot.position.z - section.centerZ!)).toBeCloseTo(
          REFERENCE_BOOK_CENTER_OFFSET,
          6,
        );
        rows.set(slot.rowIndex, (rows.get(slot.rowIndex) ?? 0) + 1);
      }
      expect([...rows.keys()].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4, 5]);
      expect([...rows.values()]).toEqual(Array.from({ length: R.shelfRows }, () => R.booksPerRow));
    }
  });

  it('keeps transformed models on boards and inside each shelf cavity', () => {
    const shelves = generatedShelves();
    const { catalogSlots } = createReferenceCatalogAnchors();
    const modelVariants: readonly ShelfBookModelSize[] = [
      CATALOG_BOOK_MODEL_SIZE,
      {
        width: R.book.coverWidth,
        height: R.book.height,
        depth: R.book.spineWidth,
      },
    ];

    for (const slot of catalogSlots) {
      const band = slot.position.y >= R.galleryY ? shelves.upper : shelves.lower;
      const boardCenterY = band.baseY + slot.rowIndex * band.pitch;
      const boardTopY = boardCenterY + shelves.boardThickness / 2;
      const nextBoardBottomY = boardCenterY + band.pitch - shelves.boardThickness / 2;
      for (const modelSize of modelVariants) {
        const bounds = transformedModelBounds(slot, modelSize);
        expect(bounds.min.y).toBeCloseTo(boardTopY, 6);
        expect(bounds.max.y).toBeLessThan(nextBoardBottomY);
        expect(nextBoardBottomY - bounds.max.y).toBeGreaterThan(shelves.boardThickness);
      }
    }

    for (const section of createReferenceCatalogAnchors().shelfSections) {
      const frontX = -Math.cos(section.angle);
      const frontZ = -Math.sin(section.angle);
      const sectionSlots = catalogSlots.filter(slot => slot.sectionId === section.id);
      for (const row of [0, 1, 2, 3, 4, 5]) {
        const slot = sectionSlots.find(candidate => candidate.rowIndex === row);
        expect(slot).toBeDefined();
        for (const modelSize of modelVariants) {
          const bounds = transformedModelBounds(slot!, modelSize);
          const depthOffsets = boxCorners(bounds).map(corner => (
            (corner.x - section.centerX!) * frontX
            + (corner.z - section.centerZ!) * frontZ
          ));
          const rear = Math.min(...depthOffsets);
          const front = Math.max(...depthOffsets);
          expect(front - rear).toBeCloseTo(R.book.coverWidth * 0.96, 6);
          expect(rear).toBeGreaterThanOrEqual(shelves.backThickness / 2);
          expect(rear - shelves.backThickness / 2).toBeCloseTo(0.024, 6);
          expect(front).toBeLessThanOrEqual(shelves.frontOffset);
          expect(shelves.frontOffset - front).toBeCloseTo(0.018, 6);
        }
      }
    }
  });
});
