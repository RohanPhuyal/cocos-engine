<p align="center">
    <a href="https://www.cocos.com/">
        <img src="https://user-images.githubusercontent.com/1503156/50446380-ad88c980-094f-11e9-8eff-0094bde708d0.png">
    </a>
</p>
<p align="center">
    <a href="https://github.com/cocos-creator/engine/stargazers">
        <img src="https://img.shields.io/github/stars/cocos-creator/engine.svg?style=flat-square&colorB=4183c4"
             alt="stars">
    </a>
    <a href="https://github.com/cocos-creator/engine/network">
        <img src="https://img.shields.io/github/forks/cocos-creator/engine.svg?style=flat-square&colorB=4183c4"
             alt="forks">
    </a>
    <a href="https://github.com/cocos-creator/engine/releases">
        <img src="https://img.shields.io/github/tag/cocos-creator/engine.svg?label=version&style=flat-square&colorB=4183c4"
             alt="version">
    </a>
    <a href="./licenses/LICENSE">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square&colorB=4183c4"
             alt="license">
    </a>
    <a href="https://twitter.com/cocos2dx">
        <img src="https://img.shields.io/twitter/follow/cocos2dx.svg?logo=twitter&label=follow&style=flat-square&colorB=4183c4"
             alt="twitter">
    </a>
    <a href="https://gitpod.io/from-referrer/">
        <img src="https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod" alt="Gitpod Ready-to-Code" />
    </a>
</p>

# Cocos Creator

![2.2.0 Main Window](https://user-images.githubusercontent.com/1503156/67261891-3cfdfb00-f4d5-11e9-9b2d-15ff2cb015f4.png)

Cocos Creator is a complete package of game development tools and workflow, including a game engine, resource management, scene editing, game preview, debug and publish one project to multiple platforms. Cocos Creator focused on content creation, which has realized features like thorough scriptability, componentization and data driven, etc. on the basis of Cocos2d-x. With JavaScript, you can scripting your component in no time. The editor and engine extension is also made with JavaScript so you can make games and refine your tool in a single programming language. Cocos Creator is an provides an innovative, easy to use toolset such as the UI system and Animation editor. The toolset will be expanding continuously and quickly, thanks to the open editor extension system.

This repo is the engine framework for Cocos Creator. Cocos Creator's in-editor scene view and web runtime share the same framework, which is the content of this repo. It's originally forked from [Cocos2d-html5](https://github.com/cocos2d/cocos2d-html5/), we build up an Entity Component architecture on it to meet the needs of Cocos Creator.

This framework is a cross-platform game engine written in JavaScript and licensed under MIT. It supports major desktop and mobile browsers, it's also compatible with [Cocos2d Javascript Binding engine](https://github.com/cocos-creator/cocos2d-x-lite) to support native platforms like iOS, Android, Win32, macOS.

The framework is naturally integrated with Cocos Creator, so it's not designed to be used independently.

## Developer

### Prerequisite

- Install [node.js v8.0.0+](https://nodejs.org/)
- Install [gulp-cli v3.9.0+](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md)

### Install

In cloned project folder, run the following command to setup dev environment:

```bash
# Initialize gulp task dependencies
# npm is a builtin CLI when you install Node.js
npm install
```

This is all you have to do to set engine development environment.

### Build

```bash
gulp build
```

If the compilation process encounters a "JavaScript heap out memory" warning, you can use the following command line

```bash
gulp build --max-old-space-size=8192
```

### Test

#### Prerequisite

- Install [express](http://expressjs.com/): `npm install express`.
- Install gulp-qunit: `npm install gulp-qunit`.

#### Unit Test

- Test in CLI

  ```bash
  npm test
  ```

- Test in browser

  1. Build for testing.

      ```bash
      gulp build-test
      ```

  2. Start express in cloned project folder.

      ```bash
      node test/qunit/server.js
      ```

  3. Open [http://localhost:8511/bin/qunit-runner.html](http://localhost:8511/bin/qunit-runner.html) in your browser.

### Online one-click Setup

You can use Gitpod(an online IDE which is free for Open Source) for developing the project online. With a single click it will launch a workspace and automatically:

- clone the `Cocos Creator` repo.
- install all the dependencies mentioned above.
- run `gulp build`, `npm test` in separate terminals.
- start the express server and open [http://localhost:8511/bin/qunit-runner.html](http://localhost:8511/bin/qunit-runner.html) in the right corner of the IDE.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/from-referrer/)

### DebugInfos

View [EngineErrorMap.md](https://github.com/cocos-creator/engine/blob/master/EngineErrorMap.md)
All the debug infos are defined in file EngineErrorMap.md.

## Spine4 API Reference (sp4.Skeleton)

Use this when working with Spine4 runtime in scripts.

```js
const spineComp = this.node.getComponent('sp4.Skeleton');
```

### 1) Skin APIs

#### `setSkin(skinName: string | string[])`
- Set a single skin by name.
- If an array is passed, it forwards to `setSkins([...])`.

```js
spineComp.setSkin('suite/normal');
```

#### `setSkins(skinNames: string[])`
- Compose multiple skins into one runtime skin.
- Max supported active skins is **4**.
- Returns the list of actually applied skins.

```js
const applied = spineComp.setSkins([
    'suite/normal',
    'suite/pirate_hat',
    'suite/accessory_glasses',
]);
```

#### `getActiveSkins(): string[]`
- Returns deduplicated active skin names currently used by composite mode.

```js
const activeSkins = spineComp.getActiveSkins();
```

### 2) Animation Control APIs

#### `setAnimation(trackIndex, name, loop)`
- Set current animation on track.
- In realtime mode returns `TrackEntry`.

```js
const entry = spineComp.setAnimation(0, 'idle_stage1', true);
```

#### `addAnimation(trackIndex, name, loop, delay = 0)`
- Queue animation after current/queued animations.
- In realtime mode returns `TrackEntry`.

```js
spineComp.addAnimation(0, 'wave', false, 0);
```

#### `setMix(fromAnimation, toAnimation, duration)`
- Set cross-fade duration between two animations.

```js
spineComp.setMix('idle_stage1', 'run', 0.2);
```

#### `findAnimation(name)`
- Lookup animation object by name.

```js
const anim = spineComp.findAnimation('run');
```

#### `getCurrent(trackIndex)`
- Get current `TrackEntry` for track.

```js
const current = spineComp.getCurrent(0);
```

#### `clearTrack(trackIndex)` / `clearTracks()`
- Clear one track or all tracks.

```js
spineComp.clearTrack(0);
spineComp.clearTracks();
```

### 3) Listener APIs (Spine3-style)

Yes, Spine4 has the same listener style as Spine3.

#### Global listeners
- `setStartListener(listener)`
- `setInterruptListener(listener)`
- `setEndListener(listener)`
- `setDisposeListener(listener)`
- `setCompleteListener(listener)`
- `setEventListener(listener)`

```js
spineComp.setCompleteListener((entry) => {
    cc.log('complete:', entry && entry.animation && entry.animation.name);
});

spineComp.setEventListener((entry, event) => {
    cc.log('event:', event && event.data && event.data.name);
});
```

#### Per-track-entry listeners
- `setTrackStartListener(entry, listener)`
- `setTrackInterruptListener(entry, listener)`
- `setTrackEndListener(entry, listener)`
- `setTrackDisposeListener(entry, listener)`
- `setTrackCompleteListener(entry, listener)`
- `setTrackEventListener(entry, listener)`

```js
const entry = spineComp.setAnimation(0, 'attack', false);
if (entry) {
    spineComp.setTrackCompleteListener(entry, (trackEntry, loopCount) => {
        cc.log('track complete:', loopCount);
    });
}
```

### 4) Bone / Slot / Attachment APIs

#### `findBone(boneName)`
- Get bone by name.

```js
const headBone = spineComp.findBone('head');
```

#### `findSlot(slotName)`
- Get slot by name.

```js
const handSlot = spineComp.findSlot('hand_r_palm');
```

#### `getAttachment(slotName, attachmentName)`
- Get attachment from active skin/default skin.

```js
const att = spineComp.getAttachment('hand_r_palm', 'hand_r_palm');
```

#### `setAttachment(slotName, attachmentName)`
- Set slot attachment by name.

```js
spineComp.setAttachment('hand_r_palm', 'hand_r_palm');
```

### 5) Pose / Transform APIs

#### `setToSetupPose()`
- Reset bones + slots to setup pose.

#### `setBonesToSetupPose()`
- Reset only bones.

#### `setSlotsToSetupPose()`
- Reset only slots.

#### `updateWorldTransform()`
- Force world transform update.

```js
spineComp.setToSetupPose();
spineComp.updateWorldTransform();
```

### 6) Cache Mode APIs

#### `setAnimationCacheMode(mode)`
- Set cache mode via `sp4.Skeleton.AnimationCacheMode`.

```js
spineComp.setAnimationCacheMode(sp4.Skeleton.AnimationCacheMode.REALTIME);
// or SHARED_CACHE / PRIVATE_CACHE
```

#### `isAnimationCached()`
- Returns whether current runtime is in cached animation mode.

#### `updateAnimationCache(animName)`
- Rebuild cache for one animation.

#### `invalidAnimationCache()`
- Mark cache invalid and rebuild on demand.

```js
if (spineComp.isAnimationCached()) {
    spineComp.invalidAnimationCache();
}
```

### 7) Advanced Runtime APIs

#### `setAnimationStateData(stateData)`
- Replace `AnimationState` source data.

#### `setSlotsRange(startSlotIndex, endSlotIndex)`
- Render only slots in a range (realtime mode only).

#### `setVertexEffectDelegate(effectDelegate)`
- Apply Spine vertex effects.

#### `getState()`
- Access underlying `sp4.spine.AnimationState`.

```js
const state = spineComp.getState();
```

### Inspector Notes

- Use `Default Skin` for normal single-skin setup.
- Enable `Have Multiple Skins` to compose skins.
- `No. of Active Skins` is clamped to **1 ~ 4**.
- `Active Skin 1..4` are the selectable composite skin slots.

### Realtime vs Cached Mode (Important)

- **Realtime mode**: full Spine state + `TrackEntry` workflow.
- **Cached mode**: optimized playback path; `setAnimation`/`addAnimation` do not return normal realtime `TrackEntry` objects, so per-entry listener workflow is limited.
- If you need exact Spine3-style per-track control/listeners, use **Realtime mode**.
The file DebugInfos.json will be generated based on EngineErrorMap.md, when run `gulp build` command.

For details below:

1. Define log in EngineErrorMap.md

    example:

    ```
    ### 1001

    cocos2d: removeAction: Target not found
    ```

2. Define deprecated log in EngineErrorMap.md
   The log should be marked as DEPRECATED when then logId is no longer referenced in the project.

    example:

    ```
    ### 1000

    <!-- DEPRECATED -->
    cc.ActionManager.addAction(): action must be non-null
    ```

## Useful links

* [Official site](https://www.cocos.com/products#CocosCreator)
* [Download](https://www.cocos.com/creator)
* [Documentation](https://docs.cocos.com/creator/manual/)
* [API References](https://docs.cocos.com/creator/api/)
* [Forum](https://discuss.cocos2d-x.org/c/creator)
