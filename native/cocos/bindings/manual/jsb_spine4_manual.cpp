/****************************************************************************
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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
****************************************************************************/

#include "jsb_spine4_manual.h"
#include "base/Data.h"
#include "base/memory/Memory.h"

#include "bindings/jswrapper/SeApi.h"
#include "bindings/manual/jsb_conversions.h"
#include "bindings/manual/jsb_global.h"
#include "bindings/manual/jsb_helper.h"
#include "editor-support/spine4-creator-support/spine-cocos2dx.h"
#include "bindings/auto/jsb_spine4_auto.h"
#include "editor-support/spine4/spine.h"
#include "middleware-adapter.h"
#include "platform/FileUtils.h"
#include "spine4-creator-support/SkeletonDataMgr.h"
#include "spine4-creator-support/SkeletonRenderer.h"
#include "spine4-creator-support/spine-cocos2dx.h"
#include "spine4-creator-support/Vector2.h"

using namespace cc::spine4;

static cc::spine4::Cocos2dTextureLoader textureLoader;
static cc::RefMap<ccstd::string, middleware::Texture2D *> *_preloadedAtlasTextures = nullptr;
static middleware::Texture2D *_getPreloadedAtlasTexture(const char *path) {
    CC_ASSERT(_preloadedAtlasTextures);
    auto it = _preloadedAtlasTextures->find(path);
    return it != _preloadedAtlasTextures->end() ? it->second : nullptr;
}

static bool js_register_spine4_initSkeletonData(se::State &s) {
    const auto &args = s.args();
    int argc = (int)args.size();
    if (argc != 5) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", argc, 5);
        return false;
    }
    bool ok = false;

    ccstd::string uuid;
    ok = sevalue_to_native(args[0], &uuid);
    SE_PRECONDITION2(ok, false, "Invalid uuid content!");

    auto mgr = SkeletonDataMgr::getInstance();
    bool hasSkeletonData = mgr->hasSkeletonData(uuid);
    if (hasSkeletonData) {
        spine4::SkeletonData *skeletonData = mgr->retainByUUID(uuid);
        native_ptr_to_seval<spine4::SkeletonData>(skeletonData, &s.rval());
        return true;
    }

    ccstd::string skeletonDataFile;
    ok = sevalue_to_native(args[1], &skeletonDataFile);
    SE_PRECONDITION2(ok, false, "Invalid json path!");

    ccstd::string atlasText;
    ok = sevalue_to_native(args[2], &atlasText);
    SE_PRECONDITION2(ok, false, "Invalid atlas content!");

    cc::RefMap<ccstd::string, middleware::Texture2D *> textures;
    ok = seval_to_Map_string_key(args[3], &textures);
    SE_PRECONDITION2(ok, false, "Invalid textures!");

    float scale = 1.0f;
    ok = sevalue_to_native(args[4], &scale);
    SE_PRECONDITION2(ok, false, "Invalid scale!");

    // create atlas from preloaded texture

    _preloadedAtlasTextures = &textures;
    spAtlasPage_setCustomTextureLoader(_getPreloadedAtlasTexture);

    spine4::Atlas *atlas = ccnew_placement(__FILE__, __LINE__) spine4::Atlas(atlasText.c_str(), (int)atlasText.size(), "", &textureLoader);

    _preloadedAtlasTextures = nullptr;
    spAtlasPage_setCustomTextureLoader(nullptr);

    spine4::AttachmentLoader *attachmentLoader = ccnew_placement(__FILE__, __LINE__) Cocos2dAtlasAttachmentLoader(atlas);
    spine4::SkeletonData *skeletonData = nullptr;

    std::size_t length = skeletonDataFile.length();
    auto binPos = skeletonDataFile.find(".skel", length - 5);
    if (binPos == ccstd::string::npos) binPos = skeletonDataFile.find(".bin", length - 4);

    if (binPos != ccstd::string::npos) {
        auto fileUtils = cc::FileUtils::getInstance();
        if (fileUtils->isFileExist(skeletonDataFile)) {
            cc::Data cocos2dData;
            const auto fullpath = fileUtils->fullPathForFilename(skeletonDataFile);
            fileUtils->getContents(fullpath, &cocos2dData);

            spine4::SkeletonBinary binary(attachmentLoader);
            binary.setScale(scale);
            skeletonData = binary.readSkeletonData(cocos2dData.getBytes(), (int)cocos2dData.getSize());
            const auto &errorMsg = binary.getError();
            CC_ASSERTF(skeletonData, "Spine parse error: %s", errorMsg.buffer());
        }
    } else {
        spine4::SkeletonJson json(attachmentLoader);
        json.setScale(scale);
        skeletonData = json.readSkeletonData(skeletonDataFile.c_str());
        const auto &errorMsg = json.getError();
        CC_ASSERTF(skeletonData, "Spine parse error: %s", errorMsg.buffer());
    }

    if (skeletonData) {
        ccstd::vector<int> texturesIndex;
        texturesIndex.reserve(textures.size());
        for (auto it = textures.begin(); it != textures.end(); it++) {
            texturesIndex.push_back(it->second->getRealTextureIndex());
        }
        mgr->setSkeletonData(uuid, skeletonData, atlas, attachmentLoader, texturesIndex);
        native_ptr_to_seval<spine4::SkeletonData>(skeletonData, &s.rval());
    } else {
        if (atlas) {
            delete atlas;
            atlas = nullptr;
        }
        if (attachmentLoader) {
            delete attachmentLoader;
            attachmentLoader = nullptr;
        }
    }
    return true;
}
SE_BIND_FUNC(js_register_spine4_initSkeletonData)

static bool js_register_spine4_disposeSkeletonData(se::State &s) {
    const auto &args = s.args();
    int argc = (int)args.size();
    if (argc != 1) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", argc, 5);
        return false;
    }
    bool ok = false;

    ccstd::string uuid;
    ok = sevalue_to_native(args[0], &uuid);
    SE_PRECONDITION2(ok, false, "Invalid uuid content!");

    auto mgr = SkeletonDataMgr::getInstance();
    bool hasSkeletonData = mgr->hasSkeletonData(uuid);
    if (!hasSkeletonData) return true;
    mgr->releaseByUUID(uuid);
    return true;
}
SE_BIND_FUNC(js_register_spine4_disposeSkeletonData)

static bool js_register_spine4_initSkeletonRenderer(se::State &s) {
    // renderer, jsonPath, atlasText, textures, scale
    const auto &args = s.args();
    int argc = (int)args.size();
    if (argc != 2) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", argc, 5);
        return false;
    }
    bool ok = false;

    cc::spine4::SkeletonRenderer *node = nullptr;
    ok = seval_to_native_ptr(args[0], &node);
    SE_PRECONDITION2(ok, false, "Converting SpineRenderer failed!");

    ccstd::string uuid;
    ok = sevalue_to_native(args[1], &uuid);
    SE_PRECONDITION2(ok, false, "Invalid uuid content!");

    auto mgr = SkeletonDataMgr::getInstance();
    bool hasSkeletonData = mgr->hasSkeletonData(uuid);
    if (hasSkeletonData) {
        node->initWithUUID(uuid);
    }
    return true;
}
SE_BIND_FUNC(js_register_spine4_initSkeletonRenderer)

static bool js_register_spine4_retainSkeletonData(se::State &s) {
    const auto &args = s.args();
    int argc = (int)args.size();
    if (argc != 1) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", argc, 1);
        return false;
    }
    bool ok = false;

    ccstd::string uuid;
    ok = sevalue_to_native(args[0], &uuid);
    SE_PRECONDITION2(ok, false, "Invalid uuid content!");

    auto mgr = SkeletonDataMgr::getInstance();
    bool hasSkeletonData = mgr->hasSkeletonData(uuid);
    if (hasSkeletonData) {
        spine4::SkeletonData *skeletonData = mgr->retainByUUID(uuid);
        native_ptr_to_seval<spine4::SkeletonData>(skeletonData, &s.rval());
    }
    return true;
}
SE_BIND_FUNC(js_register_spine4_retainSkeletonData)

static bool js_VertexAttachment_computeWorldVertices(se::State &s) {
    const auto &args = s.args();

    spine4::VertexAttachment *vertexAttachment = SE_THIS_OBJECT<spine4::VertexAttachment>(s);
    if (nullptr == vertexAttachment) return true;

    spine4::Slot *slot = nullptr;
    size_t start = 0, count = 0, offset = 0, stride = 0;
    se::Value worldVerticesVal;

    bool ok = false;
    ok = sevalue_to_native(args[0], &slot, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing slot");

    ok = sevalue_to_native(args[1], &start, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing start");
    
    ok = sevalue_to_native(args[2], &worldVerticesVal, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing vertices");

    ok = sevalue_to_native(args[3], &count, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing count");

    ok = sevalue_to_native(args[4], &offset, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing offset");
    
    ok = sevalue_to_native(args[5], &stride, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing stride");

    if (worldVerticesVal.toObject()->isTypedArray()) {
        uint8_t* ptr = nullptr;
        size_t len = 0;
        worldVerticesVal.toObject()->getTypedArrayData(&ptr, &len);
        vertexAttachment->computeWorldVertices(*slot, start, count, reinterpret_cast<float*>(ptr), offset, stride);
    } else if (worldVerticesVal.toObject()->isArray()) {
        spine4::Vector<float> worldVertices;
        worldVertices.ensureCapacity(count);
        vertexAttachment->computeWorldVertices(*slot, start, count, worldVertices, 0);

        int tCount = offset + (count >> 1) * stride;
        
        for (size_t i = offset, t = 0; i < tCount; i += stride, t += 2) {
            worldVerticesVal.toObject()->setArrayElement(i, se::Value(worldVertices[t]));
            worldVerticesVal.toObject()->setArrayElement(i + 1, se::Value(worldVertices[t + 1]));
        }
    }
    return true;
}
SE_BIND_FUNC(js_VertexAttachment_computeWorldVertices)

static bool js_RegionAttachment_computeWorldVertices(se::State &s) {
    const auto &args = s.args();

    spine4::RegionAttachment *regionAttachment = SE_THIS_OBJECT<spine4::RegionAttachment>(s);
    if (nullptr == regionAttachment) return true;

#if 0
    spine4::Bone *bone = nullptr;
#else
    spine4::Slot *slot = nullptr;
#endif
    size_t offset = 0, stride = 0;
    se::Value worldVerticesVal;

    bool ok = false;
#if 0
    ok = sevalue_to_native(args[0], &bone, s.thisObject());
#else
    ok = sevalue_to_native(args[0], &slot, s.thisObject());
#endif
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    ok = sevalue_to_native(args[1], &worldVerticesVal, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    ok = sevalue_to_native(args[2], &offset, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    ok = sevalue_to_native(args[3], &stride, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    if (worldVerticesVal.toObject()->isTypedArray()) {
        uint8_t* ptr = nullptr;
        size_t len = 0;
        worldVerticesVal.toObject()->getTypedArrayData(&ptr, &len);
#if 0
        regionAttachment->computeWorldVertices(*bone, reinterpret_cast<float *>(ptr), offset, stride);
#else
        regionAttachment->computeWorldVertices(*slot, reinterpret_cast<float *>(ptr), offset, stride);
#endif
    } else if (worldVerticesVal.toObject()->isArray()) {
        spine4::Vector<float> worldVertices;
        int count = 8;
        worldVertices.ensureCapacity(count);
#if 0
        regionAttachment->computeWorldVertices(*bone, worldVertices, 0);
#else
        regionAttachment->computeWorldVertices(*slot, worldVertices, 0);
#endif

        int curr = offset;
        worldVerticesVal.toObject()->setArrayElement(curr, se::Value(worldVertices[0]));
        worldVerticesVal.toObject()->setArrayElement(curr + 1, se::Value(worldVertices[1]));

        curr += stride;
        worldVerticesVal.toObject()->setArrayElement(curr, se::Value(worldVertices[2]));
        worldVerticesVal.toObject()->setArrayElement(curr + 1, se::Value(worldVertices[3]));

        curr += stride;
        worldVerticesVal.toObject()->setArrayElement(curr, se::Value(worldVertices[4]));
        worldVerticesVal.toObject()->setArrayElement(curr + 1, se::Value(worldVertices[5]));

        curr += stride;
        worldVerticesVal.toObject()->setArrayElement(curr, se::Value(worldVertices[6]));
        worldVerticesVal.toObject()->setArrayElement(curr + 1, se::Value(worldVertices[7]));
    }
    return true;
}
SE_BIND_FUNC(js_RegionAttachment_computeWorldVertices)

static bool js_Skeleton_getBounds(se::State &s) {
    const auto &args = s.args();
    spine4::Skeleton* skeleton = SE_THIS_OBJECT<spine4::Skeleton>(s);
    if (nullptr == skeleton) return true;

    se::Value temp;

    bool ok = false;
    ok = sevalue_to_native(args[2], &temp, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    {
        float offx = 0.F, offy = 0.F, sizex = 0.F, sizey = 0.F;
        spine4::Vector<float> outVertexBuffer;
        skeleton->getBounds(offx, offy, sizex, sizey, outVertexBuffer);
        args[0].toObject()->setProperty("x", se::Value(offx));
        args[0].toObject()->setProperty("y", se::Value(offy));
        args[1].toObject()->setProperty("x", se::Value(sizex));
        args[1].toObject()->setProperty("y", se::Value(sizey));
        if (temp.isObject()) {
            for (int i = 0; i < outVertexBuffer.size(); ++i) {
                temp.toObject()->setArrayElement(i, se::Value(outVertexBuffer[i]));
            }
        }
    }
    return true;
}
SE_BIND_FUNC(js_Skeleton_getBounds)

static bool js_Bone_worldToLocal(se::State &s) {
    const auto &args = s.args();
    spine4::Bone* bone = SE_THIS_OBJECT<spine4::Bone>(s);
    if (nullptr == bone) return true;

    spine4::Vector2 world(0, 0);

    bool ok = false;
    ok = sevalue_to_native(args[0], &world, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    float outX = 0.F, outY = 0.F;
    bone->worldToLocal(world.x, world.y, outX, outY);

    spine4::Vector2 outNative(outX, outY);
    se::Value ret;
    nativevalue_to_se(outNative, ret, s.thisObject());
    s.rval().setObject(ret.toObject());
    return true;
}
SE_BIND_FUNC(js_Bone_worldToLocal)

static bool js_Bone_localToWorld(se::State &s) {
    const auto &args = s.args();
    spine4::Bone* bone = SE_THIS_OBJECT<spine4::Bone>(s);
    if (nullptr == bone) return true;

    spine4::Vector2 local(0, 0);

    bool ok = false;
    ok = sevalue_to_native(args[0], &local, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    float outX = 0.F, outY = 0.F;
    bone->localToWorld(local.x, local.y, outX, outY);

    spine4::Vector2 outNative(outX, outY);
    se::Value ret;
    nativevalue_to_se(outNative, ret, s.thisObject());
    s.rval().setObject(ret.toObject());
    return true;
}
SE_BIND_FUNC(js_Bone_localToWorld)

static bool js_PointAttachment_computeWorldPosition(se::State &s) {
    const auto &args = s.args();
    spine4::PointAttachment* pointAttachment = SE_THIS_OBJECT<spine4::PointAttachment>(s);
    if (nullptr == pointAttachment) return true;

    spine4::Bone* bone = nullptr;

    bool ok = false;
    ok = sevalue_to_native(args[0], &bone, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    float outX = 0.F, outY = 0.F;
    pointAttachment->computeWorldPosition(*bone, outX, outY);

    spine4::Vector2 outNative(outX, outY);
    se::Value ret;
    nativevalue_to_se(outNative, ret, s.thisObject());
    s.rval().setObject(ret.toObject());
    return true;
}
SE_BIND_FUNC(js_PointAttachment_computeWorldPosition)

static bool js_Skin_findAttachmentsForSlot(se::State &s) {
    const auto &args = s.args();
    spine4::Skin* skin = SE_THIS_OBJECT<spine4::Skin>(s);
    if (nullptr == skin) return true;

    size_t slotIndex = 0;
    se::Value attachmentsVal;

    bool ok = false;
    ok = sevalue_to_native(args[0], &slotIndex, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    attachmentsVal = args[1];
    ok = attachmentsVal.isObject();
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    spine4::Skin::AttachmentMap::Entries entries = skin->getAttachments();
    uint32_t index = 0;
    while (entries.hasNext()) {
        spine4::Skin::AttachmentMap::Entry &entry = entries.next();
        if (entry._slotIndex == slotIndex) {
            se::Value entryVal;
            ok = nativevalue_to_se(&entry, entryVal);
            SE_PRECONDITION2(ok, false, "Error processing arguments");
            attachmentsVal.toObject()->setArrayElement(index++, entryVal);
        }
    }
    return true;
}
SE_BIND_FUNC(js_Skin_findAttachmentsForSlot)

#if 0
static bool js_VertexEffect_transform(se::State &s) {
    const auto &args = s.args();
    spine4::VertexEffect* effect = SE_THIS_OBJECT<spine4::VertexEffect>(s);
    if (nullptr == effect) return true;

    float outX = 0.F, outY = 0.F;
    effect->transform(outX, outY);

    args[0].toObject()->setProperty("x", se::Value(outX));
    args[0].toObject()->setProperty("y", se::Value(outY));
    return true;
}
SE_BIND_FUNC(js_VertexEffect_transform)

static bool js_SwirlVertexEffect_transform(se::State &s) {
    const auto &args = s.args();
    spine4::SwirlVertexEffect* effect = SE_THIS_OBJECT<spine4::SwirlVertexEffect>(s);
    if (nullptr == effect) return true;

    float outX = 0.F, outY = 0.F;
    effect->transform(outX, outY);

    args[0].toObject()->setProperty("x", se::Value(outX));
    args[0].toObject()->setProperty("y", se::Value(outY));
    return true;
}
SE_BIND_FUNC(js_SwirlVertexEffect_transform)

static bool js_JitterVertexEffect_transform(se::State &s) {
    const auto &args = s.args();
    spine4::JitterVertexEffect* effect = SE_THIS_OBJECT<spine4::JitterVertexEffect>(s);
    if (nullptr == effect) return true;

    float outX = 0.F, outY = 0.F;
    effect->transform(outX, outY);

    args[0].toObject()->setProperty("x", se::Value(outX));
    args[0].toObject()->setProperty("y", se::Value(outY));
    return true;
}
SE_BIND_FUNC(js_JitterVertexEffect_transform)
#endif

static bool js_spine_Skin_getAttachments(se::State& s) {
    CC_UNUSED bool ok = true;
    const auto& args = s.args();
    size_t argc = args.size();
    spine4::Skin *skin = (spine4::Skin *) NULL ;
    
    if(argc != 0) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 0);
        return false;
    }
    skin = SE_THIS_OBJECT<spine4::Skin>(s);
    if (nullptr == skin) return true;
    spine4::Skin::AttachmentMap::Entries attachments = skin->getAttachments();

    std::vector<se::Value> entries;
    while (attachments.hasNext()) {
        spine4::Skin::AttachmentMap::Entry &entry = attachments.next();
        se::Value entryVal;
        ok = nativevalue_to_se(&entry, entryVal);
        SE_PRECONDITION2(ok, false, "Error processing arguments");
        entries.push_back(entryVal);
    }
    
    se::HandleObject array(se::Object::createArrayObject(entries.size()));
    for (int i = 0; i < entries.size(); ++i) {
        array->setArrayElement(i, entries[i]);
    }
    s.rval().setObject(array);
    
    return true;
}
SE_BIND_FUNC(js_spine_Skin_getAttachments)

static bool js_spine_Slot_setAttachment(se::State& s) {
    CC_UNUSED bool ok = true;
    const auto& args = s.args();
    spine4::Slot *slot = (spine4::Slot *) NULL ;

    slot = SE_THIS_OBJECT<spine4::Slot>(s);
    if (nullptr == slot) return true;

    spine4::Attachment* attachment = nullptr;

    ok = sevalue_to_native(args[0], &attachment, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    slot->setAttachment(attachment);

    return true;
}
SE_BIND_FUNC(js_spine_Slot_setAttachment)

static bool js_spine_Slot_getAttachment(se::State& s) {
    CC_UNUSED bool ok = true;
    const auto& args = s.args();
    spine4::Slot *slot = (spine4::Slot *) NULL ;

    slot = SE_THIS_OBJECT<spine4::Slot>(s);
    if (nullptr == slot) return true;

    spine4::Attachment *attachment = slot->getAttachment();
    if (attachment) {
        nativevalue_to_se(attachment, s.rval(), s.thisObject());
        return true;
    }
    return false;
}
SE_BIND_FUNC(js_spine_Slot_getAttachment)

static bool js_spine_Skeleton_setSkin(se::State& s)
{
    CC_UNUSED bool ok = true;
    const auto& args = s.args();
    size_t argc = args.size();
    spine4::Skeleton *arg1 = (spine4::Skeleton *) NULL ;
    spine4::Skin *arg2 = (spine4::Skin *) NULL ;
    
    if(argc != 1) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 1);
        return false;
    }
    arg1 = SE_THIS_OBJECT<spine4::Skeleton>(s);
    if (nullptr == arg1) return true;
    
    ok &= sevalue_to_native(args[0], &arg2, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments"); 
    (arg1)->setSkin(arg2);
    
    
    return true;
}
SE_BIND_FUNC(js_spine_Skeleton_setSkin) 

bool register_all_spine4_manual(se::Object *obj) {
    // Get the ns
    se::Value nsVal;
    if (!obj->getProperty("spine4", &nsVal)) {
        se::HandleObject jsobj(se::Object::createPlainObject());
        nsVal.setObject(jsobj);
        obj->setProperty("spine4", nsVal);
    }
    se::Object *ns = nsVal.toObject();

    ns->defineFunction("initSkeletonRenderer", _SE(js_register_spine4_initSkeletonRenderer));
    ns->defineFunction("initSkeletonData", _SE(js_register_spine4_initSkeletonData));
    ns->defineFunction("retainSkeletonData", _SE(js_register_spine4_retainSkeletonData));
    ns->defineFunction("disposeSkeletonData", _SE(js_register_spine4_disposeSkeletonData));

    __jsb_spine4_VertexAttachment_proto->defineFunction("computeWorldVertices", _SE(js_VertexAttachment_computeWorldVertices));
    __jsb_spine4_RegionAttachment_proto->defineFunction("computeWorldVertices", _SE(js_RegionAttachment_computeWorldVertices));
    __jsb_spine4_Skeleton_proto->defineFunction("getBounds", _SE(js_Skeleton_getBounds));
    __jsb_spine4_Skeleton_proto->defineFunction("setSkin", _SE(js_spine_Skeleton_setSkin)); 
    __jsb_spine4_Skin_proto->defineFunction("getAttachmentsForSlot", _SE(js_Skin_findAttachmentsForSlot));
    __jsb_spine4_Bone_proto->defineFunction("worldToLocal", _SE(js_Bone_worldToLocal));
    __jsb_spine4_Bone_proto->defineFunction("localToWorld", _SE(js_Bone_localToWorld));
    __jsb_spine4_PointAttachment_proto->defineFunction("computeWorldPosition", _SE(js_PointAttachment_computeWorldPosition));
#if 0
    __jsb_spine4_VertexEffect_proto->defineFunction("transform", _SE(js_VertexEffect_transform));
    __jsb_spine4_SwirlVertexEffect_proto->defineFunction("transform", _SE(js_SwirlVertexEffect_transform));
    __jsb_spine4_JitterVertexEffect_proto->defineFunction("transform", _SE(js_JitterVertexEffect_transform));
#endif
    __jsb_spine4_Skin_proto->defineFunction("getAttachments", _SE(js_spine_Skin_getAttachments));
    __jsb_spine4_Slot_proto->defineFunction("setAttachment", _SE(js_spine_Slot_setAttachment));
    __jsb_spine4_Slot_proto->defineFunction("getAttachment", _SE(js_spine_Slot_getAttachment));

    cc::spine4::setSpineObjectDisposeCallback([](void *spineObj) {
        if (!se::NativePtrToObjectMap::isValid()) {
            return;
        }
        // Support Native Spine fo Creator V3.0
        se::NativePtrToObjectMap::forEach(spineObj, [](se::Object *seObj) {
            // Unmap native and js object since native object was destroyed.
            // Otherwise, it may trigger 'assertion' in se::Object::setPrivateData later
            // since native obj is already released and the new native object may be assigned with
            // the same address.
            seObj->setClearMappingInFinalizer(false);
        });
        se::NativePtrToObjectMap::erase(spineObj);
    });

    se::ScriptEngine::getInstance()->addBeforeCleanupHook([]() {
        SkeletonDataMgr::destroyInstance();
    });

    se::ScriptEngine::getInstance()->clearException();

    return true;
}
