/****************************************************************************
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

/**
 * @module sp
 */
var _global = typeof window === 'undefined' ? global : window;
_global.sp4 = _global.sp4 || {};
var sp4 = _global.sp4;
_global.__sp4DebugFlags = _global.__sp4DebugFlags || {};

// Ensure spine4 JS runtime namespace is available even if index.js load order differs.
// On JSB, global `spine4` may be the native helper namespace (init/dispose only),
// which does not expose Atlas constructors needed by the JS parser path.
if (!sp4.spine || (!sp4.spine.TextureAtlas && !sp4.spine.Atlas)) {
    sp4.spine = require('./lib/spine4');
}

let SkeletonCache = !CC_JSB && require('./skeleton-cache').sharedCache;

/**
 * !#en The skeleton data of spine.
 * !#zh Spine 的 骨骼数据。
 * @class SkeletonData
 * @extends Asset
 */
let SkeletonData = cc.Class({
    name: 'sp4.SkeletonData',
    extends: cc.Asset,

    ctor: function () {
        this.reset();
    },

    properties: {
        _skeletonJson: null,

        // use by jsb
        skeletonJsonStr: {
            get: function () {
                if (this._skeletonJson) {
                    return JSON.stringify(this._skeletonJson);
                } else {
                    return "";
                }
            }
        },

        /**
         * !#en See http://en.esotericsoftware.com/spine-json-format
         * !#zh 可查看 Spine 官方文档 http://zh.esotericsoftware.com/spine-json-format
         * @property {Object} skeletonJson
         */
        skeletonJson: {
            get: function () {
                return this._skeletonJson;
            },
            set: function (value) {
                this.reset();
                if (typeof(value) == "string") {
                    this._skeletonJson = JSON.parse(value);
                } else {
                    this._skeletonJson = value;
                }
                // If create by manual, uuid is empty.
                if (!this._uuid && value.skeleton) {
                    this._uuid = value.skeleton.hash;
                }
            }
        },

        _atlasText: "",

        /**
         * @property {String} atlasText
         */
        atlasText: {
            get: function () {
                return this._atlasText;
            },
            set: function (value) {
                this._atlasText = value;
                this.reset();
            }
        },

        /**
         * @property {Texture2D[]} textures
         */
        textures: {
            default: [],
            type: [cc.Texture2D]
        },

        /**
         * @property {String[]} textureNames
         * @private
         */
        textureNames: {
            default: [],
            type: [cc.String]
        },

        /**
         * !#en
         * A scale can be specified on the JSON or binary loader which will scale the bone positions,
         * image sizes, and animation translations.
         * This can be useful when using different sized images than were used when designing the skeleton
         * in Spine. For example, if using images that are half the size than were used in Spine,
         * a scale of 0.5 can be used. This is commonly used for games that can run with either low or high
         * resolution texture atlases.
         * see http://en.esotericsoftware.com/spine-using-runtimes#Scaling
         * !#zh 可查看 Spine 官方文档： http://zh.esotericsoftware.com/spine-using-runtimes#Scaling
         * @property {Number} scale
         */
        scale: 1,

        _nativeAsset: {
            get () {
                return this._buffer;
            },
            set (bin) {
                this._buffer = bin.buffer || bin;
                this.reset();
            },
            override: true
        },
    },

    statics: {
        preventDeferredLoadDependents: true,
    },

    // PUBLIC

    createNode: CC_EDITOR && function (callback) {
        let node = new cc.Node(this.name);
        let skeleton = node.addComponent(sp4.Skeleton);
        skeleton.skeletonData = this;

        return callback(null, node);
    },

    reset: function () {
        /**
         * @property {sp4.spine.SkeletonData} _skeletonData
         * @private
         */
        this._skeletonCache = null;
        /**
         * @property {sp4.spine.Atlas} _atlasCache
         * @private
         */
        this._atlasCache = null;
        if (CC_EDITOR) {
            this._skinsEnum = null;
            this._skinsEnumWithNone = null;
            this._animsEnum = null;
        }
    },

    ensureTexturesLoaded (loaded, caller) {
        let textures = this.textures; 
        let texsLen = textures.length;
        if (texsLen == 0) {
            loaded.call(caller, false);
            return;
        }
        let loadedCount = 0;
        let loadedItem = function () {
            loadedCount++;
            if (loadedCount >= texsLen) {
                loaded && loaded.call(caller, true);
                loaded = null;
            }
        }
        for (let i = 0; i < texsLen; i++) {
            let tex = textures[i];
            if (tex.loaded) {
                loadedItem();
            } else {
                tex.once('load', loadedItem);
            }
        }
    },

    isTexturesLoaded () {
        let textures = this.textures; 
        let texsLen = textures.length;
        for (let i = 0; i < texsLen; i++) {
            let tex = textures[i];
            if (!tex.loaded) {
                return false;
            }
        }
        return true;
    },

    /**
     * !#en Get the included SkeletonData used in spine runtime.<br>
     * Returns a {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.SkeletonData object.
     * !#zh 获取 Spine Runtime 使用的 SkeletonData。<br>
     * 返回一个 {{#crossLinkModule "sp4.spine"}}sp4.spine{{/crossLinkModule}}.SkeletonData 对象。
     * @method getRuntimeData
     * @param {Boolean} [quiet=false]
     * @return {sp4.spine.SkeletonData}
     */
    getRuntimeData: function (quiet) {
        if (CC_JSB && !_global.__sp4DebugFlags.runtimeDataLogged) {
            _global.__sp4DebugFlags.runtimeDataLogged = true;
            cc.log('[sp4][jsb] getRuntimeData called. textures:', this.textures && this.textures.length, 'textureNames:', this.textureNames && this.textureNames.length, 'hasSkeletonJson:', !!this.skeletonJson);
        }
        if (this._skeletonCache) {
            return this._skeletonCache;
        }

        // NOTE: JSB native initSkeletonData path is currently disabled for spine4.
        // It expects middleware::Texture2D native objects and can assert in CCMap::insert
        // when receiving invalid texture entries from JS. Use the runtime JS parser path below.

        if ( !(this.textures && this.textures.length > 0) && this.textureNames && this.textureNames.length > 0 ) {
            if ( !quiet ) {
                cc.errorID(7507, this.name);
            }
            return null;
        }

        let atlas = this._getAtlas(quiet);
        if (! atlas) {
            return null;
        }
        let attachmentLoader = new sp4.spine.AtlasAttachmentLoader(atlas);

        let resData = null;
        let reader = null;
        if (this.skeletonJson) {
            reader = new sp4.spine.SkeletonJson(attachmentLoader);
            resData = this.skeletonJson;
        } else {
            reader = new sp4.spine.SkeletonBinary(attachmentLoader);
            resData = new Uint8Array(this._nativeAsset);
        }

        reader.scale = this.scale;
        this._skeletonCache = reader.readSkeletonData(resData);

        return this._skeletonCache;
    },

    // EDITOR

    getSkinsEnum: CC_EDITOR && function (includeNone) {
        if (includeNone && this._skinsEnumWithNone) {
            return this._skinsEnumWithNone;
        }
        if (!includeNone && this._skinsEnum) {
            return this._skinsEnum;
        }
        let sd = this.getRuntimeData(true);
        if (sd) {
            let skins = sd.skins;
            let enumDef = includeNone ? { '<None>': 0 } : {};
            for (let i = 0; i < skins.length; i++) {
                let name = skins[i].name;
                enumDef[name] = includeNone ? i + 1 : i;
            }
            if (includeNone) {
                return this._skinsEnumWithNone = cc.Enum(enumDef);
            }
            return this._skinsEnum = cc.Enum(enumDef);
        }
        return null;
    },

    getAnimsEnum: CC_EDITOR && function () {
        if (this._animsEnum) {
            return this._animsEnum;
        }
        let sd = this.getRuntimeData(true);
        if (sd) {
            let enumDef = { '<None>': 0 };
            let anims = sd.animations;
            for (let i = 0; i < anims.length; i++) {
                let name = anims[i].name;
                enumDef[name] = i + 1;
            }
            return this._animsEnum = cc.Enum(enumDef);
        }
        return null;
    },

    // PRIVATE

    _getTexture: function (line, allowSingleFallback) {
        let normalize = function (value) {
            return (value || '').trim().replace(/\\/g, '/').toLowerCase();
        };
        let getBase = function (value) {
            let normalized = normalize(value);
            return normalized && normalized.split('/').pop();
        };
        let stripExt = function (value) {
            return (value || '').replace(/\.[^/.]+$/, '');
        };

        let target = normalize(line);
        let targetBase = getBase(line);
        let targetNoExt = stripExt(target);
        let targetBaseNoExt = stripExt(targetBase);

        let names = this.textureNames || [];
        let textures = this.textures || [];
        for (let i = 0; i < names.length; i++) {
            let current = normalize(names[i]);
            let currentBase = getBase(names[i]);
            let currentNoExt = stripExt(current);
            let currentBaseNoExt = stripExt(currentBase);

            let matched = current === target ||
                currentBase === targetBase ||
                currentNoExt === targetNoExt ||
                currentBaseNoExt === targetBaseNoExt;

            if (matched && textures[i]) {
                let texture = textures[i];
                let tex = new sp4.SkeletonTexture({ width: texture.width, height: texture.height });
                tex.setRealTexture(texture);
                return tex;
            }
        }

        // Optional fallback only when atlas is single-page and only one texture is assigned.
        if (allowSingleFallback && textures.length === 1 && textures[0]) {
            let texture = textures[0];
            let tex = new sp4.SkeletonTexture({ width: texture.width, height: texture.height });
            tex.setRealTexture(texture);
            return tex;
        }

        cc.errorID(7506, line);
        return null;
    },

    /**
     * @method _getAtlas
     * @param {boolean} [quiet=false]
     * @return {sp4.spine.Atlas}
     * @private
     */
    _getAtlas: function (quiet) {
        if (this._atlasCache) {
            return this._atlasCache;
        }

        if ( !this.atlasText ) {
            if ( !quiet ) {
                cc.errorID(7508, this.name);
            }
            return null;
        }

        // Spine4's TextureAtlas constructor only takes atlasText — it no longer
        // accepts a loader callback like Spine3 did. Textures must be assigned
        // per-page after construction.
        let AtlasCtor = sp4.spine.TextureAtlas || sp4.spine.Atlas;
        if (!AtlasCtor) {
            let runtimeSpine4 = require('./lib/spine4');
            if (runtimeSpine4 && runtimeSpine4.default) {
                runtimeSpine4 = runtimeSpine4.default;
            }
            if (runtimeSpine4) {
                sp4.spine = runtimeSpine4;
                AtlasCtor = sp4.spine.TextureAtlas || sp4.spine.Atlas;
            }
        }
        if (!AtlasCtor) {
            if (CC_JSB && !_global.__sp4DebugFlags.atlasCtorMissingLogged) {
                _global.__sp4DebugFlags.atlasCtorMissingLogged = true;
                cc.log('[sp4][jsb] Atlas ctor missing. spine keys sample:', sp4.spine ? Object.keys(sp4.spine).slice(0, 20) : 'no sp4.spine');
            }
            if (!quiet) {
                cc.error('sp4.spine.TextureAtlas and sp4.spine.Atlas are both unavailable.');
            }
            return null;
        }

        let atlas = new AtlasCtor(this.atlasText);
        let singlePageAtlas = atlas.pages.length === 1;
        for (let i = 0; i < atlas.pages.length; i++) {
            let page = atlas.pages[i];
            let tex = this._getTexture(page.name, singlePageAtlas);
            if (tex) {
                page.setTexture(tex);
            }
        }
        return this._atlasCache = atlas;
    },

    destroy () {
        let nativeSpine4 = sp4.spine || _global.spine4;
        if (CC_JSB && nativeSpine4 && typeof nativeSpine4.disposeSkeletonData === 'function') {
            nativeSpine4.disposeSkeletonData(this._uuid);
        }
        else if (SkeletonCache) {
            SkeletonCache.removeSkeleton(this._uuid);
        }
        this._super();
    },
});

sp4.SkeletonData = module.exports = SkeletonData;
