# Agar.io reference comparison

Reference: the [archived May1,2015 creator client](https://github.com/Tombez/official-agar.io-client-by-matheus-valadares/blob/4e25418ae81043f391557422a5ee19f3f0c2e588/2015-05-01/main_out.js), SHA256 `19e61e116c9dab1d215bec86e063349a7424caa4e2369e649f268a7664e044e9`.
Its unchanged bootstrap, binary parser and canvas renderer receive authored packets in a network-free reference harness. These are matched rendering moments, not original-server physics or a live2026 match. The original bundle/quadtree/fonts/skins stay outside shipped game code.

`side-by-side.png` keeps five390×500 pairs at their original pixel dimensions: initial cell, growth, split, top-left map edge and a legal16-character wide name. Additional50/100/150/300/600ms motion pairs show one actual received movement/growth update. `jobs/P05-blob-arena/r1-fidelity.json` binds screenshots, source, harness and SDK hashes to actual rendered matrices and forwarded original body polygons.

## Fixed visible gaps

- Personal camera now follows the mean of all owned pieces, with the original mass/viewport zoom and separate half-gap pan/one-tenth-gap zoom feedback. Actual five motion samples differ by at most0.000650screen pixels and0.000002825zoom.
- Original outline growth has a second feedback stage after120ms logical interpolation. The independently authored bounded circular envelope now differs from the observed original polygon radius by at most0.280screen pixels in these samples; the former error reached17.806pixels. Name sizes match the original22/26/27pixel progression before world projection.
- Every piece carries the complete centered public name at the original size. The long-name pair verifies that legal wide names are retained without shortening or shrinking.
- The personal viewport has a continuous original-spacing grid beyond map bounds, with no added map border or cell clip. Food uses rounded tiny polygons and the original relative outline thickness. The shared TV map outline is party plumbing.

## Ranked remaining limits

1. **Original stochastic outline details.** Original vertex wobble and contact indentation differ from a circular mean envelope. The measured growth-envelope discrepancy is below0.3pixels; that measurement does not establish a global bound for crowded contacts. Outline noise has no role in this port's authoritative collisions. Canvas/SVG edge rasterization also differs at individual pixels.
2. **Font availability.** Both renderers request Ubuntu, with native serif fallback in this font-free environment. The screenshots compare that fallback; they do not prove the appearance of an installed original Ubuntu font. No original font is imported.
3. **Current-original access.** Live agar.io returned CloudFront403; its readable current wrapper delegates rendering to opaque WASM. This historical original reference does not establish exact2026 dynamics or audio. Current publisher mobile images independently corroborate inside names, HUD placement and circular floating controls.

Party plumbing is explicit in the game spec: shared TV overview and shell identity, phone controls, three90-second worlds, mass-at-horn totals, fair same-world returns, protection/split tuning, result summaries and reading holds. HUD and actual controls are checked separately in the mounted-controller captures. No reference skin, logo, sound or other ripped asset is used at runtime.
