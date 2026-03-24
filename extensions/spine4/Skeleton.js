/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const TrackEntryListeners = require('./track-entry-listeners');
const RenderComponent = require('../../cocos2d/core/components/CCRenderComponent');
const spine = require('./lib/spine4');
const Graphics = require('../../cocos2d/core/graphics/graphics');
const RenderFlow = require('../../cocos2d/core/renderer/render-flow');
const FLAG_POST_RENDER = RenderFlow.FLAG_POST_RENDER;
var _global = typeof window === 'undefined' ? global : window;
_global.__sp4DebugFlags = _global.__sp4DebugFlags || {};

let SkeletonCache = require('./skeleton-cache');
let AttachUtil = require('./AttachUtil');

/**
 * @module sp
 */
let DefaultSkinsEnum = cc.Enum({ 'default': -1 });
let OptionalSkinsEnum = cc.Enum({ '<None>': 0 });
let DefaultAnimsEnum = cc.Enum({ '<None>': 0 });

/**
 * !#en Enum for animation cache mode type.
 * !#zh Spine动画缓存类型
 * @enum Skeleton.AnimationCacheMode
 */
let AnimationCacheMode = cc.Enum({
    /**
     * !#en The realtime mode.
     * !#zh 实时计算模式。
     * @property {Number} REALTIME
     */
    REALTIME: 0,
    /**
     * !#en The shared cache mode.
     * !#zh 共享缓存模式。
     * @property {Number} SHARED_CACHE
     */
    SHARED_CACHE: 1,
    /**
     * !#en The private cache mode.
     * !#zh 私有缓存模式。
     * @property {Number} PRIVATE_CACHE
     */
    PRIVATE_CACHE: 2
});

function setEnumAttr(obj, propName, enumDef) {
    cc.Class.Attr.setClassAttr(obj, propName, 'type', 'Enum');
    cc.Class.Attr.setClassAttr(obj, propName, 'enumList', cc.Enum.getList(enumDef));
}

/**
 * !#en
 * The skeleton of Spine <br/>
 * <br/>
 * (Skeleton has a reference to a SkeletonData and stores the state for skeleton instance,
 * which consists of the current pose's bone SRT, slot colors, and which slot attachments are visible. <br/>
 * Multiple skeletons can use the same SkeletonData which includes all animations, skins, and attachments.) <br/>
 * !#zh
 * Spine 骨骼动画 <br/>
 * <br/>
 * (Skeleton 具有对骨骼数据的引用并且存储了骨骼实例的状态，
 * 它由当前的骨骼动作，slot 颜色，和可见的 slot attachments 组成。<br/>
 * 多个 Skeleton 可以使用相同的骨骼数据，其中包括所有的动画，皮肤和 attachments。
 *
 * @class Skeleton
 * @extends RenderComponent
 */
sp4.Skeleton = cc.Class({
    name: 'sp4.Skeleton',
    extends: RenderComponent,
    editor: CC_EDITOR && {
        menu: 'i18n:MAIN_MENU.component.renderers/Spine4 Skeleton',
        help: 'app://docs/html/components/spine.html',
        inspector: 'packages://inspector/inspectors/comps/skeleton2d.js',
    },

    statics: {
        AnimationCacheMode: AnimationCacheMode,
    },

    properties: {
        /**
         * !#en The skeletal animation is paused?
         * !#zh 该骨骼动画是否暂停。
         * @property paused
         * @type {Boolean}
         * @readOnly
         * @default false
         */
        paused: {
            default: false,
            visible: false
        },

        /**
         * !#en
         * The skeleton data contains the skeleton information (bind pose bones, slots, draw order,
         * attachments, skins, etc) and animations but does not hold any state.<br/>
         * Multiple skeletons can share the same skeleton data.
         * !#zh
         * 骨骼数据包含了骨骼信息（绑定骨骼动作，slots，渲染顺序，
         * attachments，皮肤等等）和动画但不持有任何状态。<br/>
         * 多个 Skeleton 可以共用相同的骨骼数据。
         * @property {sp4.SkeletonData} skeletonData
         */
        skeletonData: {
            default: null,
            type: cc.Asset,
            notify() {
                this.defaultSkin = '';
                this.defaultAnimation = '';
                if (CC_EDITOR) {
                    this._refreshInspector();
                }
                this._updateSkeletonData();
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.skeleton_data'
        },

        // 由于 spine 的 skin 是无法二次替换的，所以只能设置默认的 skin
        /**
         * !#en The name of default skin.
         * !#zh 默认的皮肤名称。
         * @property {String} defaultSkin
         */
        defaultSkin: {
            default: '',
            visible: false
        },

        /**
         * !#en The name of default animation.
         * !#zh 默认的动画名称。
         * @property {String} defaultAnimation
         */
        defaultAnimation: {
            default: '',
            visible: false
        },

        /**
         * !#en The name of current playing animation.
         * !#zh 当前播放的动画名称。
         * @property {String} animation
         */
        animation: {
            get() {
                if (this.isAnimationCached()) {
                    return this._animationName;
                } else {
                    var entry = this.getCurrent(0);
                    return (entry && entry.animation.name) || "";
                }
            },
            set(value) {
                this.defaultAnimation = value;
                if (value) {
                    this.setAnimation(0, value, this.loop);
                }
                else if (!this.isAnimationCached()) {
                    this.clearTrack(0);
                    this.setToSetupPose();
                }
            },
            visible: false
        },

        /**
         * @property {Number} _defaultSkinIndex
         */
        _defaultSkinIndex: {
            get() {
                if (this.skeletonData) {
                    var skinsEnum = this.skeletonData.getSkinsEnum();
                    if (skinsEnum) {
                        if (this.defaultSkin === "") {
                            if (skinsEnum.hasOwnProperty(0)) {
                                this._defaultSkinIndex = 0;
                                return 0;
                            }
                        } else {
                            var skinIndex = skinsEnum[this.defaultSkin];
                            if (skinIndex !== undefined) {
                                return skinIndex;
                            }
                        }
                    }
                }
                return 0;
            },
            set(value) {
                var skinsEnum;
                if (this.skeletonData) {
                    skinsEnum = this.skeletonData.getSkinsEnum();
                }
                if (!skinsEnum) {
                    return cc.errorID('',
                        this.name);
                }
                var skinName = skinsEnum[value];
                if (skinName !== undefined) {
                    this.defaultSkin = skinName;
                    if (!this.enableMultipleSkins) {
                        this._applyConfiguredSkins();
                    }
                    if (CC_EDITOR && !cc.engine.isPlaying) {
                        this._refreshInspector();
                    }
                }
                else {
                    cc.errorID(7501, this.name);
                }
            },
            type: DefaultSkinsEnum,
            visible: true,
            animatable: false,
            displayName: "Default Skin",
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.default_skin'
        },

        enableMultipleSkins: {
            default: false,
            notify() {
                this._applyConfiguredSkins();
                if (CC_EDITOR) {
                    this._refreshInspector();
                }
            },
            displayName: 'Have Multiple Skins',
            tooltip: 'Enable a composite Spine skin using multiple active skins at once.'
        },

        activeSkinsCount: {
            default: 2,
            type: cc.Integer,
            notify() {
                let maxSkins = Math.min(4, this._getAvailableSkinCount());
                this.activeSkinsCount = Math.max(1, Math.min(maxSkins, this.activeSkinsCount | 0));
                this._resizeActiveSkins();
                if (this.enableMultipleSkins) {
                    this._applyConfiguredSkins();
                }
                if (CC_EDITOR) {
                    this._refreshInspector();
                }
            },
            visible() {
                return this.enableMultipleSkins;
            },
            displayName: 'No. of Active Skins',
            tooltip: 'How many skin pickers are active for the composite skin.'
        },

        activeSkins: {
            default: function () {
                return [];
            },
            type: [cc.String],
            notify() {
                let maxSkins = Math.min(4, this._getAvailableSkinCount());
                let normalizedSkins = this._normalizeActiveSkins(this.activeSkins, maxSkins, true);
                let hasChanges = normalizedSkins.length !== this.activeSkins.length;
                if (!hasChanges) {
                    for (let i = 0; i < normalizedSkins.length; i++) {
                        if (normalizedSkins[i] !== this.activeSkins[i]) {
                            hasChanges = true;
                            break;
                        }
                    }
                }
                if (hasChanges) {
                    this.activeSkins = normalizedSkins;
                    return;
                }
                if (this.enableMultipleSkins) {
                    this._applyConfiguredSkins();
                }
            },
            visible() {
                return false;
            },
            tooltip: 'Skin names to merge when multiple skins are enabled. Supports up to 4 skins.'
        },

        _activeSkinIndex0: {
            get() {
                return this._getActiveSkinEnumValue(0);
            },
            set(value) {
                this._setActiveSkinEnumValue(0, value);
            },
            type: OptionalSkinsEnum,
            visible() {
                return this.enableMultipleSkins && this.activeSkinsCount >= 1;
            },
            animatable: false,
            displayName: 'Active Skin 1'
        },

        _activeSkinIndex1: {
            get() {
                return this._getActiveSkinEnumValue(1);
            },
            set(value) {
                this._setActiveSkinEnumValue(1, value);
            },
            type: OptionalSkinsEnum,
            visible() {
                return this.enableMultipleSkins && this.activeSkinsCount >= 2;
            },
            animatable: false,
            displayName: 'Active Skin 2'
        },

        _activeSkinIndex2: {
            get() {
                return this._getActiveSkinEnumValue(2);
            },
            set(value) {
                this._setActiveSkinEnumValue(2, value);
            },
            type: OptionalSkinsEnum,
            visible() {
                return this.enableMultipleSkins && this.activeSkinsCount >= 3;
            },
            animatable: false,
            displayName: 'Active Skin 3'
        },

        _activeSkinIndex3: {
            get() {
                return this._getActiveSkinEnumValue(3);
            },
            set(value) {
                this._setActiveSkinEnumValue(3, value);
            },
            type: OptionalSkinsEnum,
            visible() {
                return this.enableMultipleSkins && this.activeSkinsCount >= 4;
            },
            animatable: false,
            displayName: 'Active Skin 4'
        },

        // value of 0 represents no animation
        _animationIndex: {
            get() {
                var animationName = (!CC_EDITOR || cc.engine.isPlaying) ? this.animation : this.defaultAnimation;
                if (this.skeletonData && animationName) {
                    var animsEnum = this.skeletonData.getAnimsEnum();
                    if (animsEnum) {
                        var animIndex = animsEnum[animationName];
                        if (animIndex !== undefined) {
                            return animIndex;
                        }
                    }
                }
                return 0;
            },
            set(value) {
                if (value === 0) {
                    this.animation = '';
                    return;
                }
                var animsEnum;
                if (this.skeletonData) {
                    animsEnum = this.skeletonData.getAnimsEnum();
                }
                if (!animsEnum) {
                    return cc.errorID(7502, this.name);
                }
                var animName = animsEnum[value];
                if (animName !== undefined) {
                    this.animation = animName;
                }
                else {
                    cc.errorID(7503, this.name);
                }

            },
            type: DefaultAnimsEnum,
            visible: true,
            animatable: false,
            displayName: 'Animation',
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.animation'
        },

        // Record pre cache mode.
        _preCacheMode: -1,
        _cacheMode: AnimationCacheMode.REALTIME,
        _defaultCacheMode: {
            default: 0,
            type: AnimationCacheMode,
            notify() {
                this.setAnimationCacheMode(this._defaultCacheMode);
            },
            editorOnly: true,
            visible: true,
            animatable: false,
            displayName: "Animation Cache Mode",
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.animation_cache_mode'
        },

        /**
         * !#en TODO
         * !#zh 是否循环播放当前骨骼动画。
         * @property {Boolean} loop
         * @default true
         */
        loop: {
            default: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.loop'
        },

        /**
         * !#en Indicates whether to enable premultiplied alpha.
         * You should disable this option when image's transparent area appears to have opaque pixels,
         * or enable this option when image's half transparent area appears to be darken.
         * !#zh 是否启用贴图预乘。
         * 当图片的透明区域出现色块时需要关闭该选项，当图片的半透明区域颜色变黑时需要启用该选项。
         * @property {Boolean} premultipliedAlpha
         * @default true
         */
        premultipliedAlpha: {
            default: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.premultipliedAlpha'
        },

        /**
         * !#en The time scale of this skeleton.
         * !#zh 当前骨骼中所有动画的时间缩放率。
         * @property {Number} timeScale
         * @default 1
         */
        timeScale: {
            default: 1,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.time_scale'
        },

        /**
         * !#en Indicates whether open debug slots.
         * !#zh 是否显示 slot 的 debug 信息。
         * @property {Boolean} debugSlots
         * @default false
         */
        debugSlots: {
            default: false,
            editorOnly: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.debug_slots',
            notify() {
                this._updateDebugDraw();
            }
        },

        /**
         * !#en Indicates whether open debug bones.
         * !#zh 是否显示 bone 的 debug 信息。
         * @property {Boolean} debugBones
         * @default false
         */
        debugBones: {
            default: false,
            editorOnly: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.debug_bones',
            notify() {
                this._updateDebugDraw();
            }
        },

        /**
         * !#en Indicates whether open debug mesh.
         * !#zh 是否显示 mesh 的 debug 信息。
         * @property {Boolean} debugMesh
         * @default false
         */
        debugMesh: {
            default: false,
            editorOnly: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.debug_mesh',
            notify() {
                this._updateDebugDraw();
            }
        },

        /**
         * !#en Indicates whether open debug mesh hull (outer boundary of mesh attachments).
         * !#zh 是否显示 mesh 的外轮廓 debug 信息。
         * @property {Boolean} debugMeshHull
         * @default false
         */
        debugMeshHull: {
            default: false,
            editorOnly: true,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.debug_mesh_hull',
            notify() {
                this._updateDebugDraw();
            }
        },

        /**
         * !#en Enabled two color tint.
         * !#zh 是否启用染色效果。
         * @property {Boolean} useTint
         * @default false
         */
        useTint: {
            default: false,
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.use_tint',
            notify() {
                this._updateUseTint();
            }
        },

        /**
         * !#en Enabled batch model, if skeleton is complex, do not enable batch, or will lower performance.
         * !#zh 开启合批，如果渲染大量相同纹理，且结构简单的骨骼动画，开启合批可以降低drawcall，否则请不要开启，cpu消耗会上升。
         * @property {Boolean} enableBatch
         * @default false
         */
        enableBatch: {
            default: false,
            notify() {
                this._updateBatch();
            },
            tooltip: CC_DEV && 'i18n:COMPONENT.skeleton.enabled_batch'
        },

        // Below properties will effect when cache mode is SHARED_CACHE or PRIVATE_CACHE.
        // accumulate time
        _accTime: 0,
        // Play times counter
        _playCount: 0,
        // Frame cache
        _frameCache: null,
        // Cur frame
        _curFrame: null,
        // Skeleton cache
        _skeletonCache: null,
        // Aimation name
        _animationName: "",
        // Animation queue
        _animationQueue: [],
        // Head animation info of 
        _headAniInfo: null,
        // Play times
        _playTimes: 0,
        // Is animation complete.
        _isAniComplete: true,
    },

    // CONSTRUCTOR
    ctor() {
        this._effectDelegate = null;
        this._skeleton = null;
        this._rootBone = null;
        this._listener = null;
        this._materialCache = {};
        this._debugRenderer = null;
        this._startSlotIndex = -1;
        this._endSlotIndex = -1;
        this._startEntry = { animation: { name: "" }, trackIndex: 0 };
        this._endEntry = { animation: { name: "" }, trackIndex: 0 };
        this.attachUtil = new AttachUtil();
    },

    // override base class _getDefaultMaterial to modify default material
    _getDefaultMaterial() {
        return cc.Material.getBuiltinMaterial('2d-spine');
    },

    // override base class _updateMaterial to set define value and clear material cache
    _updateMaterial() {
        let useTint = this.useTint || (this.isAnimationCached() && !CC_NATIVERENDERER);
        let baseMaterial = this.getMaterial(0);
        if (baseMaterial) {
            baseMaterial.define('USE_TINT', useTint);
            baseMaterial.define('CC_USE_MODEL', !this.enableBatch);

            let srcBlendFactor = this.premultipliedAlpha ? cc.gfx.BLEND_ONE : cc.gfx.BLEND_SRC_ALPHA;
            let dstBlendFactor = cc.gfx.BLEND_ONE_MINUS_SRC_ALPHA;

            baseMaterial.setBlend(
                true,
                cc.gfx.BLEND_FUNC_ADD,
                srcBlendFactor, srcBlendFactor,
                cc.gfx.BLEND_FUNC_ADD,
                dstBlendFactor, dstBlendFactor
            );
        }
        this._materialCache = {};
    },

    // override base class disableRender to clear post render flag
    disableRender() {
        this._super();
        this.node._renderFlag &= ~FLAG_POST_RENDER;
    },

    // override base class disableRender to add post render flag
    markForRender(enable) {
        this._super(enable);
        if (enable) {
            this.node._renderFlag |= FLAG_POST_RENDER;
        } else {
            this.node._renderFlag &= ~FLAG_POST_RENDER;
        }
    },

    // if change use tint mode, just clear material cache
    _updateUseTint() {
        let baseMaterial = this.getMaterial(0);
        if (baseMaterial) {
            let useTint = this.useTint || (this.isAnimationCached() && !CC_NATIVERENDERER);
            baseMaterial.define('USE_TINT', useTint);
        }
        this._materialCache = {};
    },

    // if change use batch mode, just clear material cache
    _updateBatch() {
        let baseMaterial = this.getMaterial(0);
        if (baseMaterial) {
            baseMaterial.define('CC_USE_MODEL', !this.enableBatch);
        }
        this._materialCache = {};
    },

    _validateRender() {
        let skeletonData = this.skeletonData;
        if (!skeletonData) {
            this.disableRender();
            return;
        }
        if (!skeletonData.isTexturesLoaded()) {
            // On JSB, cc.Texture2D.loaded is often false even when the native
            // texture is fully usable (the asset loader sets the JS flag differently).
            // If the skeleton has already been parsed successfully (_skeletonCache set),
            // the textures were accessible at parse time, so trust them and proceed.
            if (CC_JSB && skeletonData._skeletonCache) {
                if (!_global.__sp4DebugFlags.validateRenderBypassLogged) {
                    _global.__sp4DebugFlags.validateRenderBypassLogged = true;
                    cc.log('[sp4][jsb] _validateRender: bypassing isTexturesLoaded() — skeleton already parsed, textures trusted.');
                }
                // fall through to _super()
            } else {
                if (CC_JSB && !_global.__sp4DebugFlags.validateRenderDisabledLogged) {
                    _global.__sp4DebugFlags.validateRenderDisabledLogged = true;
                    cc.log('[sp4][jsb] _validateRender: textures NOT loaded, calling disableRender. skeletonCache:', !!skeletonData._skeletonCache);
                }
                this.disableRender();
                return;
            }
        }
        this._super();
    },

    /**
     * !#en
     * Sets runtime skeleton data to sp4.Skeleton.<br>
     * This method is different from the `skeletonData` property. This method is passed in the raw data provided by the Spine runtime, and the skeletonData type is the asset type provided by Creator.
     * !#zh
     * 设置底层运行时用到的 SkeletonData。<br>
     * 这个接口有别于 `skeletonData` 属性，这个接口传入的是 Spine runtime 提供的原始数据，而 skeletonData 的类型是 Creator 提供的资源类型。
     * @method setSkeletonData
     * @param {sp4.spine.SkeletonData} skeletonData
     */
    setSkeletonData(skeletonData) {
        if (skeletonData.width != null && skeletonData.height != null) {
            this.node.setContentSize(skeletonData.width, skeletonData.height);
        }

        if (!CC_EDITOR) {
            if (this._cacheMode === AnimationCacheMode.SHARED_CACHE) {
                this._skeletonCache = SkeletonCache.sharedCache;
            } else if (this._cacheMode === AnimationCacheMode.PRIVATE_CACHE) {
                this._skeletonCache = new SkeletonCache;
                this._skeletonCache.enablePrivateMode();
            }
        }

        if (this.isAnimationCached()) {
            if (this.debugBones || this.debugSlots) {
                cc.warn("Debug bones or slots is invalid in cached mode");
            }
            let skeletonInfo = this._skeletonCache.getSkeletonCache(this.skeletonData._uuid, skeletonData);
            this._skeleton = skeletonInfo.skeleton;
            this._clipper = skeletonInfo.clipper;
            this._rootBone = this._skeleton.getRootBone();
        } else {
            this._skeleton = new spine.Skeleton(skeletonData);
            this._clipper = new spine.SkeletonClipping();
            this._rootBone = this._skeleton.getRootBone();
        }

        this._applySkeletonBoundsOffset(skeletonData);
        this.markForRender(true);
    },

    _applySkeletonBoundsOffset(skeletonData) {
        if (this.isAnimationCached() || !this._skeleton || !skeletonData) {
            return;
        }

        let width = Number(skeletonData.width);
        let height = Number(skeletonData.height);
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return;
        }

        let originX = Number(skeletonData.x);
        let originY = Number(skeletonData.y);
        if (!Number.isFinite(originX)) {
            originX = 0;
        }
        if (!Number.isFinite(originY)) {
            originY = 0;
        }

        let anchorX = (this.node && Number.isFinite(this.node.anchorX)) ? this.node.anchorX : 0.5;
        let anchorY = (this.node && Number.isFinite(this.node.anchorY)) ? this.node.anchorY : 0.5;
        let offsetX = -originX - width * anchorX;
        let offsetY = -originY - height * anchorY;

        if (typeof this._skeleton.setPosition === 'function') {
            this._skeleton.setPosition(offsetX, offsetY);
        } else {
            this._skeleton.x = offsetX;
            this._skeleton.y = offsetY;
        }

        if (typeof this._skeleton.updateWorldTransform === 'function') {
            try {
                this._skeleton.updateWorldTransform(spine.Physics.update);
            } catch (error) {
                this._skeleton.updateWorldTransform();
            }
        }
    },

    /**
     * !#en Sets slots visible range.
     * !#zh 设置骨骼插槽可视范围。
     * @method setSlotsRange
     * @param {Number} startSlotIndex
     * @param {Number} endSlotIndex
     */
    setSlotsRange(startSlotIndex, endSlotIndex) {
        if (this.isAnimationCached()) {
            cc.warn("Slots visible range can not be modified in cached mode.");
        } else {
            this._startSlotIndex = startSlotIndex;
            this._endSlotIndex = endSlotIndex;
        }
    },

    /**
     * !#en Sets animation state data.<br>
     * The parameter type is {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.AnimationStateData.
     * !#zh 设置动画状态数据。<br>
     * 参数是 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.AnimationStateData。
     * @method setAnimationStateData
     * @param {sp4.spine.AnimationStateData} stateData
     */
    setAnimationStateData(stateData) {
        if (this.isAnimationCached()) {
            cc.warn("'setAnimationStateData' interface can not be invoked in cached mode.");
        } else {
            var state = new spine.AnimationState(stateData);
            if (this._listener) {
                if (this._state) {
                    this._state.removeListener(this._listener);
                }
                state.addListener(this._listener);
            }
            this._state = state;
        }

    },

    // IMPLEMENT
    __preload() {
        this._super();
        if (CC_JSB && !_global.__sp4DebugFlags.preloadAssemblerLogged) {
            _global.__sp4DebugFlags.preloadAssemblerLogged = true;
            cc.log('[sp4][jsb] __preload: _assembler=', this._assembler && this._assembler.constructor && this._assembler.constructor.name, 'hasFillBuffers:', typeof (this._assembler && this._assembler.fillBuffers), 'renderFlag:', this.node._renderFlag);
        }

        if (CC_EDITOR) {
            var Flags = cc.Object.Flags;
            this._objFlags |= (Flags.IsAnchorLocked | Flags.IsSizeLocked);

            this._refreshInspector();
        }

        var children = this.node.children;
        for (var i = 0, n = children.length; i < n; i++) {
            var child = children[i];
            if (child && child._name === "DEBUG_DRAW_NODE") {
                child.destroy();
            }
        }

        this._updateSkeletonData();
        this._updateDebugDraw();
        this._updateUseTint();
        this._updateBatch();

        if (CC_JSB && !_global.__sp4DebugFlags.preloadDoneLogged) {
            _global.__sp4DebugFlags.preloadDoneLogged = true;
            cc.log('[sp4][jsb] __preload done: renderFlag:', this.node._renderFlag, 'FLAG_RENDER:', !!(this.node._renderFlag & RenderFlow.FLAG_RENDER));
        }
    },

    /**
     * !#en
     * It's best to set cache mode before set property 'dragonAsset', or will waste some cpu time.
     * If set the mode in editor, then no need to worry about order problem.
     * !#zh 
     * 若想切换渲染模式，最好在设置'dragonAsset'之前，先设置好渲染模式，否则有运行时开销。
     * 若在编辑中设置渲染模式，则无需担心设置次序的问题。
     * 
     * @method setAnimationCacheMode
     * @param {AnimationCacheMode} cacheMode
     * @example
     * skeleton.setAnimationCacheMode(sp4.Skeleton.AnimationCacheMode.SHARED_CACHE);
     */
    setAnimationCacheMode(cacheMode) {
        if (this._preCacheMode !== cacheMode) {
            this._cacheMode = cacheMode;
            this._updateSkeletonData();
            this._updateUseTint();
        }
    },

    /**
     * !#en Whether in cached mode.
     * !#zh 当前是否处于缓存模式。
     * @method isAnimationCached
     * @return {Boolean}
     */
    isAnimationCached() {
        if (CC_EDITOR) return false;
        return this._cacheMode !== AnimationCacheMode.REALTIME;
    },

    update(dt) {
        if (CC_EDITOR) return;
        if (this.paused) return;

        if (CC_JSB && !_global.__sp4DebugFlags.updateRenderFlagLogged) {
            _global.__sp4DebugFlags.updateRenderFlagLogged = true;
            cc.log('[sp4][jsb] update() frame1: renderFlag:', this.node._renderFlag,
                'FLAG_RENDER:', !!(this.node._renderFlag & RenderFlow.FLAG_RENDER),
                '_assemblerType:', this._assembler && this._assembler.constructor && this._assembler.constructor.name,
                'fillBuffersType:', typeof (this._assembler && this._assembler.fillBuffers),
                'node._renderComponent:', this.node._renderComponent && cc.js.getClassName(this.node._renderComponent),
                'isNodeRenderCompSelf:', this.node._renderComponent === this);
        }

        dt *= this.timeScale * sp4.timeScale;

        if (this.isAnimationCached()) {

            // Cache mode and has animation queue.
            if (this._isAniComplete) {
                if (this._animationQueue.length === 0 && !this._headAniInfo) {
                    let frameCache = this._frameCache;
                    if (frameCache && frameCache.isInvalid()) {
                        frameCache.updateToFrame();
                        let frames = frameCache.frames;
                        this._curFrame = frames[frames.length - 1];
                    }
                    return;
                }
                if (!this._headAniInfo) {
                    this._headAniInfo = this._animationQueue.shift();
                }
                this._accTime += dt;
                if (this._accTime > this._headAniInfo.delay) {
                    let aniInfo = this._headAniInfo;
                    this._headAniInfo = null;
                    this.setAnimation(0, aniInfo.animationName, aniInfo.loop);
                }
                return;
            }

            this._updateCache(dt);
        } else {
            this._updateRealtime(dt);
        }

        // On JSB the native renderer does not preserve FLAG_RENDER across frames
        // for JS-only components — call markForRender every update cycle.
        this.markForRender(true);
    },

    _emitCacheCompleteEvent() {
        if (!this._listener) return;
        this._endEntry.animation.name = this._animationName;
        this._listener.complete && this._listener.complete(this._endEntry);
        this._listener.end && this._listener.end(this._endEntry);
    },

    _updateCache(dt) {
        let frameCache = this._frameCache;
        if (!frameCache.isInited()) {
            return;
        }
        let frames = frameCache.frames;
        let frameTime = SkeletonCache.FrameTime;

        // Animation Start, the event diffrent from dragonbones inner event,
        // It has no event object.
        if (this._accTime == 0 && this._playCount == 0) {
            this._startEntry.animation.name = this._animationName;
            this._listener && this._listener.start && this._listener.start(this._startEntry);
        }

        this._accTime += dt;
        let frameIdx = Math.floor(this._accTime / frameTime);
        if (!frameCache.isCompleted) {
            frameCache.updateToFrame(frameIdx);
        }

        if (frameCache.isCompleted && frameIdx >= frames.length) {
            this._playCount++;
            if (this._playTimes > 0 && this._playCount >= this._playTimes) {
                // set frame to end frame.
                this._curFrame = frames[frames.length - 1];
                this._accTime = 0;
                this._playCount = 0;
                this._isAniComplete = true;
                this._emitCacheCompleteEvent();
                return;
            }
            this._accTime = 0;
            frameIdx = 0;
            this._emitCacheCompleteEvent();
        }
        this._curFrame = frames[frameIdx];
    },

    _updateRealtime(dt) {
        let skeleton = this._skeleton;
        let state = this._state;
        if (skeleton) {
            if (state) {
                state.update(dt);
                state.apply(skeleton);
            }
            skeleton.update(dt);
        }
    },

    /**
     * !#en Sets vertex effect delegate.
     * !#zh 设置顶点动画代理
     * @method setVertexEffectDelegate
     * @param {sp4.VertexEffectDelegate} effectDelegate
     */
    setVertexEffectDelegate(effectDelegate) {
        this._effectDelegate = effectDelegate;
    },

    // RENDERER

    /**
     * !#en Computes the world SRT from the local SRT for each bone.
     * !#zh 重新更新所有骨骼的世界 Transform，
     * 当获取 bone 的数值未更新时，即可使用该函数进行更新数值。
     * @method updateWorldTransform
     * @example
     * var bone = spine.findBone('head');
     * cc.log(bone.worldX); // return 0;
     * spine.updateWorldTransform();
     * bone = spine.findBone('head');
     * cc.log(bone.worldX); // return -23.12;
     */
    updateWorldTransform() {
        if (!this.isAnimationCached()) return;

        if (this._skeleton) {
            this._skeleton.updateWorldTransform(spine.Physics.update);
        }
    },

    /**
     * !#en Sets the bones and slots to the setup pose.
     * !#zh 还原到起始动作
     * @method setToSetupPose
     */
    setToSetupPose() {
        if (this._skeleton) {
            this._skeleton.setToSetupPose();
        }
    },

    /**
     * !#en
     * Sets the bones to the setup pose,
     * using the values from the `BoneData` list in the `SkeletonData`.
     * !#zh
     * 设置 bone 到起始动作
     * 使用 SkeletonData 中的 BoneData 列表中的值。
     * @method setBonesToSetupPose
     */
    setBonesToSetupPose() {
        if (this._skeleton) {
            this._skeleton.setBonesToSetupPose();
        }
    },

    /**
     * !#en
     * Sets the slots to the setup pose,
     * using the values from the `SlotData` list in the `SkeletonData`.
     * !#zh
     * 设置 slot 到起始动作。
     * 使用 SkeletonData 中的 SlotData 列表中的值。
     * @method setSlotsToSetupPose
     */
    setSlotsToSetupPose() {
        if (this._skeleton) {
            this._skeleton.setSlotsToSetupPose();
        }
    },

    /**
     * !#en
     * Updating an animation cache to calculate all frame data in the animation is a cost in 
     * performance due to calculating all data in a single frame.
     * To update the cache, use the invalidAnimationCache method with high performance.
     * !#zh
     * 更新某个动画缓存, 预计算动画中所有帧数据，由于在单帧计算所有数据，所以较消耗性能。
     * 若想更新缓存，可使用 invalidAnimationCache 方法，具有较高性能。
     * @method updateAnimationCache
     * @param {String} animName
     */
    updateAnimationCache(animName) {
        if (!this.isAnimationCached()) return;
        let uuid = this.skeletonData._uuid;
        if (this._skeletonCache) {
            this._skeletonCache.updateAnimationCache(uuid, animName);
        }
    },

    /**
     * !#en
     * Invalidates the animation cache, which is then recomputed on each frame..
     * !#zh
     * 使动画缓存失效，之后会在每帧重新计算。
     * @method invalidAnimationCache
     */
    invalidAnimationCache() {
        if (!this.isAnimationCached()) return;
        if (this._skeletonCache) {
            this._skeletonCache.invalidAnimationCache(this.skeletonData._uuid);
        }
    },

    /**
     * !#en
     * Finds a bone by name.
     * This does a string comparison for every bone.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Bone object.
     * !#zh
     * 通过名称查找 bone。
     * 这里对每个 bone 的名称进行了对比。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Bone 对象。
     *
     * @method findBone
     * @param {String} boneName
     * @return {sp4.spine.Bone}
     */
    findBone(boneName) {
        if (this._skeleton) {
            return this._skeleton.findBone(boneName);
        }
        return null;
    },

    /**
     * !#en
     * Finds a slot by name. This does a string comparison for every slot.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Slot object.
     * !#zh
     * 通过名称查找 slot。这里对每个 slot 的名称进行了比较。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Slot 对象。
     *
     * @method findSlot
     * @param {String} slotName
     * @return {sp4.spine.Slot}
     */
    findSlot(slotName) {
        if (this._skeleton) {
            return this._skeleton.findSlot(slotName);
        }
        return null;
    },

    /**
     * !#en
     * Finds a skin by name and makes it the active skin.
     * This does a string comparison for every skin.<br>
     * Note that setting the skin does not change which attachments are visible.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Skin object.
     * !#zh
     * 按名称查找皮肤，激活该皮肤。这里对每个皮肤的名称进行了比较。<br>
     * 注意：设置皮肤不会改变 attachment 的可见性。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Skin 对象。
     *
     * @method setSkin
     * @param {String} skinName
     */
    setSkin(skinName) {
        if (Array.isArray(skinName)) {
            return this.setSkins(skinName);
        }
        return this._applySkinNames(skinName ? [skinName] : []);
    },

    /**
     * !#en
     * Sets multiple active skins at once by composing them into a single runtime skin.
     * The inspector currently exposes up to 4 active skins and this API matches that limit.
     * !#zh
     * 同时设置多个激活的皮肤，并在运行时组合成一个皮肤。
     * 检查器当前最多暴露 4 个皮肤槽位，此接口与该限制保持一致。
     *
     * @method setSkins
     * @param {String[]} skinNames
     * @return {String[]} applied skin names
     */
    setSkins(skinNames) {
        let maxSkins = Math.min(4, this._getAvailableSkinCount());
        let nextSkins = this._normalizeActiveSkins(skinNames, maxSkins, true);
        this.activeSkins = nextSkins;
        this.activeSkinsCount = Math.max(1, Math.min(maxSkins, nextSkins.length || this.activeSkinsCount || 1));
        this.enableMultipleSkins = nextSkins.length > 1;

        if (!this.enableMultipleSkins) {
            this.defaultSkin = nextSkins[0] || this.defaultSkin;
            let applied = this._applyConfiguredSkins();
            if (CC_EDITOR && !cc.engine.isPlaying) {
                this._refreshInspector();
            }
            return applied;
        }

        let applied = this._applyConfiguredSkins();
        if (CC_EDITOR && !cc.engine.isPlaying) {
            this._refreshInspector();
        }
        return applied;
    },

    /**
     * !#en Returns the active skin names currently used for composite skin mode.
     * !#zh 返回当前用于组合皮肤模式的激活皮肤名称列表。
     * @method getActiveSkins
     * @return {String[]}
     */
    getActiveSkins() {
        let selected = this.activeSkins || [];
        let result = [];
        let used = Object.create(null);
        let limit = Math.max(1, Math.min(4, this._getAvailableSkinCount(), this.activeSkinsCount || 1));

        for (let i = 0; i < limit; i++) {
            let skinName = selected[i];
            if (!skinName || used[skinName]) {
                continue;
            }
            used[skinName] = true;
            result.push(skinName);
        }

        return result;
    },

    _getAvailableSkinCount() {
        if (this._skeleton && this._skeleton.data && this._skeleton.data.skins) {
            return Math.max(1, this._skeleton.data.skins.length);
        }
        if (this.skeletonData && typeof this.skeletonData.getRuntimeData === 'function') {
            let runtimeData = this.skeletonData.getRuntimeData(true);
            if (runtimeData && runtimeData.skins) {
                return Math.max(1, runtimeData.skins.length);
            }
        }
        return CC_JSB ? 999 : 1;
    },

    _resizeActiveSkins() {
        let limit = Math.max(1, Math.min(4, this._getAvailableSkinCount(), this.activeSkinsCount || 1));
        let activeSkins = this._normalizeActiveSkins(this.activeSkins, limit, false);
        while (activeSkins.length < limit) {
            activeSkins.push('');
        }
        this.activeSkins = activeSkins;
    },

    _normalizeActiveSkins(skinNames, maxSkins, warnOnDuplicate) {
        let limit = Math.max(1, Math.min(4, maxSkins || this._getAvailableSkinCount()));
        let nextSkins = Array.isArray(skinNames) ? skinNames.slice(0, limit) : [];
        let seen = Object.create(null);
        let hasDuplicate = false;

        for (let i = 0; i < nextSkins.length; i++) {
            let skinName = nextSkins[i];
            if (!skinName) {
                continue;
            }

            if (seen[skinName]) {
                hasDuplicate = true;
                nextSkins[i] = '';
                continue;
            }
            seen[skinName] = true;
        }

        if (warnOnDuplicate && hasDuplicate) {
            cc.warn('Duplicate active skins are not allowed. Please choose different skins.');
        }

        return nextSkins;
    },

    /**
     * !#en
     * Returns the attachment for the slot and attachment name.
     * The skeleton looks first in its skin, then in the skeleton data’s default skin.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Attachment object.
     * !#zh
     * 通过 slot 和 attachment 的名称获取 attachment。Skeleton 优先查找它的皮肤，然后才是 Skeleton Data 中默认的皮肤。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.Attachment 对象。
     *
     * @method getAttachment
     * @param {String} slotName
     * @param {String} attachmentName
     * @return {sp4.spine.Attachment}
     */
    getAttachment(slotName, attachmentName) {
        if (this._skeleton) {
            return this._skeleton.getAttachmentByName(slotName, attachmentName);
        }
        return null;
    },

    /**
     * !#en
     * Sets the attachment for the slot and attachment name.
     * The skeleton looks first in its skin, then in the skeleton data’s default skin.
     * !#zh
     * 通过 slot 和 attachment 的名字来设置 attachment。
     * Skeleton 优先查找它的皮肤，然后才是 Skeleton Data 中默认的皮肤。
     * @method setAttachment
     * @param {String} slotName
     * @param {String} attachmentName
     */
    setAttachment(slotName, attachmentName) {
        if (this._skeleton) {
            this._skeleton.setAttachment(slotName, attachmentName);
        }
        this.invalidAnimationCache();
    },

    /**
    * Return the renderer of attachment.
    * @method getTextureAtlas
    * @param {sp4.spine.RegionAttachment|spine.BoundingBoxAttachment} regionAttachment
    * @return {sp4.spine.TextureAtlasRegion}
    */
    getTextureAtlas(regionAttachment) {
        return regionAttachment.region;
    },

    // ANIMATION
    /**
     * !#en
     * Mix applies all keyframe values,
     * interpolated for the specified time and mixed with the current values.
     * !#zh 为所有关键帧设定混合及混合时间（从当前值开始差值）。
     * @method setMix
     * @param {String} fromAnimation
     * @param {String} toAnimation
     * @param {Number} duration
     */
    setMix(fromAnimation, toAnimation, duration) {
        if (this._state) {
            this._state.data.setMix(fromAnimation, toAnimation, duration);
        }
    },

    /**
     * !#en Set the current animation. Any queued animations are cleared.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry object.
     * !#zh 设置当前动画。队列中的任何的动画将被清除。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry 对象。
     * @method setAnimation
     * @param {Number} trackIndex
     * @param {String} name
     * @param {Boolean} loop
     * @return {sp4.spine.TrackEntry}
     */
    setAnimation(trackIndex, name, loop) {
        if (CC_JSB) {
            cc.log('[sp4][jsb] setAnimation request. track:', trackIndex, 'name:', name, 'loop:', loop, 'hasSkeleton:', !!this._skeleton);
        }

        this._playTimes = loop ? 0 : 1;
        this._animationName = name;

        if (this.isAnimationCached()) {
            if (trackIndex !== 0) {
                cc.warn("Track index can not greater than 0 in cached mode.");
            }
            if (!this._skeletonCache) return null;
            let cache = this._skeletonCache.getAnimationCache(this.skeletonData._uuid, name);
            if (!cache) {
                cache = this._skeletonCache.initAnimationCache(this.skeletonData._uuid, name);
            }
            if (cache) {
                this._isAniComplete = false;
                this._accTime = 0;
                this._playCount = 0;
                this._frameCache = cache;
                if (this.attachUtil._hasAttachedNode()) {
                    this._frameCache.enableCacheAttachedInfo();
                }
                this._frameCache.updateToFrame(0);
                this._curFrame = this._frameCache.frames[0];
            }
        } else {
            if (this._skeleton) {
                var animation = this._skeleton.data.findAnimation(name);
                if (!animation) {
                    if (CC_JSB) {
                        let names = (this._skeleton.data.animations || []).slice(0, 10).map(function (a) { return a.name; });
                        cc.log('[sp4][jsb] setAnimation animation not found. requested:', name, 'available(first10):', names.join(','));
                    }
                    cc.logID(7509, name);
                    return null;
                }
                var res = this._state.setAnimationWith(trackIndex, animation, loop);
                this._state.apply(this._skeleton);
                this._skeleton.update(0);
                let physicsMode = (CC_EDITOR && !cc.engine.isPlaying) ? spine.Physics.reset : spine.Physics.update;
                this._skeleton.updateWorldTransform(physicsMode);
                return res;
            }
        }
        return null;
    },

    /**
     * !#en Adds an animation to be played delay seconds after the current or last queued animation.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry object.
     * !#zh 添加一个动画到动画队列尾部，还可以延迟指定的秒数。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry 对象。
     * @method addAnimation
     * @param {Number} trackIndex
     * @param {String} name
     * @param {Boolean} loop
     * @param {Number} [delay=0]
     * @return {sp4.spine.TrackEntry}
     */
    addAnimation(trackIndex, name, loop, delay) {
        delay = delay || 0;
        if (this.isAnimationCached()) {
            if (trackIndex !== 0) {
                cc.warn("Track index can not greater than 0 in cached mode.");
            }
            this._animationQueue.push({ animationName: name, loop: loop, delay: delay });
        } else {
            if (this._skeleton) {
                var animation = this._skeleton.data.findAnimation(name);
                if (!animation) {
                    cc.logID(7510, name);
                    return null;
                }
                return this._state.addAnimationWith(trackIndex, animation, loop, delay);
            }
        }
        return null;
    },

    /**
     * !#en Find animation with specified name.
     * !#zh 查找指定名称的动画
     * @method findAnimation
     * @param {String} name
     * @returns {sp4.spine.Animation}
     */
    findAnimation(name) {
        if (this._skeleton) {
            return this._skeleton.data.findAnimation(name);
        }
        return null;
    },

    /**
     * !#en Returns track entry by trackIndex.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry object.
     * !#zh 通过 track 索引获取 TrackEntry。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.TrackEntry 对象。
     * @method getCurrent
     * @param trackIndex
     * @return {sp4.spine.TrackEntry}
     */
    getCurrent(trackIndex) {
        if (this.isAnimationCached()) {
            cc.warn("'getCurrent' interface can not be invoked in cached mode.");
        } else {
            if (this._state) {
                return this._state.getCurrent(trackIndex);
            }
        }
        return null;
    },

    /**
     * !#en Clears all tracks of animation state.
     * !#zh 清除所有 track 的动画状态。
     * @method clearTracks
     */
    clearTracks() {
        if (this.isAnimationCached()) {
            cc.warn("'clearTracks' interface can not be invoked in cached mode.");
        } else {
            if (this._state) {
                this._state.clearTracks();
            }
        }
    },

    /**
     * !#en Clears track of animation state by trackIndex.
     * !#zh 清除出指定 track 的动画状态。
     * @method clearTrack
     * @param {number} trackIndex
     */
    clearTrack(trackIndex) {
        if (this.isAnimationCached()) {
            cc.warn("'clearTrack' interface can not be invoked in cached mode.");
        } else {
            if (this._state) {
                this._state.clearTrack(trackIndex);
                if (CC_EDITOR && !cc.engine.isPlaying) {
                    this._state.update(0);
                    this.setToSetupPose();
                }
            }
        }
    },

    /**
     * !#en Set the start event listener.
     * !#zh 用来设置开始播放动画的事件监听。
     * @method setStartListener
     * @param {function} listener
     */
    setStartListener(listener) {
        this._ensureListener();
        this._listener.start = listener;
    },

    /**
     * !#en Set the interrupt event listener.
     * !#zh 用来设置动画被打断的事件监听。
     * @method setInterruptListener
     * @param {function} listener
     */
    setInterruptListener(listener) {
        this._ensureListener();
        this._listener.interrupt = listener;
    },

    /**
     * !#en Set the end event listener.
     * !#zh 用来设置动画播放完后的事件监听。
     * @method setEndListener
     * @param {function} listener
     */
    setEndListener(listener) {
        this._ensureListener();
        this._listener.end = listener;
    },

    /**
     * !#en Set the dispose event listener.
     * !#zh 用来设置动画将被销毁的事件监听。
     * @method setDisposeListener
     * @param {function} listener
     */
    setDisposeListener(listener) {
        this._ensureListener();
        this._listener.dispose = listener;
    },

    /**
     * !#en Set the complete event listener.
     * !#zh 用来设置动画播放一次循环结束后的事件监听。
     * @method setCompleteListener
     * @param {function} listener
     */
    setCompleteListener(listener) {
        this._ensureListener();
        this._listener.complete = listener;
    },

    /**
     * !#en Set the animation event listener.
     * !#zh 用来设置动画播放过程中帧事件的监听。
     * @method setEventListener
     * @param {function} listener
     */
    setEventListener(listener) {
        this._ensureListener();
        this._listener.event = listener;
    },

    /**
     * !#en Set the start event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画开始播放的事件监听。
     * @method setTrackStartListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     */
    setTrackStartListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).start = listener;
    },

    /**
     * !#en Set the interrupt event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画被打断的事件监听。
     * @method setTrackInterruptListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     */
    setTrackInterruptListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).interrupt = listener;
    },

    /**
     * !#en Set the end event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画播放结束的事件监听。
     * @method setTrackEndListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     */
    setTrackEndListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).end = listener;
    },

    /**
     * !#en Set the dispose event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画即将被销毁的事件监听。
     * @method setTrackDisposeListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     */
    setTrackDisposeListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).dispose = listener;
    },

    /**
     * !#en Set the complete event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画一次循环播放结束的事件监听。
     * @method setTrackCompleteListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     * @param {sp4.spine.TrackEntry} listener.entry
     * @param {Number} listener.loopCount
     */
    setTrackCompleteListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).complete = function (trackEntry) {
            var loopCount = Math.floor(trackEntry.trackTime / trackEntry.animationEnd);
            listener(trackEntry, loopCount);
        };
    },

    /**
     * !#en Set the event listener for specified TrackEntry.
     * !#zh 用来为指定的 TrackEntry 设置动画帧事件的监听。
     * @method setTrackEventListener
     * @param {sp4.spine.TrackEntry} entry
     * @param {function} listener
     */
    setTrackEventListener(entry, listener) {
        TrackEntryListeners.getListeners(entry).event = listener;
    },

    /**
     * !#en Get the animation state object
     * !#zh 获取动画状态
     * @method getState
     * @return {sp4.spine.AnimationState} state
     */
    getState() {
        return this._state;
    },

    _getActiveSkinEnumValue(index) {
        let skinsEnum = this.skeletonData && this.skeletonData.getSkinsEnum && this.skeletonData.getSkinsEnum(true);
        if (!skinsEnum) {
            return 0;
        }
        let activeSkins = this.activeSkins || [];
        let skinName = activeSkins[index];
        if (!skinName) {
            return 0;
        }
        let enumValue = skinsEnum[skinName];
        return enumValue !== undefined ? enumValue : 0;
    },

    _setActiveSkinEnumValue(index, value) {
        let skinsEnum = this.skeletonData && this.skeletonData.getSkinsEnum && this.skeletonData.getSkinsEnum(true);
        if (!skinsEnum) {
            return;
        }

        let activeSkins = (this.activeSkins || []).slice();
        let skinName = value === 0 ? '' : (skinsEnum[value] || '');
        if (skinName) {
            for (let i = 0; i < activeSkins.length; i++) {
                if (i !== index && activeSkins[i] === skinName) {
                    cc.warn('Duplicate active skins are not allowed. Please choose different skins.');
                    return;
                }
            }
        }

        activeSkins[index] = skinName;
        this.activeSkins = activeSkins;

        if (this.enableMultipleSkins) {
            this._applyConfiguredSkins();
        }
        if (CC_EDITOR && !cc.engine.isPlaying) {
            this._refreshInspector();
        }
    },

    _applyConfiguredSkins() {
        if (this.enableMultipleSkins) {
            let activeSkins = this.getActiveSkins();
            if (activeSkins.length > 0) {
                return this._applySkinNames(activeSkins);
            }
        }

        if (this.defaultSkin) {
            return this._applySkinNames([this.defaultSkin]);
        }

        if (this._skeleton) {
            this._skeleton.setSkin(null);
            this._skeleton.setSlotsToSetupPose();
            this._refreshSkeletonPose();
            this.invalidAnimationCache();
        }

        return [];
    },

    _applySkinNames(skinNames) {
        if (!this._skeleton || !this._skeleton.data) {
            return [];
        }

        let seen = Object.create(null);
        let validNames = [];
        let validSkins = [];
        for (let i = 0; i < skinNames.length; i++) {
            let skinName = skinNames[i];
            if (!skinName || seen[skinName]) {
                continue;
            }

            let skin = this._skeleton.data.findSkin(skinName);
            if (!skin) {
                cc.warn('Skin not found: ' + skinName);
                continue;
            }

            seen[skinName] = true;
            validNames.push(skinName);
            validSkins.push(skin);
        }

        if (validSkins.length === 0) {
            this._skeleton.setSkin(null);
        } else if (validSkins.length === 1) {
            this._skeleton.setSkin(validSkins[0]);
        } else {
            let compositeSkin = new spine.Skin('__cocos-combined-skin__');
            for (let i = 0; i < validSkins.length; i++) {
                compositeSkin.addSkin(validSkins[i]);
            }
            this._skeleton.setSkin(compositeSkin);
        }

        this._skeleton.setSlotsToSetupPose();
        this._refreshSkeletonPose();
        this.invalidAnimationCache();
        return validNames;
    },

    _refreshSkeletonPose() {
        if (!this._skeleton) {
            return;
        }

        if (!this.isAnimationCached() && this._state) {
            this._state.apply(this._skeleton);
            this._skeleton.update(0);
        }

        let physicsMode = (CC_EDITOR && !cc.engine.isPlaying) ? spine.Physics.reset : spine.Physics.update;
        this._skeleton.updateWorldTransform(physicsMode);
        this.markForRender(true);
    },

    // update animation list for editor
    _updateAnimEnum: CC_EDITOR && function () {
        var animEnum;
        if (this.skeletonData) {
            animEnum = this.skeletonData.getAnimsEnum();
        }
        // change enum
        setEnumAttr(this, '_animationIndex', animEnum || DefaultAnimsEnum);
    },
    // update skin list for editor
    _updateSkinEnum: CC_EDITOR && function () {
        var skinEnum;
        if (this.skeletonData) {
            skinEnum = this.skeletonData.getSkinsEnum();
        }
        // change enum
        setEnumAttr(this, '_defaultSkinIndex', skinEnum || DefaultSkinsEnum);

        var optionalSkinEnum;
        if (this.skeletonData) {
            optionalSkinEnum = this.skeletonData.getSkinsEnum(true);
        }
        optionalSkinEnum = optionalSkinEnum || OptionalSkinsEnum;
        setEnumAttr(this, '_activeSkinIndex0', optionalSkinEnum);
        setEnumAttr(this, '_activeSkinIndex1', optionalSkinEnum);
        setEnumAttr(this, '_activeSkinIndex2', optionalSkinEnum);
        setEnumAttr(this, '_activeSkinIndex3', optionalSkinEnum);
    },

    _ensureListener() {
        if (!this._listener) {
            this._listener = new TrackEntryListeners();
            if (this._state) {
                this._state.addListener(this._listener);
            }
        }
    },

    _updateSkeletonData() {
        if (!this.skeletonData) {
            if (CC_JSB && !_global.__sp4DebugFlags.noSkeletonDataLogged) {
                _global.__sp4DebugFlags.noSkeletonDataLogged = true;
                cc.log('[sp4][jsb] _updateSkeletonData: missing skeletonData asset');
            }
            this.disableRender();
            return;
        }

        if (typeof this.skeletonData.getRuntimeData !== 'function') {
            if (CC_JSB && !_global.__sp4DebugFlags.noRuntimeMethodLogged) {
                _global.__sp4DebugFlags.noRuntimeMethodLogged = true;
                cc.log('[sp4][jsb] _updateSkeletonData: skeletonData.getRuntimeData is not a function');
            }
            this.disableRender();
            return;
        }

        let data = this.skeletonData.getRuntimeData();
        if (!data) {
            if (CC_JSB && !_global.__sp4DebugFlags.runtimeDataNullLogged) {
                _global.__sp4DebugFlags.runtimeDataNullLogged = true;
                cc.log('[sp4][jsb] _updateSkeletonData: getRuntimeData returned null');
            }
            this.disableRender();
            return;
        }

        try {
            this.setSkeletonData(data);
            if (!this.isAnimationCached()) {
                this.setAnimationStateData(new spine.AnimationStateData(this._skeleton.data));
            }
            this._applyConfiguredSkins();

            if (CC_JSB && !_global.__sp4DebugFlags.skeletonSetupInfoLogged && this._skeleton) {
                _global.__sp4DebugFlags.skeletonSetupInfoLogged = true;
                let slots = this._skeleton.slots || [];
                let drawOrder = this._skeleton.drawOrder || [];
                cc.log('[sp4][jsb] skeleton setup done. slots:', slots.length, 'drawOrder:', drawOrder.length, 'defaultSkin:', this.defaultSkin || '<empty>', 'defaultAnimation:', this.defaultAnimation || '<empty>');
            }
        }
        catch (e) {
            if (CC_JSB && !_global.__sp4DebugFlags.updateSkeletonCatchLogged) {
                _global.__sp4DebugFlags.updateSkeletonCatchLogged = true;
                cc.log('[sp4][jsb] _updateSkeletonData catch:', e && (e.stack || e.message) ? (e.stack || e.message) : e);
            }
            cc.warn(e && (e.stack || e.message) ? (e.stack || e.message) : e);
        }

        // Auto-detect premultiplied alpha from atlas page PMA flag.
        // Spine atlases can declare pma:true which means RGB is already
        // multiplied by alpha; the GPU blend must use ONE not SRC_ALPHA.
        let _atlas = this.skeletonData && this.skeletonData._atlasCache;
        if (_atlas && _atlas.pages && _atlas.pages.length > 0) {
            let _hasPma = _atlas.pages.some(function (p) { return !!p.pma; });
            if (this.premultipliedAlpha !== _hasPma) {
                this.premultipliedAlpha = _hasPma;
                this._materialCache = {};
            }
        }

        this.attachUtil.init(this);
        this.attachUtil._associateAttachedNode();
        this._preCacheMode = this._cacheMode;
        this.animation = this.defaultAnimation;
    },

    _refreshInspector() {
        // update inspector
        this._updateAnimEnum();
        this._updateSkinEnum();
        Editor.Utils.refreshSelectedInspector('node', this.node.uuid);
    },

    _updateDebugDraw: function () {
        if (this.debugBones || this.debugSlots || this.debugMesh || this.debugMeshHull) {
            if (!this._debugRenderer) {
                let debugDrawNode = new cc.PrivateNode();
                debugDrawNode.name = 'DEBUG_DRAW_NODE';
                let debugDraw = debugDrawNode.addComponent(Graphics);
                debugDraw.lineWidth = 1;
                debugDraw.strokeColor = cc.color(255, 0, 0, 255);

                this._debugRenderer = debugDraw;
            }

            this._debugRenderer.node.parent = this.node;
            if (this.isAnimationCached()) {
                cc.warn("Debug bones, slots, mesh or mesh hull is invalid in cached mode");
            }
        }
        else if (this._debugRenderer) {
            this._debugRenderer.node.parent = null;
        }
    },
});

module.exports = sp4.Skeleton;

let nativeSpine4 = _global.spine4;
let nativeRenderer = _global.renderer;
let nativeMiddleware = _global.middleware;

if (CC_JSB && CC_NATIVERENDERER && nativeSpine4 && nativeRenderer && nativeRenderer.CustomAssembler && nativeMiddleware) {
    let skeletonProto = sp4.Skeleton.prototype;
    let AnimationCacheMode = sp4.Skeleton.AnimationCacheMode;
    let slotColor = cc.color(0, 0, 255, 255);
    let boneColor = cc.color(255, 0, 0, 255);
    let meshColor = cc.color(255, 255, 0, 255);
    let originColor = cc.color(0, 255, 0, 255);
    let materialHashMap = {};
    let materialId = 1;

    let jsUpdateMaterial = skeletonProto._updateMaterial;
    let jsUpdateUseTint = skeletonProto._updateUseTint;
    let jsUpdateBatch = skeletonProto._updateBatch;
    let jsUpdateDebugDraw = skeletonProto._updateDebugDraw;
    let jsSetSkeletonData = skeletonProto.setSkeletonData;
    let jsUpdate = skeletonProto.update;
    let jsApplySkinNames = skeletonProto._applySkinNames;
    let jsOnDestroy = skeletonProto.onDestroy;

    sp4.Skeleton._assembler = null;

    Object.defineProperty(skeletonProto, 'paused', {
        get() {
            return this._paused || false;
        },
        set(value) {
            this._paused = value;
            if (this._nativeSkeleton) {
                this._nativeSkeleton.paused(value);
            }
        },
        configurable: true,
    });

    skeletonProto._resetAssembler = function () {
        this._assembler = new nativeRenderer.CustomAssembler();
        this.node._proxy.setAssembler(this._assembler);
    };

    skeletonProto._updateMaterial = function () {
        jsUpdateMaterial.call(this);

        if (!this._nativeSkeleton) {
            return;
        }

        this._assembler && this._assembler.clearEffect();
        let baseMaterial = this.getMaterial(0);
        if (!baseMaterial) {
            return;
        }

        let originHash = baseMaterial.effect.getHash();
        let id = materialHashMap[originHash] || materialId++;
        materialHashMap[originHash] = id;
        baseMaterial.effect.updateHash(id);
        this._nativeSkeleton.setEffect(baseMaterial.effect._nativeObj);
    };

    skeletonProto._updateUseTint = function () {
        jsUpdateUseTint.call(this);
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setUseTint(this.useTint);
        }
        this._assembler && this._assembler.clearEffect();
    };

    skeletonProto._updateBatch = function () {
        jsUpdateBatch.call(this);
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setBatchEnabled(this.enableBatch);
        }
        this._assembler && this._assembler.clearEffect();
    };

    skeletonProto._updateDebugDraw = function () {
        jsUpdateDebugDraw.call(this);
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setDebugMeshEnabled(this.debugMesh);
            this._nativeSkeleton.setDebugSlotsEnabled(this.debugSlots);
            this._nativeSkeleton.setDebugBonesEnabled(this.debugBones);
        }
    };

    skeletonProto._updateColor = function () {
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setColor(this.node.color);
        }
    };

    skeletonProto.setSkeletonData = function (skeletonData) {
        if (!skeletonData || !skeletonData._uuid) {
            return jsSetSkeletonData.call(this, skeletonData);
        }

        if (skeletonData.width != null && skeletonData.height != null && skeletonData.width !== 0 && skeletonData.height !== 0) {
            this.node.setContentSize(skeletonData.width, skeletonData.height);
        }

        if (this._nativeSkeleton) {
            this._nativeSkeleton.stopSchedule();
            this._nativeSkeleton._comp = null;
            this._nativeSkeleton = null;
        }

        if (!this._assembler && this.node && this.node._proxy) {
            this._resetAssembler();
        }

        let nativeSkeleton;
        if (this.isAnimationCached()) {
            nativeSkeleton = new nativeSpine4.SkeletonCacheAnimation(skeletonData._uuid, this._cacheMode === AnimationCacheMode.SHARED_CACHE);
        } else {
            nativeSkeleton = new nativeSpine4.SkeletonAnimation();
            try {
                nativeSpine4.initSkeletonRenderer(nativeSkeleton, skeletonData._uuid);
            } catch (error) {
                if (cc._throw) {
                    cc._throw(error);
                } else {
                    throw error;
                }
                return;
            }
            nativeSkeleton.setDebugSlotsEnabled(this.debugSlots);
            nativeSkeleton.setDebugMeshEnabled(this.debugMesh);
            nativeSkeleton.setDebugBonesEnabled(this.debugBones);
        }

        this._nativeSkeleton = nativeSkeleton;
        nativeSkeleton._comp = this;
        nativeSkeleton.setUseTint(this.useTint);
        nativeSkeleton.setOpacityModifyRGB(this.premultipliedAlpha);
        nativeSkeleton.setTimeScale(this.timeScale);
        nativeSkeleton.setBatchEnabled(this.enableBatch);
        nativeSkeleton.bindNodeProxy(this.node._proxy);
        nativeSkeleton.setColor(this.node.color);

        this._skeleton = nativeSkeleton.getSkeleton();
        this._rootBone = this._skeleton && this._skeleton.getRootBone ? this._skeleton.getRootBone() : null;
        this._state = !this.isAnimationCached() && nativeSkeleton.getState ? nativeSkeleton.getState() : null;
        this._applySkeletonBoundsOffset(skeletonData);

        this._startListener && this.setStartListener(this._startListener);
        this._interruptListener && this.setInterruptListener(this._interruptListener);
        this._endListener && this.setEndListener(this._endListener);
        this._disposeListener && this.setDisposeListener(this._disposeListener);
        this._completeListener && this.setCompleteListener(this._completeListener);
        this._eventListener && this.setEventListener(this._eventListener);

        if (this._stateData && !this.isAnimationCached()) {
            nativeSkeleton.setAnimationStateData(this._stateData);
        }

        this._updateMaterial();
        this.markForRender(true);
    };

    skeletonProto.setAnimationStateData = function (stateData) {
        this._stateData = stateData;
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            return this._nativeSkeleton.setAnimationStateData(stateData);
        }
        return null;
    };

    skeletonProto.onEnable = function () {
        RenderComponent.prototype.onEnable.call(this);
        if (this._nativeSkeleton) {
            this._nativeSkeleton.onEnable();
        }
    };

    skeletonProto.onDisable = function () {
        RenderComponent.prototype.onDisable.call(this);
        if (this._nativeSkeleton) {
            this._nativeSkeleton.onDisable();
        }
    };

    skeletonProto.setVertexEffectDelegate = function (effectDelegate) {
        this._effectDelegate = effectDelegate;
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setVertexEffectDelegate(effectDelegate);
        }
    };

    skeletonProto.update = function (dt) {
        if (!this._nativeSkeleton) {
            return jsUpdate.call(this, dt);
        }

        let nativeSkeleton = this._nativeSkeleton;
        let node = this.node;
        if (!node) {
            return;
        }

        if (!this.isAnimationCached() && (this.debugBones || this.debugSlots || this.debugMesh) && this._debugRenderer) {
            let graphics = this._debugRenderer;
            graphics.clear();
            graphics.lineWidth = 2;
            let debugData = this._debugData || nativeSkeleton.getDebugData();
            if (!debugData) {
                return;
            }

            let debugIdx = 0;
            while (true) {
                let debugType = debugData[debugIdx++];
                if (debugType === 0) {
                    break;
                }
                let debugLen = debugData[debugIdx++];
                switch (debugType) {
                    case 1:
                        graphics.strokeColor = slotColor;
                        for (let i = 0; i < debugLen; i += 8) {
                            graphics.moveTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.lineTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.lineTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.lineTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.close();
                            graphics.stroke();
                        }
                        break;
                    case 2:
                        graphics.strokeColor = meshColor;
                        for (let i = 0; i < debugLen; i += 6) {
                            graphics.moveTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.lineTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.lineTo(debugData[debugIdx++], debugData[debugIdx++]);
                            graphics.close();
                            graphics.stroke();
                        }
                        break;
                    case 3:
                        graphics.strokeColor = boneColor;
                        graphics.fillColor = slotColor;
                        for (let i = 0; i < debugLen; i += 4) {
                            let bx = debugData[debugIdx++];
                            let by = debugData[debugIdx++];
                            let x = debugData[debugIdx++];
                            let y = debugData[debugIdx++];
                            graphics.moveTo(bx, by);
                            graphics.lineTo(x, y);
                            graphics.stroke();
                            graphics.circle(bx, by, Math.PI * 1.5);
                            graphics.fill();
                            if (i === 0) {
                                graphics.fillColor = originColor;
                            }
                        }
                        break;
                    default:
                        return;
                }
            }
        }
    };

    skeletonProto.updateWorldTransform = function () {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.updateWorldTransform();
        }
    };

    skeletonProto.setToSetupPose = function () {
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setToSetupPose();
        }
    };

    skeletonProto.setBonesToSetupPose = function () {
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setBonesToSetupPose();
        }
    };

    skeletonProto.setSlotsToSetupPose = function () {
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setSlotsToSetupPose();
        }
    };

    skeletonProto.setSlotsRange = function (startSlotIndex, endSlotIndex) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setSlotsRange(startSlotIndex, endSlotIndex);
        }
    };

    skeletonProto.updateAnimationCache = function (animName) {
        if (!this.isAnimationCached() || !this._nativeSkeleton) {
            return;
        }

        if (animName) {
            this._nativeSkeleton.updateAnimationCache(animName);
        } else {
            this._nativeSkeleton.updateAllAnimationCache();
        }
    };

    skeletonProto.invalidAnimationCache = function () {
        if (this.isAnimationCached() && this._nativeSkeleton) {
            this._nativeSkeleton.updateAllAnimationCache();
        }
    };

    skeletonProto.findBone = function (boneName) {
        return this._nativeSkeleton ? this._nativeSkeleton.findBone(boneName) : null;
    };

    skeletonProto.findSlot = function (slotName) {
        return this._nativeSkeleton ? this._nativeSkeleton.findSlot(slotName) : null;
    };

    skeletonProto._applySkinNames = function (skinNames) {
        if (!this._nativeSkeleton) {
            return jsApplySkinNames.call(this, skinNames);
        }

        let applied = [];
        if (Array.isArray(skinNames)) {
            for (let i = 0; i < skinNames.length; i++) {
                if (skinNames[i]) {
                    applied.push(skinNames[i]);
                }
            }
        }

        if (applied.length > 1) {
            if (this._nativeSkeleton.setSkins) {
                this._nativeSkeleton.setSkins(applied);
            } else {
                cc.warn('Multiple active skins are not supported on the temporary spine4 JSB bridge. Using the first skin only.');
                applied = [applied[0]];
                this._nativeSkeleton.setSkin(applied[0] || '');
            }
        } else {
            this._nativeSkeleton.setSkin(applied[0] || '');
        }

        this._nativeSkeleton.setSlotsToSetupPose();
        if (this._nativeSkeleton.updateWorldTransform && !this.isAnimationCached()) {
            this._nativeSkeleton.updateWorldTransform();
        }
        this.invalidAnimationCache();
        this.markForRender(true);
        return applied;
    };

    skeletonProto.getAttachment = function (slotName, attachmentName) {
        return this._nativeSkeleton ? this._nativeSkeleton.getAttachment(slotName, attachmentName) : null;
    };

    skeletonProto.setAttachment = function (slotName, attachmentName) {
        if (this._nativeSkeleton) {
            this._nativeSkeleton.setAttachment(slotName, attachmentName);
        }
    };

    skeletonProto.setMix = function (fromAnimation, toAnimation, duration) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setMix(fromAnimation, toAnimation, duration);
        }
    };

    skeletonProto.setAnimation = function (trackIndex, name, loop) {
        this._playTimes = loop ? 0 : 1;
        this._animationName = name;

        if (!this._nativeSkeleton) {
            return null;
        }

        if (this.isAnimationCached()) {
            return this._nativeSkeleton.setAnimation(name, loop);
        }
        return this._nativeSkeleton.setAnimation(trackIndex, name, loop);
    };

    skeletonProto.addAnimation = function (trackIndex, name, loop, delay) {
        if (!this._nativeSkeleton) {
            return null;
        }

        delay = delay || 0;
        if (this.isAnimationCached()) {
            return this._nativeSkeleton.addAnimation(name, loop, delay);
        }
        return this._nativeSkeleton.addAnimation(trackIndex, name, loop, delay);
    };

    skeletonProto.findAnimation = function (name) {
        return this._nativeSkeleton ? this._nativeSkeleton.findAnimation(name) : null;
    };

    skeletonProto.getCurrent = function (trackIndex) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            return this._nativeSkeleton.getCurrent(trackIndex);
        }
        return null;
    };

    skeletonProto.clearTracks = function () {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.clearTracks();
        }
    };

    skeletonProto.clearTrack = function (trackIndex) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.clearTrack(trackIndex);
        }
    };

    skeletonProto.setStartListener = function (listener) {
        this._startListener = listener;
        if (!this._nativeSkeleton) {
            return;
        }

        if (this.isAnimationCached()) {
            this._nativeSkeleton.setStartListener(function (animationName) {
                let self = this._comp;
                self._startEntry.animation.name = animationName;
                self._startListener && self._startListener(self._startEntry);
            });
        } else {
            this._nativeSkeleton.setStartListener(listener);
        }
    };

    skeletonProto.setInterruptListener = function (listener) {
        this._interruptListener = listener;
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setInterruptListener(listener);
        }
    };

    skeletonProto.setEndListener = function (listener) {
        this._endListener = listener;
        if (!this._nativeSkeleton) {
            return;
        }

        if (this.isAnimationCached()) {
            this._nativeSkeleton.setEndListener(function (animationName) {
                let self = this._comp;
                self._endEntry.animation.name = animationName;
                self._endListener && self._endListener(self._endEntry);
            });
        } else {
            this._nativeSkeleton.setEndListener(listener);
        }
    };

    skeletonProto.setDisposeListener = function (listener) {
        this._disposeListener = listener;
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setDisposeListener(listener);
        }
    };

    skeletonProto.setCompleteListener = function (listener) {
        this._completeListener = listener;
        if (!this._nativeSkeleton) {
            return;
        }

        if (this.isAnimationCached()) {
            this._nativeSkeleton.setCompleteListener(function (animationName) {
                let self = this._comp;
                self._endEntry.animation.name = animationName;
                self._completeListener && self._completeListener(self._endEntry);
            });
        } else {
            let buildSafeEntry = (trackEntry) => {
                if (trackEntry && trackEntry.animation) {
                    return trackEntry;
                }
                let fallbackEntry = this.getCurrent(0) || this._endEntry;
                if (!fallbackEntry) {
                    fallbackEntry = { animation: { name: "" }, trackIndex: 0 };
                } else if (!fallbackEntry.animation) {
                    fallbackEntry.animation = { name: "" };
                }
                if (!fallbackEntry.animation.name && this._animationName) {
                    fallbackEntry.animation.name = this._animationName;
                }
                return fallbackEntry;
            };
            let safeLoopCount = (trackEntry) => {
                let trackTime = Number(trackEntry && trackEntry.trackTime);
                let animationEnd = Number(trackEntry && trackEntry.animationEnd);
                if (!isFinite(trackTime) || !isFinite(animationEnd) || animationEnd <= 0) {
                    return 0;
                }
                return Math.floor(trackTime / animationEnd);
            };
            // spine4 JSB exports renamed APIs in native: setCompleteListenerNative/setTrackCompleteListenerNative.
            // Keep compatibility with both names to avoid runtime TypeError on native platforms.
            if (this._nativeSkeleton.setCompleteListener) {
                if (!listener) {
                    this._nativeSkeleton.setCompleteListener(null);
                } else {
                    this._nativeSkeleton.setCompleteListener((trackEntry) => {
                        let safeEntry = buildSafeEntry(trackEntry);
                        listener && listener(safeEntry, safeLoopCount(safeEntry));
                    });
                }
            } else if (this._nativeSkeleton.setCompleteListenerNative) {
                if (!listener) {
                    this._nativeSkeleton.setCompleteListenerNative(null);
                } else {
                    this._nativeSkeleton.setCompleteListenerNative((trackEntry) => {
                        let safeEntry = buildSafeEntry(trackEntry);
                        listener && listener(safeEntry, safeLoopCount(safeEntry));
                    });
                }
            }
        }
    };

    skeletonProto.setEventListener = function (listener) {
        this._eventListener = listener;
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setEventListener(listener);
        }
    };

    skeletonProto.setTrackStartListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setTrackStartListener(entry, listener);
        }
    };

    skeletonProto.setTrackInterruptListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setTrackInterruptListener(entry, listener);
        }
    };

    skeletonProto.setTrackEndListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setTrackEndListener(entry, listener);
        }
    };

    skeletonProto.setTrackDisposeListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setTrackDisposeListener(entry, listener);
        }
    };

    skeletonProto.setTrackCompleteListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            let buildSafeEntry = (trackEntry) => {
                if (trackEntry && trackEntry.animation) {
                    return trackEntry;
                }
                let fallbackEntry = entry || this.getCurrent(0) || this._endEntry;
                if (!fallbackEntry) {
                    fallbackEntry = { animation: { name: "" }, trackIndex: 0 };
                } else if (!fallbackEntry.animation) {
                    fallbackEntry.animation = { name: "" };
                }
                if (!fallbackEntry.animation.name && this._animationName) {
                    fallbackEntry.animation.name = this._animationName;
                }
                return fallbackEntry;
            };
            let safeLoopCount = (trackEntry) => {
                let trackTime = Number(trackEntry && trackEntry.trackTime);
                let animationEnd = Number(trackEntry && trackEntry.animationEnd);
                if (!isFinite(trackTime) || !isFinite(animationEnd) || animationEnd <= 0) {
                    return 0;
                }
                return Math.floor(trackTime / animationEnd);
            };
            if (this._nativeSkeleton.setTrackCompleteListener) {
                if (!listener) {
                    this._nativeSkeleton.setTrackCompleteListener(entry, null);
                } else {
                    this._nativeSkeleton.setTrackCompleteListener(entry, (trackEntry) => {
                        let safeEntry = buildSafeEntry(trackEntry);
                        listener && listener(safeEntry, safeLoopCount(safeEntry));
                    });
                }
            } else if (this._nativeSkeleton.setTrackCompleteListenerNative) {
                if (!listener) {
                    this._nativeSkeleton.setTrackCompleteListenerNative(entry, null);
                } else {
                    this._nativeSkeleton.setTrackCompleteListenerNative(entry, (trackEntry) => {
                        let safeEntry = buildSafeEntry(trackEntry);
                        listener && listener(safeEntry, safeLoopCount(safeEntry));
                    });
                }
            }
        }
    };

    skeletonProto.setTrackEventListener = function (entry, listener) {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            this._nativeSkeleton.setTrackEventListener(entry, listener);
        }
    };

    skeletonProto.getState = function () {
        if (this._nativeSkeleton && !this.isAnimationCached()) {
            return this._nativeSkeleton.getState();
        }
        return null;
    };

    skeletonProto._updateSkeletonData = function () {
        if (!this.skeletonData) {
            if (this._nativeSkeleton) {
                this._nativeSkeleton.stopSchedule();
                this._nativeSkeleton._comp = null;
                this._nativeSkeleton = null;
            }
            this.disableRender();
            return;
        }

        let runtimeData = this.skeletonData.getRuntimeData();
        if (!runtimeData) {
            this.disableRender();
            return;
        }

        this.setSkeletonData(this.skeletonData);
        this.attachUtil.init(this);
        this.attachUtil._associateAttachedNode();
        this._preCacheMode = this._cacheMode;
        this._applyConfiguredSkins();
        this.animation = this.defaultAnimation;
    };

    skeletonProto.onDestroy = function () {
        jsOnDestroy.call(this);
        if (this._nativeSkeleton) {
            this._nativeSkeleton.stopSchedule();
            this._nativeSkeleton._comp = null;
            this._nativeSkeleton = null;
        }
        this._stateData = null;
        this._materialCache = null;
    };
}
