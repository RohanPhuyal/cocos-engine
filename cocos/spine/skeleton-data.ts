/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { EDITOR_NOT_IN_PREVIEW } from 'internal:constants';
import { CCString, Enum, error, murmurhash2_32_gc } from '../core';
import SkeletonCache from './skeleton-cache';
import { Skeleton } from './skeleton';
import spine from './lib/spine-core';
import spine4 from '../spine4/lib/spine-core';
import '../spine4/lib/instantiated';
import { ccclass, serializable, type } from '../core/data/decorators';
import { legacyCC } from '../core/global-exports';
import { Texture2D, Asset } from '../asset/assets';
import { Node } from '../scene-graph';

type SpineWasmUtilLike = {
    querySpineSkeletonDataByUUID: (uuid: string) => spine.SkeletonData | null;
    createSpineSkeletonDataWithJson: (json: string, atlasText: string, textureNames: string[], textureUUIDs: string[]) => spine.SkeletonData | null;
    createStoreMemory: (byteSize: number) => number;
    wasm: { HEAPU8: Uint8Array };
    createSpineSkeletonDataWithBinary: (byteSize: number, atlasText: string, textureNames: string[], textureUUIDs: string[]) => spine.SkeletonData | null;
    freeStoreMemory: () => void;
    registerSpineSkeletonDataWithUUID: (data: spine.SkeletonData, uuid: string) => void;
    destroySpineSkeletonDataWithUUID: (uuid: string) => void;
};

function extractSpineVersionFromJsonText (jsonText: string): string | undefined {
    if (!jsonText) {
        return undefined;
    }

    const match = /"spine"\s*:\s*"([^"]+)"/.exec(jsonText);
    if (match && match[1]) {
        return match[1];
    }

    return undefined;
}

function detectSpineVersionFromAtlasText (atlasText?: string): string | undefined {
    if (!atlasText) {
        return undefined;
    }

    const hasSpine4Markers = /(^|\n)\s*(bounds|offsets)\s*:/m.test(atlasText);
    if (hasSpine4Markers) {
        return '4.0.0';
    }

    const hasSpine3Markers = /(^|\n)\s*(xy|orig|offset)\s*:/m.test(atlasText);
    if (hasSpine3Markers) {
        return '3.8.0';
    }

    return undefined;
}

function detectSpineVersion (skeletonJson: spine.SkeletonJson | null, nativeAsset?: ArrayBuffer, atlasText?: string): string | undefined {
    const jsonVersion = (skeletonJson as any)?.skeleton?.spine as string | undefined;
    if (jsonVersion) {
        return jsonVersion;
    }

    if (skeletonJson) {
        const fromJsonText = extractSpineVersionFromJsonText(JSON.stringify(skeletonJson));
        if (fromJsonText) {
            return fromJsonText;
        }
    }

    if (nativeAsset && nativeAsset.byteLength > 0) {
        try {
            const bytes = new Uint8Array(nativeAsset);
            const maxLen = Math.min(bytes.length, 2048);
            let textHead = '';
            for (let i = 0; i < maxLen; ++i) {
                textHead += String.fromCharCode(bytes[i]);
            }
            const fromNativeText = extractSpineVersionFromJsonText(textHead);
            if (fromNativeText) {
                return fromNativeText;
            }
        } catch {
            // Ignore parsing errors and fallback to default runtime.
        }
    }

    const fromAtlasText = detectSpineVersionFromAtlasText(atlasText);
    if (fromAtlasText) {
        return fromAtlasText;
    }

    return undefined;
}

function normalizeNativeInheritMode (value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }

    const normalized = value.trim().toLowerCase();
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

function applyNativeBoneInheritCompat (json: any, dryRun = false): boolean {
    if (!json || !Array.isArray(json.bones) || json.bones.length === 0) {
        return false;
    }

    let patched = false;
    for (let i = 0; i < json.bones.length; i++) {
        const bone = json.bones[i];
        if (!bone || typeof bone !== 'object') {
            continue;
        }

        const inheritValue = bone.inherit;
        const normalizedInherit = normalizeNativeInheritMode(inheritValue);
        if (normalizedInherit && inheritValue !== normalizedInherit) {
            if (!dryRun) {
                bone.inherit = normalizedInherit;
            }
            patched = true;
        }

        if (bone.inherit == null && typeof bone.transform === 'string') {
            const normalizedTransform = normalizeNativeInheritMode(bone.transform);
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

function getRuntimeCompatibleSpine4JsonString (skeletonJson: spine.SkeletonJson): string {
    if (!skeletonJson) {
        return '';
    }

    let runtimeJson: any = skeletonJson;
    let patched = false;
    const spineVersion = runtimeJson?.skeleton?.spine as string | undefined;

    if (typeof spineVersion === 'string' && /^4\./.test(spineVersion) && !/^4\.2(\.|$)/.test(spineVersion)) {
        runtimeJson = JSON.parse(JSON.stringify(skeletonJson));
        if (runtimeJson.skeleton) {
            runtimeJson.skeleton.spine = '4.2.00';
            patched = true;
        }
    }

    const needsBoneInheritPatch = applyNativeBoneInheritCompat(runtimeJson, true);
    if (needsBoneInheritPatch) {
        if (runtimeJson === skeletonJson) {
            runtimeJson = JSON.parse(JSON.stringify(skeletonJson));
        }
        applyNativeBoneInheritCompat(runtimeJson, false);
        patched = true;
    }

    return patched ? JSON.stringify(runtimeJson) : JSON.stringify(skeletonJson);
}

function getSpineWasmUtilByVersion (version?: string): SpineWasmUtilLike {
    const useSpine4 = !!version && version.startsWith('4.');
    const runtime = useSpine4 ? spine4 : spine;
    const wasmUtil = runtime?.wasmUtil as SpineWasmUtilLike | undefined;
    if (wasmUtil) {
        return wasmUtil;
    }
    const globalRuntimeName = useSpine4 ? 'spine4' : 'spine';
    return (globalThis as Record<string, any>)[globalRuntimeName]?.wasmUtil as SpineWasmUtilLike;
}

function getCollectionLength (collection: any): number {
    if (!collection) {
        return 0;
    }
    if (typeof collection.length === 'number') {
        return collection.length;
    }
    if (typeof collection.size === 'function') {
        return collection.size();
    }
    return 0;
}

function getCollectionItem (collection: any, index: number): any {
    if (!collection) {
        return null;
    }
    if (typeof collection.get === 'function') {
        return collection.get(index);
    }
    return collection[index];
}

function getRuntimeItemName (item: any): string {
    if (!item) {
        return '';
    }
    if (item.name != null) {
        const name = String(item.name);
        if (name.length > 0 && name !== '[object Object]') {
            return name;
        }
    }
    if (typeof item.getName === 'function') {
        const value = item.getName();
        if (value != null) {
            const name = String(value);
            if (name.length > 0 && name !== '[object Object]') {
                return name;
            }
        }
    }
    const dataName = item.data?.name;
    if (dataName != null) {
        const name = String(dataName);
        if (name.length > 0 && name !== '[object Object]') {
            return name;
        }
    }
    return '';
}
/**
 * @en The skeleton data of spine.
 * @zh Spine 的骨骼数据。
 * @class SkeletonData
 * @extends Asset
 */
@ccclass('sp.SkeletonData')
export class SkeletonData extends Asset {
    /**
     * @en See http://en.esotericsoftware.com/spine-json-format
     * @zh 可查看 Spine 官方文档 http://zh.esotericsoftware.com/spine-json-format
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    @serializable
    public _skeletonJson: spine.SkeletonJson | null = null;

    /**
     * @en A string parsed from the _skeletonJson.
     * @zh 从 _skeletonJson 中解析出的字符串。
     */
    get skeletonJsonStr (): string {
        if (this._skeletonJson) {
            return JSON.stringify(this._skeletonJson);
        }
        return '';
    }

    /**
     * @en See http://en.esotericsoftware.com/spine-json-format
     * @zh 可查看 Spine 官方文档 http://zh.esotericsoftware.com/spine-json-format
     */
    get skeletonJson (): spine.SkeletonJson {
        return this._skeletonJson!;
    }
    set skeletonJson (value: spine.SkeletonJson) {
        this.reset();
        if (typeof (value) === 'string') {
            this._skeletonJson = JSON.parse(value);
        } else {
            this._skeletonJson = value;
        }
        // If create by manual, uuid is empty.
        if (!this._uuid && (value as any).skeleton) {
            this._uuid = (value as any).skeleton.hash;
        }
    }

    /**
     * @en An atlas text description.
     * @zh Atlas 文本描述。
     */
    get atlasText (): string {
        return this._atlasText;
    }
    set atlasText (value) {
        this._atlasText = value;
        this.reset();
    }

    /**
     * @en Texture array.
     * @zh 纹理数组。
     */
    @serializable
    @type([Texture2D])
    public textures: Texture2D[] = [];

    /**
     * @en Texture name array.
     * @zh 纹理名称数组。
     * @private
     */
    @serializable
    @type([CCString])
    public textureNames: string[] = [];

    /**
     * @en
     * A scale can be specified on the JSON or binary loader which will scale the bone positions,
     * image sizes, and animation translations.
     * This can be useful when using different sized images than were used when design ing the skeleton
     * in Spine. For example, if using images that are half the size than were used in Spine,
     * a scale of 0.5 can be used. This is commonly used for games that can run with either low or high
     * resolution texture atlases.
     * see http://en.esotericsoftware.com/spine-using-runtimes#Scaling
     * @zh 在 JSON 或二进制加载器上可以指定一个缩放比例，该缩放比例将缩放骨头位置、图像大小和动画平移。
     * 这在使用与 Spine 中设计骨架不同大小的图像时非常有用。例如，如果使用的图像大小是 Spine 中使用的
     * 图像大小的一半，可以使用 0.5 的缩放比例。这在游戏中经常使用，因为游戏可以使用低分辨率或高分辨率
     * 的纹理图集。可查看 Spine 官方文档：
     * http://zh.esotericsoftware.com/spine-using-runtimes#Scaling
     */
    @serializable
    public scale = 1;

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    get _nativeAsset (): ArrayBuffer {
        return this._buffer!;
    }
    set _nativeAsset (bin: ArrayBuffer) {
        this._buffer = bin;
        this.reset();
    }
    /**
     * @en A string describing atlas.
     * @zh 描述图集信息的字符串。
     */
    @serializable
    protected _atlasText = '';

    private _buffer?: ArrayBuffer;

    private _skeletonCache: spine.SkeletonData | null = null;

    private _skinsEnum: { [key: string]: number } | null = null;
    private _animsEnum: { [key: string]: number } | null = null;
    private _skinsEnumVersion: '3' | '4' | null = null;
    private _animsEnumVersion: '3' | '4' | null = null;

    constructor () {
        super();
        this.reset();
    }

    /**
     * @internal
     * @deprecated Since v3.7.2, this is an engine private interface that will be removed in the future.
     */
    public createNode (callback: (err: Error|null, node: Node) => void): void {
        const node = new Node(this.name);
        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset, this._atlasText);
        let useSpine4 = !!spineVersion && spineVersion.startsWith('4.');
        if (!spineVersion) {
            const runtimeData = this.getRuntimeData(true);
            const spine4Ctor = (spine4 as any).SkeletonData as (new (...args: any[]) => any) | undefined;
            const spine3Ctor = (spine as any).SkeletonData as (new (...args: any[]) => any) | undefined;
            if (spine4Ctor && runtimeData instanceof spine4Ctor) {
                useSpine4 = true;
            } else if (spine3Ctor && runtimeData instanceof spine3Ctor) {
                useSpine4 = false;
            }
        }
        const componentName = useSpine4 ? 'sp4.Skeleton' : 'cc.Skeleton';
        const skeleton = node.addComponent(componentName) as Skeleton;
        skeleton.skeletonData = this;

        return callback(null, node);
    }
    /**
     * @en Resets skeleton data state.
     * @zh 重置数据。
     */
    public reset (): void {
        this._skeletonCache = null;
        this._skinsEnum = null;
        this._animsEnum = null;
        this._skinsEnumVersion = null;
        this._animsEnumVersion = null;
    }
    /**
     * @internal Since v3.7.2, this is an engine private function, only works in editor.
     * @en Reset skeleton skin and animation enumeration.
     * @zh 重置皮肤和动画枚举。
     */
    public resetEnums (): void {
        this._skinsEnum = null;
        this._animsEnum = null;
        this._skinsEnumVersion = null;
        this._animsEnumVersion = null;
    }

    private _getSpineMajorVersion (): '3' | '4' {
        const version = detectSpineVersion(this._skeletonJson, this._nativeAsset, this._atlasText);
        if (version?.startsWith('4.')) {
            return '4';
        }
        if (version?.startsWith('3.')) {
            return '3';
        }
        const runtimeData = this.getRuntimeData(true);
        const spine4Ctor = (spine4 as any).SkeletonData as (new (...args: any[]) => any) | undefined;
        if (spine4Ctor && runtimeData instanceof spine4Ctor) {
            return '4';
        }
        return '3';
    }

    private _buildSkinsEnum (): { [key: string]: number } | null {
        const sd = this.getRuntimeData(true);
        if (!sd) {
            return null;
        }
        const skins = sd.skins;
        const enumDef: {[key: string]: number} = {};
        const skinCount = getCollectionLength(skins);
        for (let i = 0; i < skinCount; i++) {
            const skin = getCollectionItem(skins, i);
            const name = getRuntimeItemName(skin);
            if (!name) {
                continue;
            }
            enumDef[name] = i;
        }
        if (Object.keys(enumDef).length === 0) {
            return null;
        }
        return Enum(enumDef);
    }

    private _buildAnimsEnum (): { [key: string]: number } | null {
        const sd = this.getRuntimeData(true);
        if (!sd) {
            return null;
        }
        const enumDef: {[key: string]: number} = { '<None>': 0 };
        const anims = sd.animations;
        const animCount = getCollectionLength(anims);
        for (let i = 0; i < animCount; i++) {
            const anim = getCollectionItem(anims, i);
            const name = getRuntimeItemName(anim);
            if (!name) {
                continue;
            }
            enumDef[name] = i + 1;
        }
        return Enum(enumDef);
    }

    public getSkinsEnumForSpine3 (): { [key: string]: number } | null {
        if (this._skinsEnum && this._skinsEnumVersion === '3') {
            return this._skinsEnum;
        }
        const enumDef = this._buildSkinsEnum();
        if (!enumDef) {
            return null;
        }
        this._skinsEnum = enumDef;
        this._skinsEnumVersion = '3';
        return this._skinsEnum;
    }

    public getSkinsEnumForSpine4 (): { [key: string]: number } | null {
        if (this._skinsEnum && this._skinsEnumVersion === '4') {
            return this._skinsEnum;
        }
        const enumDef = this._buildSkinsEnum();
        if (!enumDef) {
            return null;
        }
        this._skinsEnum = enumDef;
        this._skinsEnumVersion = '4';
        return this._skinsEnum;
    }

    public getAnimsEnumForSpine3 (): { [key: string]: number } | null {
        if (this._animsEnum && this._animsEnumVersion === '3' && Object.keys(this._animsEnum).length > 1) {
            return this._animsEnum;
        }
        const enumDef = this._buildAnimsEnum();
        if (!enumDef) {
            return null;
        }
        this._animsEnum = enumDef;
        this._animsEnumVersion = '3';
        return this._animsEnum;
    }

    public getAnimsEnumForSpine4 (): { [key: string]: number } | null {
        if (this._animsEnum && this._animsEnumVersion === '4' && Object.keys(this._animsEnum).length > 1) {
            return this._animsEnum;
        }
        const enumDef = this._buildAnimsEnum();
        if (!enumDef) {
            return null;
        }
        this._animsEnum = enumDef;
        this._animsEnumVersion = '4';
        return this._animsEnum;
    }

    /**
     * @en Gets the included SkeletonData used in spine runtime.<br>
     * Returns a sp.spine.SkeletonData object.
     * @zh 获取 Spine Runtime 使用的 SkeletonData。<br>
     * 返回一个 p.spine.SkeletonData 对象。
     * @param quiet @en If vaulue is false, feedback information will be printed when an error occurs.
     *              @zh 值为 false 时，当发生错误时将打印出反馈信息。
     */
    public getRuntimeData (quiet?: boolean): spine.SkeletonData | null {
        if (this._skeletonCache) {
            return this._skeletonCache;
        }

        if (!(this.textures && this.textures.length > 0) && this.textureNames && this.textureNames.length > 0) {
            if (!quiet) {
                error(`${this.name} no textures found!`);
            }
            return null;
        }

        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset, this._atlasText);
        const wasmUtil = getSpineWasmUtilByVersion(spineVersion);
        if (!wasmUtil) {
            if (!quiet) {
                error(`${this.name} spine runtime wasm util is not ready!`);
            }
            return null;
        }
        const uuid = this.mergedUUID();
        const spData = wasmUtil.querySpineSkeletonDataByUUID(uuid);
        if (spData) {
            this._skeletonCache = spData;
        } else {
            const size = this.textures.length;
            const textureUUIDs: string[] = [];
            for (let i = 0; i < size; ++i) {
                const tex = this.textures[i];
                textureUUIDs.push(tex.uuid || tex.getId());
            }
            if (this._skeletonJson) {
                const useSpine4 = !!spineVersion && spineVersion.startsWith('4.');
                const jsonForRuntime = useSpine4
                    ? getRuntimeCompatibleSpine4JsonString(this._skeletonJson)
                    : this.skeletonJsonStr;
                this._skeletonCache = wasmUtil.createSpineSkeletonDataWithJson(jsonForRuntime, this._atlasText, this.textureNames, textureUUIDs);
                if (this._skeletonCache) {
                    wasmUtil.registerSpineSkeletonDataWithUUID(this._skeletonCache, uuid);
                }
            } else {
                const rawData = new Uint8Array(this._nativeAsset);
                const byteSize = rawData.length;
                const ptr = wasmUtil.createStoreMemory(byteSize);
                const wasmMem = wasmUtil.wasm.HEAPU8.subarray(ptr, ptr + byteSize);
                wasmMem.set(rawData);
                this._skeletonCache = wasmUtil.createSpineSkeletonDataWithBinary(byteSize, this._atlasText, this.textureNames, textureUUIDs);
                if (this._skeletonCache) {
                    wasmUtil.registerSpineSkeletonDataWithUUID(this._skeletonCache, uuid);
                }
                wasmUtil.freeStoreMemory();
            }
        }
        return this._skeletonCache;
    }

    /**
     * @internal Since v3.7.2, this is an engine private function, it only works in editor.
     */
    public getSkinsEnum (): {
        [key: string]: number;
    } | null {
        const majorVersion = this._getSpineMajorVersion();
        return majorVersion === '4' ? this.getSkinsEnumForSpine4() : this.getSkinsEnumForSpine3();
    }
    /**
     * @internal Since v3.7.2, this is an engine private function, it only works in editor.
     */
    public getAnimsEnum (): {
        [key: string]: number;
    } | null {
        const majorVersion = this._getSpineMajorVersion();
        return majorVersion === '4' ? this.getAnimsEnumForSpine4() : this.getAnimsEnumForSpine3();
    }

    private mergedUUID (): string {
        // merge texture's id and atlas content
        const hashContent = [
            this._atlasText,
            ...this.textures.map((texture) => texture.getId()),
        ].join('');

        // merge asset's uuid & hashContent
        return `${this._uuid}${murmurhash2_32_gc(hashContent, 668)}`;
    }

    /**
     * @en Destroy skeleton data.
     * @zh 销毁 skeleton data。
     */
    public destroy (): boolean {
        SkeletonCache.sharedCache.destroyCachedAnimations(this._uuid);
        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset, this._atlasText);
        const wasmUtil = getSpineWasmUtilByVersion(spineVersion);
        wasmUtil.destroySpineSkeletonDataWithUUID(this.mergedUUID());
        return super.destroy();
    }

    /**
     * @engineInternal
     * @mangle
     */
    public isEmpty (): boolean {
        return this._atlasText.length === 0 && !this._skeletonJson && !this._nativeAsset;
    }
}

legacyCC.internal.SpineSkeletonData = SkeletonData;
