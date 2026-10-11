import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { solidGeometry } from './geometry';
import { projectSolid } from './project';
import type { MeshData, Point3 } from './types';

const MESH: MeshData = [
  {
    points: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
  },
  {
    points: [
      [-1, 1, 1],
      [1, 1, 1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
    material: 'bright',
  },
];

describe('table3d polygon geometry', () => {
  it('triangulates convex faces and groups material runs with finite unit normals', () => {
    const geometry = solidGeometry(MESH);
    expect(geometry.getAttribute('position').count).toBe(12);
    expect(geometry.groups).toEqual([
      { start: 0, count: 6, materialIndex: 0 },
      { start: 6, count: 6, materialIndex: 2 },
    ]);
    const normals = geometry.getAttribute('normal');
    for (let index = 0; index < normals.count; index += 1)
      expect(Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index))).toBeCloseTo(
        1,
      );
    geometry.dispose();
  });

  it('ignores incomplete and nonfinite faces without corrupting the remaining solid', () => {
    const geometry = solidGeometry([
      ...MESH,
      { points: [[0, 0, 0]] },
      {
        points: [
          [0, 0, 0],
          [NaN, 1, 0],
          [1, 1, 0],
        ],
      },
    ]);
    expect(geometry.getAttribute('position').count).toBe(12);
    geometry.dispose();
  });

  const cap: readonly Point3[] = [
    [0, 0, 0],
    [3, 0, 0],
    [3, 1, 0],
    [1, 1, 0],
    [1, 3, 0],
    [0, 3, 0],
  ];
  it('fills a concave L cap with exact area and consistent winding on each dominant plane', () => {
    const planes = [
      { map: ([x, y, z]: Point3): Point3 => [x, y, z], normal: new Vector3(0, 0, 1) },
      { map: ([x, y, z]: Point3): Point3 => [z, x, y], normal: new Vector3(1, 0, 0) },
      { map: ([x, y, z]: Point3): Point3 => [x, z, y], normal: new Vector3(0, -1, 0) },
    ];
    for (const plane of planes)
      for (const reverse of [false, true]) {
        const points = cap.map(plane.map);
        if (reverse) points.reverse();
        const normal = plane.normal.clone().multiplyScalar(reverse ? -1 : 1);
        const geometry = solidGeometry([{ points }]);
        const positions = geometry.getAttribute('position');
        expect(positions.count).toBe(12); // six vertices produce four complete interior triangles
        let area = 0;
        for (let i = 0; i < positions.count; i += 3) {
          const a = new Vector3().fromBufferAttribute(positions, i);
          const b = new Vector3().fromBufferAttribute(positions, i + 1);
          const c = new Vector3().fromBufferAttribute(positions, i + 2);
          const cross = b.sub(a).cross(c.sub(a));
          expect(cross.dot(normal)).toBeGreaterThan(0);
          area += cross.length() / 2;
        }
        expect(area).toBeCloseTo(5); // 3×3 square minus its 2×2 missing corner
        geometry.dispose();
      }
  });

  it('keeps an extruded concave boot-like profile closed with outward winding and exact volume', () => {
    const front = [...cap].reverse();
    const back = cap.map(([x, y]): Point3 => [x, y, 2]);
    const sides = cap.map((point, i) => ({
      points: [point, cap[(i + 1) % cap.length]!, back[(i + 1) % cap.length]!, back[i]!],
    }));
    const geometry = solidGeometry([{ points: front }, { points: back }, ...sides]);
    const positions = geometry.getAttribute('position');
    const edges = new Map<string, { count: number; direction: number }>();
    let volume = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new Vector3().fromBufferAttribute(positions, i + offset),
      );
      volume += points[0]!.dot(points[1]!.clone().cross(points[2]!)) / 6;
      for (let edge = 0; edge < 3; edge += 1) {
        const a = points[edge]!.toArray().join(','),
          b = points[(edge + 1) % 3]!.toArray().join(',');
        const key = [a, b].sort().join('|');
        const previous = edges.get(key) ?? { count: 0, direction: 0 };
        edges.set(key, {
          count: previous.count + 1,
          direction: previous.direction + (a < b ? 1 : -1),
        });
      }
    }
    expect(volume).toBeCloseTo(10); // cap area 5 × extrusion depth 2
    for (const edge of edges.values()) expect(edge).toEqual({ count: 2, direction: 0 });
    geometry.dispose();
  });
});

describe('table3d thumbnail projection', () => {
  it('keeps surfaces finite, ordered by depth and inside the 96px frame at different viewpoints', () => {
    for (const yaw of [-2, -0.48, 0, 0.9, NaN]) {
      const faces = projectSolid(MESH, yaw);
      expect(faces.length).toBeGreaterThan(0);
      for (const [index, face] of faces.entries()) {
        expect(Number.isFinite(face.shade)).toBe(true);
        if (index > 0) expect(faces[index - 1]!.depth).toBeGreaterThanOrEqual(face.depth);
        for (const point of face.points.split(' '))
          for (const value of point.split(',').map(Number)) {
            expect(value).toBeGreaterThanOrEqual(7);
            expect(value).toBeLessThanOrEqual(88);
          }
      }
    }
  });

  it('handles empty, incomplete, degenerate and nonfinite input', () => {
    expect(projectSolid([])).toEqual([]);
    expect(
      projectSolid([
        {
          points: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
      ]),
    ).toEqual([]);
    expect(projectSolid([{ points: [[0, 0, 0]] }])).toEqual([]);
    expect(
      projectSolid([
        {
          points: [
            [0, 0, 0],
            [Infinity, 1, 0],
            [1, 1, 0],
          ],
        },
      ]),
    ).toEqual([]);
  });
});

describe('table3d smooth shading', () => {
  const CORNER: MeshData = [
    {
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    },
    {
      points: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    },
  ];
  const normalsAt = (crease?: number): Set<string> => {
    const g = solidGeometry(CORNER, crease);
    const p = g.getAttribute('position'),
      n = g.getAttribute('normal');
    const out = new Set<string>();
    for (let i = 0; i < p.count; i++)
      if (p.getX(i) === 0 && p.getY(i) === 0 && p.getZ(i) === 0)
        out.add([n.getX(i), n.getY(i), n.getZ(i)].map((v) => v.toFixed(3)).join(','));
    return out;
  };
  it('stays flat by default: a shared corner keeps one normal per face', () => {
    expect(normalsAt().size).toBeGreaterThan(1);
  });
  it('shares one normal across a crease wider than the faces meet at', () => {
    expect(normalsAt(Math.PI / 2 + 0.1).size).toBe(1);
  });
  it('still splits a crease sharper than the limit', () => {
    expect(normalsAt(Math.PI / 4).size).toBeGreaterThan(1);
  });
});
