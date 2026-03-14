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

        if (CC_JSB && this._skeletonCache) {
            let skins = this._skeletonCache.skins || [];
            let animations = this._skeletonCache.animations || [];
            let firstSkin = skins[0] && skins[0].name;
            let firstAnim = animations[0] && animations[0].name;
            cc.log('[sp4][jsb] parsed skeleton data. skins:', skins.length, 'animations:', animations.length, 'firstSkin:', firstSkin, 'firstAnim:', firstAnim);
        }

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

        if (CC_JSB && !_global.__sp4DebugFlags.textureMissLogged) {
            _global.__sp4DebugFlags.textureMissLogged = true;
            cc.log('[sp4][jsb] _getTexture miss for line:', line, 'textureNames:', (this.textureNames || []).join(','));
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

let nativeSpine4 = _global.spine4;
let nativeMiddleware = _global.middleware;
let jsbTextureIndex = 1;
let jsbTextureKeyMap = {};
let jsbTextureMap = new WeakMap();

function applyNativeSkeletonBounds (asset, skeletonData) {
    if (!skeletonData) {
        return;
    }

    if (typeof skeletonData.getWidth === 'function') {
        asset.width = skeletonData.getWidth();
    }
    if (typeof skeletonData.getHeight === 'function') {
        asset.height = skeletonData.getHeight();
    }
    if (typeof skeletonData.getX === 'function') {
        asset.x = skeletonData.getX();
    }
    if (typeof skeletonData.getY === 'function') {
        asset.y = skeletonData.getY();
    }
}

function normalizeNativeTextureKey (value) {
    return (value || '').trim().replace(/\\/g, '/');
}

function stripNativeTextureExt (value) {
    return value.replace(/\.[^/.]+$/, '');
}

function registerNativeTextureAlias (targetMap, key, texture) {
    if (!key || targetMap[key]) {
        return;
    }
    targetMap[key] = texture;
}

function isBinarySkeletonPath (value) {
    let normalized = normalizeNativeTextureKey(value).toLowerCase();
    return normalized.endsWith('.skel') || normalized.endsWith('.bin');
}

function isJsonSkeletonPath (value) {
    return normalizeNativeTextureKey(value).toLowerCase().endsWith('.json');
}

function resolveNativeSkeletonPath (path) {
    let normalized = normalizeNativeTextureKey(path);
    if (!normalized) {
        return '';
    }

    if (!(_global.jsb && _global.jsb.fileUtils)) {
        return normalized;
    }

    let fileUtils = _global.jsb.fileUtils;
    if (typeof fileUtils.isFileExist === 'function' && fileUtils.isFileExist(normalized)) {
        return normalized;
    }

    if (typeof fileUtils.fullPathForFilename === 'function') {
        let fullPath = fileUtils.fullPathForFilename(normalized);
        if (fullPath && fullPath !== normalized) {
            if (typeof fileUtils.isFileExist !== 'function' || fileUtils.isFileExist(fullPath)) {
                return fullPath;
            }
        }
    }

    return normalized;
}

function normalizeNativeInheritMode (value) {
    if (typeof value !== 'string') {
        return '';
    }

    let normalized = value.trim().toLowerCase();
    if (!normalized) {
        return '';
    }

    switch (normalized) {
    case 'normal':
        return 'normal';
    case 'onlytranslation':
        return 'onlyTranslation';
    case 'norotationorreflection':
        return 'noRotationOrReflection';
    case 'noscale':
        return 'noScale';
    case 'noscaleorreflection':
        return 'noScaleOrReflection';
    default:
        return '';
    }
}

function applyNativeBoneInheritCompat (json, dryRun) {
    if (!json || !Array.isArray(json.bones) || json.bones.length === 0) {
        return false;
    }

    let patched = false;
    for (let i = 0; i < json.bones.length; i++) {
        let bone = json.bones[i];
        if (!bone || typeof bone !== 'object') {
            continue;
        }

        let inheritValue = bone.inherit;
        let normalizedInherit = normalizeNativeInheritMode(inheritValue);
        if (normalizedInherit && inheritValue !== normalizedInherit) {
            if (!dryRun) {
                bone.inherit = normalizedInherit;
            }
            patched = true;
        }

        if (bone.inherit == null && typeof bone.transform === 'string') {
            let normalizedTransform = normalizeNativeInheritMode(bone.transform);
            if (normalizedTransform) {
                if (!dryRun) {
                    bone.inherit = normalizedTransform;
                }
                patched = true;
            }
        }
    }

    return patched;
}

function getNativeCompatibleSkeletonJsonString (skeletonJson) {
    if (!skeletonJson) {
        return '';
    }

    let nativeJson = skeletonJson;
    let patched = false;

    let spineVersion = skeletonJson.skeleton && skeletonJson.skeleton.spine;
    if (typeof spineVersion === 'string' && /^4\./.test(spineVersion) && !/^4\.2(\.|$)/.test(spineVersion)) {
        nativeJson = JSON.parse(JSON.stringify(skeletonJson));
        if (nativeJson.skeleton) {
            nativeJson.skeleton.spine = '4.2.00';
            patched = true;
        }
    }

    let needsBoneInheritPatch = applyNativeBoneInheritCompat(nativeJson, true);
    if (needsBoneInheritPatch) {
        if (nativeJson === skeletonJson) {
            nativeJson = JSON.parse(JSON.stringify(skeletonJson));
        }
        applyNativeBoneInheritCompat(nativeJson, false);
        patched = true;
    }

    return {
        text: JSON.stringify(nativeJson),
        patched,
        originalVersion: spineVersion || '',
    };
}

function getNativeCompatibleJsonText (jsonText) {
    if (!jsonText || typeof jsonText !== 'string') {
        return {
            text: jsonText || '',
            patched: false,
            originalVersion: '',
        };
    }

    try {
        let json = JSON.parse(jsonText);
        let boneInheritPatched = applyNativeBoneInheritCompat(json);
        if (json && json.skeleton && typeof json.skeleton.spine === 'string') {
            let spineVersion = json.skeleton.spine;
            if (/^4\./.test(spineVersion) && !/^4\.2(\.|$)/.test(spineVersion)) {
                json.skeleton.spine = '4.2.00';
                return {
                    text: JSON.stringify(json),
                    patched: true,
                    originalVersion: spineVersion,
                };
            }
            return {
                text: boneInheritPatched ? JSON.stringify(json) : jsonText,
                patched: boneInheritPatched,
                originalVersion: spineVersion,
            };
        }

        if (boneInheritPatched) {
            return {
                text: JSON.stringify(json),
                patched: true,
                originalVersion: '',
            };
        }
    } catch (e) {
    }

    return {
        text: jsonText,
        patched: false,
        originalVersion: '',
    };
}

function addNativeTextureAliases (targetMap, rawName, texture) {
    let normalized = normalizeNativeTextureKey(rawName);
    if (!normalized) {
        return;
    }

    let baseName = normalized.split('/').pop();
    let normalizedLower = normalized.toLowerCase();
    let baseLower = baseName.toLowerCase();
    let noExt = stripNativeTextureExt(normalized);
    let baseNoExt = stripNativeTextureExt(baseName);
    let noExtLower = noExt.toLowerCase();
    let baseNoExtLower = baseNoExt.toLowerCase();

    registerNativeTextureAlias(targetMap, rawName, texture);
    registerNativeTextureAlias(targetMap, normalized, texture);
    registerNativeTextureAlias(targetMap, baseName, texture);
    registerNativeTextureAlias(targetMap, normalizedLower, texture);
    registerNativeTextureAlias(targetMap, baseLower, texture);
    registerNativeTextureAlias(targetMap, noExt, texture);
    registerNativeTextureAlias(targetMap, baseNoExt, texture);
    registerNativeTextureAlias(targetMap, noExtLower, texture);
    registerNativeTextureAlias(targetMap, baseNoExtLower, texture);
}

function collectAtlasPageNames (atlasText) {
    let pageNames = [];
    if (!atlasText) {
        return pageNames;
    }

    let lines = atlasText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = (lines[i] || '').trim();
        if (!line || line.indexOf(':') !== -1) {
            continue;
        }

        let next = i + 1 < lines.length ? (lines[i + 1] || '').trim() : '';
        if (next.indexOf('size:') === 0) {
            pageNames.push(line);
        }
    }

    return pageNames;
}

if (CC_JSB && CC_NATIVERENDERER && nativeSpine4 && nativeMiddleware && typeof nativeSpine4.initSkeletonData === 'function') {
    let jsGetRuntimeData = SkeletonData.prototype.getRuntimeData;
    let jsReset = SkeletonData.prototype.reset;
    let jsDestroy = SkeletonData.prototype.destroy;

    SkeletonData.prototype.recordTexture = function (texture) {
        let index = jsbTextureIndex++;
        let key = jsbTextureKeyMap[index] = { key: index };
        jsbTextureMap.set(key, texture);
        return index;
    };

    SkeletonData.prototype.getTextureByIndex = function (textureIndex) {
        let key = jsbTextureKeyMap[textureIndex];
        if (!key) {
            return null;
        }
        return jsbTextureMap.get(key) || null;
    };

    SkeletonData.prototype.reset = function () {
        if (this._skeletonCache && typeof nativeSpine4.disposeSkeletonData === 'function' && this._uuid) {
            nativeSpine4.disposeSkeletonData(this._uuid);
        }
        this._jsbTextures = null;
        jsReset.call(this);
    };

    SkeletonData.prototype.destroy = function () {
        if (this._skeletonCache && typeof nativeSpine4.disposeSkeletonData === 'function' && this._uuid) {
            nativeSpine4.disposeSkeletonData(this._uuid);
            this._skeletonCache = null;
        }
        this._jsbTextures = null;
        jsDestroy.call(this);
    };

    SkeletonData.prototype._initNativeSkeletonData = function (quiet) {
        if (this._skeletonCache) {
            return this._skeletonCache;
        }

        let uuid = this._uuid;
        if (!uuid) {
            if (!quiet) {
                cc.errorID(7504);
            }
            return null;
        }

        let retained = typeof nativeSpine4.retainSkeletonData === 'function' ? nativeSpine4.retainSkeletonData(uuid) : null;
        if (retained) {
            this._skeletonCache = retained;
            applyNativeSkeletonBounds(this, retained);
            return retained;
        }

        if (!this.atlasText) {
            if (!quiet) {
                cc.errorID(7508, this.name);
            }
            return null;
        }

        let textures = this.textures;
        let textureNames = this.textureNames;
        if (!(textures && textures.length > 0 && textureNames && textureNames.length > 0)) {
            if (!quiet) {
                cc.errorID(7507, this.name);
            }
            return null;
        }

        let jsbTextures = {};
        for (let i = 0; i < textures.length; ++i) {
            let texture = textures[i];
            if (!texture || typeof texture.getImpl !== 'function') {
                continue;
            }

            let textureIndex = this.recordTexture(texture);
            let nativeTexture = new nativeMiddleware.Texture2D();
            nativeTexture.setRealTextureIndex(textureIndex);
            nativeTexture.setPixelsWide(texture.width);
            nativeTexture.setPixelsHigh(texture.height);
            nativeTexture.setTexParamCallback(function (texIdx, minFilter, magFilter, wrapS, wrapT) {
                let realTexture = this.getTextureByIndex(texIdx);
                if (!realTexture) {
                    return;
                }
                realTexture.setFilters(minFilter, magFilter);
                realTexture.setWrapMode(wrapS, wrapT);
            }.bind(this));
            nativeTexture.setNativeTexture(texture.getImpl());
            addNativeTextureAliases(jsbTextures, textureNames[i], nativeTexture);
            addNativeTextureAliases(jsbTextures, texture.name, nativeTexture);
            addNativeTextureAliases(jsbTextures, texture.nativeUrl, nativeTexture);
        }

        let atlasPages = collectAtlasPageNames(this.atlasText);
        for (let i = 0; i < atlasPages.length; i++) {
            let texture = textures[Math.min(i, textures.length - 1)];
            if (!texture || typeof texture.getImpl !== 'function') {
                continue;
            }

            let pageName = atlasPages[i];
            let textureName = textureNames[i] || textureNames[0] || pageName;
            let pageTexture = jsbTextures[pageName] || jsbTextures[textureName];
            if (!pageTexture) {
                continue;
            }

            addNativeTextureAliases(jsbTextures, pageName, pageTexture);
        }

        this._jsbTextures = jsbTextures;

        if (CC_JSB && !_global.__sp4DebugFlags.nativeTextureAliasLogged) {
            _global.__sp4DebugFlags.nativeTextureAliasLogged = true;
            cc.log('[sp4][jsb] native texture aliases keys sample:', Object.keys(jsbTextures).slice(0, 30).join(','), 'atlasPages:', collectAtlasPageNames(this.atlasText).join(','));
        }

        let nativePath = resolveNativeSkeletonPath(this.nativeUrl || '');

        let filePath = '';
        let nativeVersionPatched = false;
        let originalSpineVersion = '';
        if (this.skeletonJson) {
            let nativeJson = getNativeCompatibleSkeletonJsonString(this.skeletonJson);
            filePath = nativeJson.text || '';
            nativeVersionPatched = !!nativeJson.patched;
            originalSpineVersion = nativeJson.originalVersion || '';
        } else if (isBinarySkeletonPath(nativePath)) {
            filePath = nativePath;
        } else if (isJsonSkeletonPath(nativePath)) {
            if (_global.jsb && _global.jsb.fileUtils && typeof _global.jsb.fileUtils.getStringFromFile === 'function') {
                filePath = _global.jsb.fileUtils.getStringFromFile(nativePath) || '';
            }
            if (!filePath && this.skeletonJsonStr) {
                filePath = this.skeletonJsonStr;
            }
            let nativeJsonText = getNativeCompatibleJsonText(filePath);
            filePath = nativeJsonText.text || filePath;
            nativeVersionPatched = nativeVersionPatched || !!nativeJsonText.patched;
            originalSpineVersion = originalSpineVersion || nativeJsonText.originalVersion || '';
        } else {
            filePath = nativePath;
        }

        if (!filePath) {
            if (!quiet) {
                cc.error('[sp4][jsb] Unable to resolve native skeleton init input for', this.name, 'nativePath:', nativePath);
            }
            return null;
        }

        if (CC_JSB && !_global.__sp4DebugFlags.nativeSkeletonInputLogged) {
            _global.__sp4DebugFlags.nativeSkeletonInputLogged = true;
            cc.log('[sp4][jsb] native skeleton input mode:', this.skeletonJson ? 'json-object' : (isBinarySkeletonPath(nativePath) ? 'binary-path' : (isJsonSkeletonPath(nativePath) ? 'json-file-content' : 'raw-string')), 'nativePath:', nativePath);
            if (nativeVersionPatched) {
                cc.log('[sp4][jsb] patched skeleton.spine version for native parse:', originalSpineVersion, '-> 4.2.00');
            }
        }

        this._skeletonCache = nativeSpine4.initSkeletonData(uuid, filePath, this.atlasText, jsbTextures, this.scale);
        applyNativeSkeletonBounds(this, this._skeletonCache);
        return this._skeletonCache;
    };

    SkeletonData.prototype.getRuntimeData = function (quiet) {
        let nativeData = this._initNativeSkeletonData(quiet);
        if (nativeData) {
            return nativeData;
        }
        return jsGetRuntimeData.call(this, quiet);
    };
}
