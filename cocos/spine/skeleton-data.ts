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

function detectSpineVersion (skeletonJson: spine.SkeletonJson | null, nativeAsset?: ArrayBuffer): string | undefined {
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

    return undefined;
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
        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset);
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
        if (EDITOR_NOT_IN_PREVIEW) {
            this._skinsEnum = null;
            this._animsEnum = null;
        }
    }
    /**
     * @internal Since v3.7.2, this is an engine private function, only works in editor.
     * @en Reset skeleton skin and animation enumeration.
     * @zh 重置皮肤和动画枚举。
     */
    public resetEnums (): void {
        if (EDITOR_NOT_IN_PREVIEW) {
            this._skinsEnum = null;
            this._animsEnum = null;
        }
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

        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset);
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
                this._skeletonCache = wasmUtil.createSpineSkeletonDataWithJson(this.skeletonJsonStr, this._atlasText, this.textureNames, textureUUIDs);
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
        if (this._skinsEnum /* && Object.keys(this._skinsEnum).length > 0 */) {
            return this._skinsEnum;
        }
        const sd = this.getRuntimeData(true);
        if (sd) {
            const skins = sd.skins;
            const enumDef: {[key: string]: number} = {};
            for (let i = 0; i < skins.length; i++) {
                const skin = skins[i];
                if (!skin || !skin.name) {
                    continue;
                }
                const name = skin.name;
                enumDef[name] = i;
            }
            return this._skinsEnum = Enum(enumDef);
        }
        return null;
    }
    /**
     * @internal Since v3.7.2, this is an engine private function, it only works in editor.
     */
    public getAnimsEnum (): {
        [key: string]: number;
    } | null {
        if (this._animsEnum && Object.keys(this._animsEnum).length > 1) {
            return this._animsEnum;
        }
        const sd = this.getRuntimeData(true);
        if (sd) {
            const enumDef: {[key: string]: number} = { '<None>': 0 };
            const anims = sd.animations;
            for (let i = 0; i < anims.length; i++) {
                const anim = anims[i];
                if (!anim || !anim.name) {
                    continue;
                }
                const name = anim.name;
                enumDef[name] = i + 1;
            }
            return this._animsEnum = Enum(enumDef);
        }
        return null;
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
        const spineVersion = detectSpineVersion(this._skeletonJson, this._nativeAsset);
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
