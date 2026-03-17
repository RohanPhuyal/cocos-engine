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

'use strict';

/*
 * Reference:
 * http://en.esotericsoftware.com/spine-json-format
 */

const Fs = require('fire-fs');
const Path = require('fire-path');
const Spine = require('../lib/spine');
let Spine4Runtime = null;

try {
    Spine4Runtime = require('../../spine4/lib/spine4');
}
catch (e) {
    Spine4Runtime = null;
}

const ATLAS_EXTS = ['.atlas', '.txt', '.atlas.txt', ''];
const SPINE_ENCODING = { encoding: 'utf-8' };

const CustomAssetMeta = Editor.metas['custom-asset'];
let Spine4Meta = null;

try {
    Spine4Meta = require('../../spine4/editor/spine4-meta');
    // Ensure spine4 meta is visible during importer selection in sessions where
    // the editor did not auto-register the spine4 package.
    if (Editor && Editor.metas && !Editor.metas.spine4) {
        Editor.metas.spine4 = Spine4Meta;
    }
}
catch (e) {
    Spine4Meta = null;
}

function getSpineMajorVersion (json) {
    if (json && json.skeleton && typeof json.skeleton.spine === 'string') {
        let major = parseInt(json.skeleton.spine.split('.')[0], 10);
        if (Number.isFinite(major)) {
            return major;
        }
    }
    return null;
}

function getRuntimeByJson (json) {
    let major = getSpineMajorVersion(json);
    if (major !== null && major >= 4 && Spine4Runtime) {
        return Spine4Runtime;
    }
    return Spine;
}

function getSkeletonDataAssetCtorByJson (json) {
    let major = getSpineMajorVersion(json);
    if (major !== null && major >= 4) {
        let _global = typeof window === 'undefined' ? global : window;
        _global.sp4 = _global.sp4 || {};
        if (!_global.sp4.SkeletonData) {
            try {
                require('../../spine4/skeleton-data.js');
            }
            catch (e) {
                return null;
            }
        }
        return _global.sp4.SkeletonData || null;
    }
    return sp.SkeletonData;
}

function shouldUseSpine4ImporterTag (json) {
    let major = getSpineMajorVersion(json);
    return major !== null &&
        major >= 4 &&
        !!Spine4Runtime &&
        !!(Editor && Editor.metas && Editor.metas.spine4);
}

function normalizeTextureUuid (value) {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        if (/^[0-9a-f-]{36}$/i.test(value)) {
            return value;
        }
        return Editor.assetdb.urlToUuid(value) || '';
    }

    if (typeof value === 'object') {
        if (typeof value.__uuid__ === 'string' && value.__uuid__) {
            return value.__uuid__;
        }
        if (typeof value._uuid === 'string' && value._uuid) {
            return value._uuid;
        }
        if (typeof value.uuid === 'string' && value.uuid) {
            return value.uuid;
        }
        if (typeof value.url === 'string' && value.url) {
            return Editor.assetdb.urlToUuid(value.url) || '';
        }
    }

    return '';
}

function normalizeTextureUuidList (value) {
    let list = Array.isArray(value) ? value : (value ? [value] : []);
    return list.map(normalizeTextureUuid).filter(Boolean);
}

function resolveTextureName (value) {
    if (!value) {
        return '';
    }

    let url = '';
    if (typeof value === 'string') {
        if (/^[0-9a-f-]{36}$/i.test(value)) {
            url = Editor.assetdb.uuidToUrl(value) || '';
        }
        else {
            url = value;
        }
    }
    else if (typeof value === 'object') {
        if (typeof value.url === 'string' && value.url) {
            url = value.url;
        }
        else if (typeof value.__uuid__ === 'string' && value.__uuid__) {
            url = Editor.assetdb.uuidToUrl(value.__uuid__) || '';
        }
        else if (typeof value._uuid === 'string' && value._uuid) {
            url = Editor.assetdb.uuidToUrl(value._uuid) || '';
        }
        else if (typeof value.uuid === 'string' && value.uuid) {
            url = Editor.assetdb.uuidToUrl(value.uuid) || '';
        }
    }

    if (!url) {
        return '';
    }

    url = url.split('?')[0].split('#')[0];
    return Path.basename(url);
}

function guessSiblingTextureUuids (skeletonPath) {
    const exts = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const base = Path.stripExt(skeletonPath);
    const names = [];
    const uuids = [];

    for (let i = 0; i < exts.length; i++) {
        let imgPath = base + exts[i];
        if (!Fs.existsSync(imgPath)) {
            continue;
        }
        let uuid = Editor.assetdb.fspathToUuid(imgPath);
        if (uuid) {
            uuids.push(uuid);
            names.push(Path.basename(imgPath));
        }
    }

    if (uuids.length === 0) {
        let dir = Path.dirname(skeletonPath);
        let files = [];
        try {
            files = Fs.readdirSync(dir);
        }
        catch (e) {
            files = [];
        }

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            let ext = Path.extname(file).toLowerCase();
            if (exts.indexOf(ext) === -1) {
                continue;
            }
            let imgPath = Path.join(dir, file);
            let uuid = Editor.assetdb.fspathToUuid(imgPath);
            if (!uuid) {
                continue;
            }
            uuids.push(uuid);
            names.push(file);
        }
    }

    return { uuids, names };
}

function searchAtlas (skeletonPath, callback) {
    skeletonPath = Path.stripExt(skeletonPath);

    function next (index) {
        var suffix = ATLAS_EXTS[index];
        var path = skeletonPath + suffix;
        Fs.exists(path, exists => {
            if (exists) {
                return callback(null, path);
            }
            else if (index + 1 < ATLAS_EXTS.length) {
                next(index + 1);
            }
            else {
                callback(new Error(`Can not find ${skeletonPath + ATLAS_EXTS[0]}`));
            }
        });
    }

    next(0);
}

function loadAtlasText (skeletonPath, callback) {
    searchAtlas(skeletonPath, (err, path) => {
        if (err) {
            return callback(err);
        }
        Fs.readFile(path, SPINE_ENCODING, (err, data) => {
            callback(err, {
                data: data,
                atlasPath: path
            });
        });
    });
}

// A dummy texture loader to record all textures in atlas
class TextureParser {
    constructor (atlasPath, runtime) {
        this.atlasPath = atlasPath;
        this.runtime = runtime || Spine;
        // array of loaded texture uuid
        this.textures = [];
        // array of corresponding line
        this.textureNames = [];
    }
    _createDummyTexture () {
        var tex = new this.runtime.Texture({});
        tex.setFilters = function() {};
        tex.setWraps = function() {};
        return tex;
    }
    load (line) {
        line = (line || '').trim().replace(/\\/g, '/');
        if (!line) {
            return null;
        }
        var base = Path.dirname(this.atlasPath);
        // Keep subfolder info if atlas line contains relative path.
        var candidate = Path.resolve(base, line);
        var fallback = Path.resolve(base, Path.basename(line));
        var path = candidate;
        var uuid = Editor.assetdb.fspathToUuid(path);
        if (!uuid && path !== fallback) {
            path = fallback;
            uuid = Editor.assetdb.fspathToUuid(path);
        }
        if (uuid) {
            console.log('UUID is initialized for "%s".', path);
            this.textures.push(uuid);
            this.textureNames.push(line);
            return this._createDummyTexture();
        }
        else if (!Fs.existsSync(path)) {
            Editor.error('Can not find texture "%s" for atlas "%s"', line, this.atlasPath);
            // Keep atlas parse alive so importer can fallback to manual/guessed textures.
            return this._createDummyTexture();
        }
        else {
            // AssetDB may call postImport more than once, we can get uuid in the next time.
            console.warn('WARN: UUID not yet initialized for "%s".', path);
            // Keep atlas parse alive so importer can fallback to manual textures.
            return this._createDummyTexture();
        }
    }
}

class SpineMeta extends CustomAssetMeta {
    constructor (assetdb) {
        super(assetdb);
        this.textures = [];
        this.textureNames = [];
        this.manualTextureOverride = false;
        this.scale = 1;
    }

    dests () {
        let rawPath = this._assetdb.uuidToFspath(this.uuid);
        let importPathNoExt = this._assetdb._uuidToImportPathNoExt(this.uuid);

        let jsonPath = importPathNoExt + '.json';
        let extname = Path.extname(rawPath);
        let nativePath = importPathNoExt + extname;
        return [jsonPath, nativePath];
    }

    // HACK - for inspector
    get texture () {
        if (!this.textures || !this.textures[0]) {
            return '';
        }
        let uuid = normalizeTextureUuid(this.textures[0]);
        if (!uuid) {
            return '';
        }
        return Editor.assetdb.uuidToUrl(uuid) || '';
    }
    set texture (value) {
        let uuid = normalizeTextureUuid(value);
        this.textures = uuid ? [uuid] : [];
        if (uuid) {
            let textureName = resolveTextureName(value) || 'texture';
            this.textureNames = [textureName];
            this.manualTextureOverride = true;
        }
        else {
            this.textureNames = [];
            this.manualTextureOverride = false;
        }
    }

    static version () { return '1.2.5'; }
    static defaultType () {
        return 'spine';
    }

    static validate (assetpath) {
        // handle binary file
        if (assetpath.endsWith(".skel")) {
            return true;
        }
        // TODO - import as a folder named '***.spine'
        var json;
        var text = Fs.readFileSync(assetpath, 'utf8');
        var fastTest = text.slice(0, 30);
        var maybe = ( fastTest.indexOf('slots') > 0 ||
                      fastTest.indexOf('skins') > 0 ||
                      fastTest.indexOf('events') > 0 ||
                      fastTest.indexOf('animations') > 0 ||
                      fastTest.indexOf('bones') > 0 ||
                      fastTest.indexOf('skeleton') > 0 ||
                      fastTest.indexOf('\"ik\"') > 0
                    );
        if (maybe) {
            try {
                json = JSON.parse(text);
            }
            catch (e) {
                return false;
            }
            if (!Array.isArray(json.bones)) {
                return false;
            }
            // Keep Spine meta as a stable fallback for both Spine 3.x and 4.x.
            // Runtime/asset ctor selection still routes 4.x data to spine4 classes
            // in _importJson via getRuntimeByJson/getSkeletonDataAssetCtorByJson.
            return true;
        }
        return false;
    }

    _initTexture (asset, fspath, runtime, cb) {
        loadAtlasText(fspath, (err, res) => {
            if (err) {
                return cb(err);
            }

            var db = this._assetdb;

            // Parse atlas with runtime matching skeleton version.
            var textureParser = new TextureParser(res.atlasPath, runtime);

            try {
                    new runtime.TextureAtlas(res.data, textureParser.load.bind(textureParser));
            }
            catch (err) {
                return cb(new Error(`Failed to load atlas file: "${res.atlasPath}". ${err.stack || err}`));
            }

            // If atlas texture auto-discovery fails, keep manually assigned texture from inspector.
            let textures = textureParser.textures;
            let textureNames = textureParser.textureNames;
            let manualTextures = normalizeTextureUuidList(this.textures);

            if (this.manualTextureOverride && manualTextures.length > 0) {
                textures = manualTextures;
                textureNames = this.textureNames && this.textureNames.length > 0 ? this.textureNames.slice() : ['texture'];
            }
            else if (textures.length === 0 && manualTextures.length > 0) {
                textures = manualTextures;
                // Keep at least one texture name entry so runtime lookup has a key.
                textureNames = this.textureNames && this.textureNames.length > 0 ? this.textureNames.slice() : ['texture'];
            }

            // Last fallback: infer texture from sibling image with same basename.
            if (textures.length === 0) {
                let guessed = guessSiblingTextureUuids(fspath);
                if (guessed.uuids.length > 0) {
                    textures = guessed.uuids;
                    textureNames = guessed.names;
                }
            }

            if (this.manualTextureOverride && manualTextures.length === 0) {
                this.manualTextureOverride = false;
            }

            this.textures = textures;
            this.textureNames = textureNames;
            asset.textures = textures.map(Editor.serialize.asAsset);
            asset.textureNames = textureNames;
            asset.atlasText = res.data;
            db.saveAssetToLibrary(this.uuid, asset);
            cb();
        });
    }

    _importJson (fspath, cb) {
        Fs.readFile(fspath, SPINE_ENCODING, (err, data) => {
            if (err) {
                return cb(err);
            }

            var json;
            try {
                json = JSON.parse(data);
            }
            catch (e) {
                return cb(e);
            }

            var runtime = getRuntimeByJson(json);
            var AssetCtor = getSkeletonDataAssetCtorByJson(json);
            if (!AssetCtor) {
                return cb(new Error('Can not resolve Spine4 SkeletonData asset class.'));
            }

            // Keep using the stable spine importer implementation, but stamp 4.x
            // assets as spine4 in generated meta when spine4 meta is available.
            if (shouldUseSpine4ImporterTag(json)) {
                this.importer = 'spine4';
                this.ver = '1.0.0';
            }
            else {
                this.importer = 'spine';
                this.ver = SpineMeta.version();
            }

            var asset = new AssetCtor();
            asset.name = Path.basenameNoExt(fspath);
            asset.skeletonJson = json;
            asset.scale = this.scale;

            this._initTexture(asset, fspath, runtime, cb);
        });
    }

    _importBinary (fspath, cb) {
        // import native asset
        // Since skel is not in the white list of the WeChat suffix, bin is used instead
        let extname = ".bin";
        let dest = this._assetdb._uuidToImportPathNoExt(this.uuid) + extname;
        Fs.copy(fspath, dest, err => {
            if (err) {
                return cb(err);
            }

            // import asset
            let asset = new sp.SkeletonData();
            asset.name = Path.basenameNoExt(fspath);
            asset._setRawAsset(extname);
            asset.scale = this.scale;

            this._initTexture(asset, fspath, Spine, cb);
        });
    }

    import (fspath, cb) {
        if (fspath.endsWith(".skel")) {
            this._importBinary(fspath, cb);
        } else {
            super.import(fspath, cb);
        }
    }

    postImport (fspath, cb) {
        if (!fspath.endsWith(".skel")) {
            this._importJson(fspath, cb);
        } else {
            cb();
        }
    }
}

module.exports = SpineMeta;
