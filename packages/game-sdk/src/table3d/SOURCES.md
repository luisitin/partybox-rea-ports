# Adopted table3d sources

The provisional kit uses the owner's mandated Three.js + React Three Fiber + Rapier stack.
`runtime.tsx` adopts upstream Canvas/Physics/RigidBody usage patterns, rather than a new renderer
or solver. `geometry.ts` adopts Three ShapeUtils ear-clipping and BufferGeometry construction,
projecting planar faces to their dominant normal plane and restoring their original winding.

- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry),
  [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4),
  [Vector3](https://threejs.org/docs/#api/en/math/Vector3): MIT, installed `three@0.186.1`.
- [React Three Fiber Canvas](https://r3f.docs.pmnd.rs/api/canvas): MIT,
  installed `@react-three/fiber@9.8.1`.
- [React Three Rapier Physics/RigidBody](https://pmndrs.github.io/react-three-rapier/): MIT,
  installed `@react-three/rapier@2.2.0`, with its sole embedded Rapier solver.
- [seen.js](https://github.com/themadcreator/seen/tree/d8946b3b97b9814e78f79334b9fd6349b9022289)
  (Apache-2.0): the earlier Monopoly token projection was adapted from seen's affine camera,
  face-normal, directional Phong and painter-ordering routines. `project.ts` retains that
  composition and shading formula but replaces vector/matrix operations with Three's math.
  The inherited Apache license is [seen-LICENSE.txt](./seen-LICENSE.txt); original provenance
  is also in the game's TOKEN_SOURCES.md. This is a derivative rewrite, not an active seen runtime.

The new glue handles one lazy boundary, manual orthographic camera bounds, lost-context fallback,
geometry/material disposal and immutable polygon data. These are minimal adapters to PartyBox's
SDK boundary and accessibility/motion requirements. They contain no game rules or solver outcomes.
