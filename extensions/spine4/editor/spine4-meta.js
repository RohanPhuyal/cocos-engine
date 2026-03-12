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
 * Spine 4.x importer (completely independent from Spine 3.x)
 * Reference:
 * http://en.esotericsoftware.com/spine-json-format
 */

const Fs = require('fire-fs');
const Path = require('fire-path');
const Spine4Runtime = require('../lib/spine4');

const ATLAS_EXTS = ['.atlas', '.txt', '.atlas.txt', ''];
const SPINE_ENCODING = { encoding: 'utf-8' };

const CustomAssetMeta = Editor.metas['custom-asset'];

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
    constructor (atlasPath) {
        this.atlasPath = atlasPath;
        // array of loaded texture uuid
        this.textures = [];
        // array of corresponding line
        this.textureNames = [];
    }
    load (line) {
        line = (line || '').trim().replace(/\\/g, '/');
        if (!line) {
            return null;
        }
        var base = Path.dirname(this.atlasPath);
        var candidate = Path.resolve(base, line);
        var fallback = Path.resolve(base, Path.basename(line));
        var path = candidate;
        var uuid = Editor.assetdb.fspathToUuid(path);
        if (!uuid && path !== fallback) {
            path = fallback;
            uuid = Editor.assetdb.fspathToUuid(path);
        }
        if (uuid) {
            console.log('[Spine4-Meta] UUID is initialized for "%s".', path);
            this.textures.push(uuid);
            this.textureNames.push(line);
            var tex = new Spine4Runtime.Texture({});
            tex.setFilters = function() {};
            tex.setWraps = function() {};
            return tex;
        }
        else if (!Fs.existsSync(path)) {
            Editor.error('[Spine4-Meta] Can not find texture "%s" for atlas "%s"', line, this.atlasPath);
        }
        else {
            // AssetDB may call postImport more than once, we can get uuid in the next time.
            console.warn('[Spine4-Meta] WARN: UUID not yet initialized for "%s".', path);
        }

        return null;
    }
}

class Spine4Meta extends CustomAssetMeta {
    constructor (assetdb) {
        super(assetdb);
        this.textures = [];
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
        return Editor.assetdb.uuidToUrl(this.textures[0]) || '';
    }
    set texture (value) {
        let uuid = normalizeTextureUuid(value);
        this.textures = uuid ? [uuid] : [];
        if (uuid && (!this.textureNames || this.textureNames.length === 0)) {
            this.textureNames = ['texture'];
        }
    }

    static version () { return '1.0.0'; }
    static defaultType () {
        return 'spine4';
    }

    static validate (assetpath) {
        // handle binary file
        if (assetpath.endsWith(".skel")) {
            return true;
        }
        // TODO - import as a folder named '***.spine4'
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
            // Validate that it has bones AND is Spine 4.x
            if (Array.isArray(json.bones)) {
                // Check if it's Spine 4.x format
                if (json.skeleton && typeof json.skeleton.spine === 'string') {
                    let majorVersion = parseInt(json.skeleton.spine.split('.')[0], 10);
                    if (majorVersion >= 4) {
                        console.log('[Spine4-Meta] Validating Spine 4.x file:', assetpath);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    _initTexture (asset, fspath, cb) {
        loadAtlasText(fspath, (err, res) => {
            if (err) {
                return cb(err);
            }

            var db = this._assetdb;

            // parse atlas textures using Spine4 runtime
            var textureParser = new TextureParser(res.atlasPath);

            try {
                console.log('[Spine4-Meta] Parsing atlas with Spine4 runtime');
                new Spine4Runtime.TextureAtlas(res.data, textureParser.load.bind(textureParser));
            }
            catch (err) {
                return cb(new Error(`[Spine4-Meta] Failed to load atlas file: "${res.atlasPath}". ${err.stack || err}`));
            }

            let textures = textureParser.textures;
            let textureNames = textureParser.textureNames;
            let manualTextures = (this.textures || [])
                .map(normalizeTextureUuid)
                .filter(Boolean);

            if (textures.length === 0 && manualTextures.length > 0) {
                textures = manualTextures;
                textureNames = this.textureNames && this.textureNames.length > 0 ? this.textureNames.slice() : ['texture'];
            }

            if (textures.length === 0) {
                let guessed = guessSiblingTextureUuids(fspath);
                if (guessed.uuids.length > 0) {
                    textures = guessed.uuids;
                    textureNames = guessed.names;
                }
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

            console.log('[Spine4-Meta] Importing Spine 4.x JSON:', fspath, '- spine version:', json.skeleton.spine || 'unknown');
            
            // Use Spine4 SkeletonData asset class from global namespace
            var asset = new sp4.SkeletonData();
            asset.name = Path.basenameNoExt(fspath);
            asset.skeletonJson = json;
            asset.scale = this.scale;

            this._initTexture(asset, fspath, cb);
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

            // import asset - use Spine4 SkeletonData from global namespace
            let asset = new sp4.SkeletonData();
            asset.name = Path.basenameNoExt(fspath);
            asset._setRawAsset(extname);
            asset.scale = this.scale;

            this._initTexture(asset, fspath, cb);
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

module.exports = Spine4Meta;
