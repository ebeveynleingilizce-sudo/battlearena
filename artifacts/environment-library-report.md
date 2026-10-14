# Environment library audit and expanded scene

Five uploaded libraries contain 821 glTF/GLB files (including color/module variants): KayKit Medieval 221; Kenney Fantasy Town 167; Kenney Nature 329; Stylized Nature MegaKit 68; Ultimate Stylized Nature 36. Complete filenames: environment-inventory.json.

Before: 10 environment models, plus 3 Toon Shooter characters. The unused Toon Shooter environment files already present in public are not loaded by the current scene.

Now: 32 distinct environment model files actually referenced and placed, plus the same 3 character models (35 total). KayKit contributes 24, Kenney Nature 7, Fantasy Town 1.

Added 22 models: blue/red homes, wells and flags; tent, barrel, crate, sack; wooden fence; two hills and a grassy mountain; detailed/small shrubs; grass and leafy grass; purple/yellow flowers; stone path and cart. All have explicit placement roles: frontier settlements outside the walls, supply camps, planted forest understory, rocky ridgelines and stone verges linking courtyards to settlements. Repeated planting beds contain offsets, multiple sizes and rotations; no combat RNG is consumed.

Existing camera and gameplay files remain unchanged. The combat corridor remains open. Trees, shrubs, flowers, hills, rocks, paths and static settlement props use shared geometry/material instancing. Castles keep the original base hit/shake contract. Only used files and dependencies were extracted; original ZIPs are ignored by Git.

Unused: alternate team colors and redundant variants; water/bridge/tropical assets without a river or tropical biome; sci-fi props inconsistent with the kingdoms; modular interior/wall pieces requiring a separate building design; textured MegaKit/Ultimate trees and plants whose realism/material style differs from the deliberately consistent KayKit/Kenney low-poly palette. Performance is a secondary reason for avoiding redundant unique resources, not a reason to leave edges empty. No new models were generated.
