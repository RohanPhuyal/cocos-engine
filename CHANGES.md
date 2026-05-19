# CHANGES

## Scope
This document summarizes the Spine 3.x / 4.x integration, preview, PMA, and blend-mode work completed in this thread for Cocos Creator 3.8.8 custom engine.

## Goals From Chat
- Make Spine preview work reliably again for both 3.x and 4.x.
- Keep Spine 3.x and 4.x separated correctly in preview/runtime behavior.
- Port the 2.8 screen-blend + PMA behavior as closely as possible into 3.8.
- Fix blue/dark halo artifacts and incorrect glow blending.
- Ensure mixed Spine 3.x + 4.x can render simultaneously in scene and browser preview.

## High-Level Outcome
- Spine preview flow was repaired (3.x and 4.x).
- PMA auto-decision logic was aligned to 2.8 behavior for screen blend use-cases.
- Deprecated texture PMA APIs were handled safely to avoid preview/drag errors.
- Mixed-runtime rendering conflict (one runtime hiding the other) was fixed.
- Shader-level PMA fallback was added for screen blend to improve visual parity vs 2.8 without destructive texture mutation.
- Native Spine4 setup-pose alignment now matches web/editor anchor-0.5 placement for the mixed 3.x/4.x runtime lane.
- Temporary debug probes used during editor/web/native parity validation were removed after verification.

---

## Commit Timeline (Relevant)
- `70860e9bd3` `spine 4 and 3 simulataneously support`
- `c0954376ea` `preview working`
- `ae421a3825` `fix: spine 4.x preview in inspector`
- `4fa073f2c6` `fix: strict 2.8-style spine screen blend PMA behavior`
- `02998c42d3` `Fix Spine 3.x/4.x native rendering and blend/PMA compatibility`
- `97d744e2a5` `Remove temporary Spine debug tracing logs`
- `0d8f01434b` `docs: add editor/native/simulator build instructions for macOS and Windows`

---

## File Change Summary (Thread)

### 1) `cocos/spine/skeleton-data.ts`
Changes done for runtime/version separation and preview/runtime enum behavior:
- Runtime version detection and Spine major-version routing improvements.
- Runtime enum generation compatibility handling for 3.x vs 4.x data.
- Runtime data selection/caching paths updated for multi-version scenarios.

### 2) `cocos/spine4/skeleton-data.ts`
Mirrored changes for Spine4 data path:
- Runtime version detection and routing (`spine` vs `spine3`) improvements.
- Enum generation compatibility handling.
- Runtime data selection/caching improvements for mixed-version projects.

### 3) `cocos/spine/skeleton.ts`
Major behavior updates:
- PMA + screen-blend support aligned to 2.8 strategy:
  - atlas PMA => force PMA true
  - screen slots => ensure PMA path
  - otherwise PMA false
- Added/updated helper logic around slot blend-mode detection and JSON fallback detection for `screen`.
- Added safe method probing for removed PMA APIs (no direct removed-property calls).
- Added shader-fallback PMA toggle state:
  - `protected _premultiplyTextureInShader = false`
- Material cache key extended with PMA-shader fallback dimension.
- Shader define forwarding:
  - `PREMULTIPLY_TEXTURE` passed in `recompileShaders(...)`
- Preview/runtime stability fixes maintained while switching between Spine3/Spine4 behavior.

### 4) `cocos/spine4/skeleton.ts`
Same class of updates as Spine3 counterpart:
- 2.8-style PMA decision flow for screen blend.
- Slot blend-mode detection + JSON fallback for `screen` slots.
- Safe method probing for removed PMA APIs.
- Added shader-fallback PMA state:
  - `protected _premultiplyTextureInShader = false`
- Material cache key includes PMA-shader fallback dimension.
- Shader define forwarding:
  - `PREMULTIPLY_TEXTURE` passed in `recompileShaders(...)`
- Restored 2.8-style runtime bounds offset application for Spine4 skeleton positioning:
  - apply `offsetX/offsetY` from `skeletonData.x/y/width/height` + node anchor
  - update runtime world transform after offset
- Fixed UITransform fallback anchor typo (`anchorY` was incorrectly assigned to `anchorX`).
- Added robust Spine4 world-transform invocation fallback for editor/WASM bindings where zero-arg
  `updateWorldTransform()` can throw embind argument errors.
- Matched 2.8 Spine4 layout behavior by stopping automatic anchor rewrite from skeleton bounds
  (`skeletonData.x/y`) in Spine4 UITransform sync; now Spine4 keeps the node's anchor and only updates content size.
- Ported 2.8 Spine4 JSON runtime compatibility patch into `spine4/skeleton-data`:
  - normalize Spine 4.x `bone.inherit` / `bone.transform` values to runtime-accepted forms
  - normalize `skeleton.spine` tag to `4.2.00` for non-4.2 exports before Spine4 WASM parse.
- Ported 2.8 Spine4 pose-refresh behavior into `spine4/skeleton`:
  - after `setAnimation`/`setSkin`, force refresh pose (`state.apply`, `skeleton.update(0)`, world transform)
  - use `Physics.reset` in editor non-play preview and `Physics.update` in play/runtime.
- Ported Spine4 JSON compatibility preprocessing into `spine/skeleton-data` path as well, so assets still typed
  as `sp.SkeletonData` but carrying Spine 4.x data get the same runtime normalization before 4.x WASM parse.
- Updated editor atlas parser to accept Spine atlas page `scale` attribute (removes
  `scale is not a valid attribute` inspector errors).
- Fixed Spine inspector preview flow for Spine4 data routed through `sp.Skeleton`:
  - removed preview-path hard block that prevented Spine4 data from being assigned/parsed in preview
  - kept strict editor-node enforcement (`sp4.Skeleton` required) for normal scene nodes.
- Native (JSB) parity fixes for Spine4 rendering path:
  - `platforms/native/engine/jsb-spine4-skeleton.js` now applies the same Spine4 JSON compatibility normalization
    (`bone.inherit`/`bone.transform` + `skeleton.spine -> 4.2.00`) before native init.
  - Supports `sp4.Skeleton` receiving assets typed as `sp.SkeletonData` by forcing Spine4-native init path
    instead of relying on `sp.SkeletonData.init()` (which is Spine3-native).
  - Native `setSkin`/`setAnimation` now force immediate pose/world-transform refresh to align with web fixes.
  - Mirrored immediate refresh behavior in `platforms/native/engine/jsb-spine-skeleton.js` for mixed scenes.

### 5) `cocos/spine/assembler/simple.ts`
Mixed-runtime rendering collision fix:
- Changed static batch buffer registration IDs from shared IDs to Spine3-specific IDs:
  - `SPINE3_BUFFER_ID`
  - `SPINE3_TINT_BUFFER_ID`
- Prevents Spine3 accessor registration from being overridden by Spine4 accessor registration.

### 6) `cocos/spine4/assembler/simple.ts`
Mirror of Spine3 accessor fix:
- Changed static batch buffer registration IDs to Spine4-specific IDs:
  - `SPINE4_BUFFER_ID`
  - `SPINE4_TINT_BUFFER_ID`
- Prevents cross-runtime accessor collision in mixed scenes.

### 7) `editor/assets/effects/for2d/builtin-spine.effect`
New shader-level PMA fallback support:
- Added `PREMULTIPLY_TEXTURE` conditional multiply:
  - TWO_COLORED path: `texColor.rgb *= texColor.a`
  - normal path: `o.rgb *= o.a`
- Used only when runtime sets shader define; non-destructive to original source textures.

### 8) `platforms/native/engine/jsb-spine-skeleton.js`
Native Spine3 JSB updates:
- Added PMA resolution helpers for parity with web path:
  - `readSlotBlendMode(...)`
  - `getRuntimeSlots(...)`
  - `hasScreenBlendMode(...)`
  - `hasAtlasPmaFlag(...)`
  - `hasScreenBlendModeInSkeletonJson(...)`
  - `getMethodIfCallable(...)`
  - `ensureTexturesPremultiplied(...)`
  - `resolvePremultipliedAlpha(...)`
- Updated `_updateSkeletonData()` PMA decision path to avoid forcing incorrect PMA.

### 9) `platforms/native/engine/jsb-spine4-skeleton.js` and `platforms/native/engine/index.js`
Native Spine4 JSB lane integration and fixes:
- Added and wired dedicated Spine4 JSB adapter module.
- Fixed native init/retain/update flow to avoid null-path crashes.
- Added robust blend-mode handling guard where `spine.BlendMode` may be unavailable.
- Applied PMA decision behavior matching web logic (only promote to PMA when data/textures support it).
- Removed temporary debugging trace logs after validation.

### 10) Native C++ / Build Integration (Spine4 lane)
Key files:
- `native/CMakeLists.txt`
- `native/cocos/bindings/manual/jsb_module_register.cpp`
- `native/cocos/bindings/manual/jsb_spine4_manual.cpp`
- `native/tools/swig-config/spine4.i`
- `native/cocos/editor-support/spine4/*`
- `native/cocos/editor-support/spine4-creator-support/*`
- `native/tools/simulator/frameworks/runtime-src/CMakeLists.txt`
- `native/gulpfile.js`

Summary:
- Added/updated duplicated Spine4 native runtime lane and bindings generation/build integration.
- Hooked simulator build options for dual runtime (3.8 + 4.2 lane via `spine4` namespace).
- Kept Windows simulator wiring intact (`proj.win32`, `SimulatorApp-Win32`, Windows-specific CMake branches).

---

## New / Updated Functions and State (Key)

### In `cocos/spine/skeleton.ts` and `cocos/spine4/skeleton.ts`
- `hasScreenBlendModeInSkeletonJson(...)`
- `getMethodIfCallable(...)`
- `ensureTexturesPremultiplied(..., useShaderFallback?)` (updated)
- `resolvePremultipliedAlpha(..., useShaderFallback?)` (updated)
- `protected _premultiplyTextureInShader` (new state)
- Updated `getMaterialForBlendAndTint(...)` cache key and shader define payload.

### In `cocos/spine/skeleton.ts`
- Existing runtime-switch/promotion logic preserved and integrated with PMA path.

### In assemblers
- New constants:
  - Spine3: `SPINE3_BUFFER_ID`, `SPINE3_TINT_BUFFER_ID`
  - Spine4: `SPINE4_BUFFER_ID`, `SPINE4_TINT_BUFFER_ID`

---

## Bugs Fixed (From Chat)
- Spine preview values missing / preview broken for 3.x/4.x.
- Null errors from preview property application (premultiplied/debug/tint paths).
- Deprecated PMA API access errors:
  - `TextureBase.prototype.hasPremultipliedAlpha has been removed`
  - `TextureBase.prototype.setPremultiplyAlpha has been removed`
- Mixed Spine3 + Spine4 rendering where one disappears.
- PMA/screen blend mismatch and glow artifacts reduced via shader fallback alignment.
- Spine4 runtime node/content alignment issues where assets appeared visually offset from expected node position.
- Spine4 editor error: `Skeleton.updateWorldTransform called with invalid number of arguments (0)` during preload/drag.
- Spine4 render placement mismatch caused by forced anchor mutation in 3.8 Spine4 UITransform update path.
- Spine4 bone deformation/detached parts caused by JSON compatibility mismatch with 4.2 runtime parser.
- Spine4 preview/runtime bone drift/deformation caused by missing immediate pose refresh and wrong physics mode during world-transform update.
- Spine4 assets loaded as `sp.SkeletonData` bypassed Spine4-specific JSON compatibility preprocessing.
- Spine4 asset inspector preview stuck with empty/old skin-animation state because preview path aborted in `sp.Skeleton`.
- Native Spine4 deformation in mixed `sp.SkeletonData` + `sp4.Skeleton` setups due to missing Spine4-native
  data normalization/initialization and missing immediate pose refresh after skin/animation switches.

---

## Build / Validation Notes
- Rebuilt repeatedly with:
  - `NODE_OPTIONS=--max-old-space-size=8192 npm run build:dev`
- Build succeeded after latest changes.
- Runtime validations performed through user reports on:
  - Scene view
  - Browser preview (`http://localhost:7456/`)

## Build Guide (Editor + Native + Simulator)

### Windows Simulator Build Verification (Current Branch)
- No additional source changes are required specifically for Windows simulator build.
- Dual runtime flags are wired in simulator CMake:
  - `USE_SPINE_DUAL_RUNTIME=ON`
  - `USE_SPINE_3_8=ON`
  - `USE_SPINE4=ON`
- Windows simulator target and sources are present:
  - `SimulatorApp-Win32`
  - `proj.win32/*`
- Existing Windows-specific caveat still applies:
  - CMake pre-build uses `create_symlink` for `jsb-adapter/res/src`.
  - On Windows, enable Developer Mode or run with elevated privileges if symlink creation fails.

### 1) Build Engine JS/Editor Runtime (macOS + Windows)

From repo root:

```bash
npm install
npm run build
```

For larger dev builds:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run build:dev
```

### 2) Build Native Engine Library Only (macOS)

From repo root:

```bash
cmake -S native -B native/build-mac -G Xcode -DUSE_SPINE=ON -DUSE_SPINE_DUAL_RUNTIME=ON -DUSE_SPINE_3_8=ON -DUSE_SPINE_4_2=OFF -DUSE_SPINE4=ON
cmake --build native/build-mac --config Release --target cocos_engine
```

### 3) Build Native Engine Library Only (Windows)

From repo root:

```powershell
cmake -S native -B native/build-win64 -G "Visual Studio 17 2022" -A x64 -DUSE_SPINE=ON -DUSE_SPINE_DUAL_RUNTIME=ON -DUSE_SPINE_3_8=ON -DUSE_SPINE_4_2=OFF -DUSE_SPINE4=ON
cmake --build native/build-win64 --config Release --target cocos_engine
```

### 4) Build Simulator (macOS)

From `native/`:

```bash
npm install
npx gulp gen-simulator-release
```

Generated app:

```bash
native/simulator/Release/SimulatorApp-Mac.app
```

Optional architecture override:

```bash
ARCH=arm64 npx gulp gen-simulator-release
```

### 5) Build Simulator (Windows)

From `native/`:

```powershell
npm install
npx gulp gen-simulator-release
```

Generated executable:

```powershell
native/simulator/Release/SimulatorApp-Win32.exe
```

Optional runtime selection:

```powershell
$env:SPINE_VERSION="both"; npx gulp gen-simulator-release
```

---

## Chat Summary (Concise)
- We iterated through preview crashes and missing animation/skin enum issues, then separated runtime handling for Spine3 and Spine4.
- After preview recovery, we ported the 2.8 PMA/screen blend behavior to 3.8, then adjusted for 3.8 API removals.
- We fixed mixed-runtime rendering conflict by splitting static buffer accessor IDs.
- Finally, we introduced shader-time PMA fallback to better match 2.8 blending appearance while keeping source textures untouched.

---

## Post-Validation Native iOS Follow-Up (2026-05-18)

After the initial dual-runtime merge, native iOS device build (Xcode -> iPhone SE 3rd gen) still failed at runtime with:
- `[spine] Failed to create runtime skeleton instance: SkeletonInstance constructor is unavailable.`
- `TypeError: Cannot read properties of null (reading 'setSkin')`

### Root Cause
- JSB Spine patching could run before runtime classes were registered on device startup and stop retrying too early.
- Spine4 internals were still exported under generic `legacyCC.internal.Spine*` keys in a few places, allowing cross-runtime override/collision.

### Fixes Applied
- `platforms/native/engine/jsb-spine-skeleton.js`
  - Bind patched prototype explicitly via `getClassByName('sp.Skeleton')`.
  - Keep retrying with frame-delay (`setTimeout(..., 16)`) until `sp.Skeleton` and required globals are ready.
- `platforms/native/engine/jsb-spine4-skeleton.js`
  - Keep retrying until `sp4.Skeleton` and required globals are ready.
  - Prefer `cc.internal.Spine4Assembler` (fallback to `SpineAssembler` only if missing).
- `cocos/spine4/skeleton.ts`
  - Export to `legacyCC.internal.Spine4Skeleton` (instead of generic `SpineSkeleton`).
- `cocos/spine4/skeleton-system.ts`
  - Export to `legacyCC.internal.Spine4SkeletonSystem`.
- `cocos/spine4/assembler/simple.ts`
  - Export to `legacyCC.internal.Spine4Assembler`.

### Outcome
- Native iOS device render path recovers and scene renders normally.
- Runtime split remains strict:
  - Spine 3.x -> `sp.Skeleton`
  - Spine 4.x -> `sp4.Skeleton`
- JSB patch no longer binds to the wrong lane due to internal namespace collisions.
