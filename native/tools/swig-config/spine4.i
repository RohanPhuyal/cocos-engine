// Define module
// target_namespace means the name exported to JS, could be same as which in other modules
// spine at the last means the suffix of binding function name, different modules should use unique name
// Note: doesn't support number prefix
%module(target_namespace="spine4") spine4

// Disable some swig warnings, find warning number reference here ( https://www.swig.org/Doc4.1/Warnings.html )
#pragma SWIG nowarn=503,302,401,317,402

%insert(runtime) %{
#define CC_SKIP_SPINE_JSB_CONVERSIONS 1
%}

// Insert code at the beginning of generated header file (.h)
%insert(header_file) %{
#pragma once
#include "bindings/jswrapper/SeApi.h"
#include "bindings/manual/jsb_conversions.h"
#include "editor-support/spine4-creator-support/spine-cocos2dx.h"
#include "editor-support/spine4-creator-support/Vector2.h"
%}

// Insert code at the beginning of generated source file (.cpp)
%{
#include "bindings/auto/jsb_2d_auto.h"
#include "bindings/auto/jsb_assets_auto.h"
#include "bindings/auto/jsb_cocos_auto.h"
#include "bindings/auto/jsb_spine4_auto.h"
using namespace spine4;

#define SWIGINTERN static

inline bool nativevalue_to_se(const ::spine4::String &from, se::Value &to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    to.setString(from.buffer());
    return true;
}

inline bool sevalue_to_native(const se::Value &from, ::spine4::String *to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    if (!from.isString()) {
        return false;
    }
    *to = ::spine4::String(from.toString().c_str());
    return true;
}

inline bool sevalue_to_native(const se::Value &from, ::spine4::Vector2 *to, se::Object *ctx) { // NOLINT(readability-identifier-naming)
    cc::Vec2 tmp{};
    if (!sevalue_to_native(from, &tmp, ctx)) {
        return false;
    }
    to->set(tmp.x, tmp.y);
    return true;
}

inline bool nativevalue_to_se(const ::spine4::Vector2 &from, se::Value &to, se::Object *ctx) { // NOLINT(readability-identifier-naming)
    return nativevalue_to_se(cc::Vec2{from.x, from.y}, to, ctx);
}

inline bool sevalue_to_native(const se::Value &from, cc::spine4::AttachmentVertices **to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    if (from.isNullOrUndefined()) {
        *to = nullptr;
        return true;
    }
    if (!from.isObject()) {
        return false;
    }
    *to = static_cast<cc::spine4::AttachmentVertices *>(from.toObject()->getPrivateData());
    return true;
}

inline bool sevalue_to_native(const se::Value &from, cc::Material **to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    if (from.isNullOrUndefined()) {
        *to = nullptr;
        return true;
    }
    if (!from.isObject()) {
        return false;
    }
    *to = static_cast<cc::Material *>(from.toObject()->getPrivateData());
    return true;
}

inline bool sevalue_to_native(const se::Value &from, cc::RenderEntity **to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    if (from.isNullOrUndefined()) {
        *to = nullptr;
        return true;
    }
    if (!from.isObject()) {
        return false;
    }
    *to = static_cast<cc::RenderEntity *>(from.toObject()->getPrivateData());
    return true;
}

template <typename T>
inline bool nativevalue_to_se(const ::spine4::Vector<T> &from, se::Value &to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    se::HandleObject obj(se::Object::createArrayObject(from.size()));
    bool ok = true;
    auto size = static_cast<uint32_t>(from.size());
    for (uint32_t i = 0; i < size; ++i) {
        se::Value item;
        ok = nativevalue_to_se(from[i], item, nullptr);
        if (!ok || !obj->setArrayElement(i, item)) {
            to.setUndefined();
            return false;
        }
    }
    to.setObject(obj);
    return true;
}

template <typename T>
inline bool nativevalue_to_se(const ::spine4::Vector<T *> &from, se::Value &to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    se::HandleObject obj(se::Object::createArrayObject(from.size()));
    bool ok = true;
    auto size = static_cast<uint32_t>(from.size());
    for (uint32_t i = 0; i < size; ++i) {
        se::Value item;
        ok = native_ptr_to_seval<T>(from[i], &item);
        if (!ok || !obj->setArrayElement(i, item)) {
            to.setUndefined();
            return false;
        }
    }
    to.setObject(obj);
    return true;
}

template <typename T>
inline bool sevalue_to_native(const se::Value &from, ::spine4::Vector<T *> *to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    CC_ASSERT_NOT_NULL(to);
    if (!from.isObject() || !from.toObject()->isArray()) {
        return false;
    }
    auto *obj = from.toObject();
    uint32_t length = 0;
    if (!obj->getArrayLength(&length)) {
        to->clear();
        return false;
    }

    se::Value item;
    for (uint32_t i = 0; i < length; ++i) {
        if (!obj->getArrayElement(i, &item) || !item.isObject()) {
            to->clear();
            return false;
        }
        auto *native = static_cast<T *>(item.toObject()->getPrivateData());
        to->add(native);
    }
    return true;
}

template <typename T, typename = std::enable_if_t<std::is_arithmetic_v<T>>>
inline bool sevalue_to_native(const se::Value &from, ::spine4::Vector<T> *to, se::Object * /*ctx*/) { // NOLINT(readability-identifier-naming)
    CC_ASSERT_NOT_NULL(to);
    if (!from.isObject() || !from.toObject()->isArray()) {
        return false;
    }
    auto *obj = from.toObject();
    uint32_t length = 0;
    if (!obj->getArrayLength(&length)) {
        to->clear();
        return false;
    }

    se::Value item;
    for (uint32_t i = 0; i < length; ++i) {
        if (!obj->getArrayElement(i, &item) || !item.isNumber()) {
            to->clear();
            return false;
        }
        to->add(static_cast<T>(item.toDouble()));
    }
    return true;
}

template <typename T, typename = std::enable_if_t<!std::is_arithmetic_v<T>>, typename = void>
inline bool sevalue_to_native(const se::Value &from, ::spine4::Vector<T> *to, se::Object *ctx) { // NOLINT(readability-identifier-naming)
    CC_ASSERT_NOT_NULL(to);
    if (!from.isObject() || !from.toObject()->isArray()) {
        return false;
    }
    auto *obj = from.toObject();
    uint32_t length = 0;
    if (!obj->getArrayLength(&length)) {
        to->clear();
        return false;
    }

    se::Value item;
    for (uint32_t i = 0; i < length; ++i) {
        if (!obj->getArrayElement(i, &item)) {
            to->clear();
            return false;
        }
        T native{};
        if (!sevalue_to_native(item, &native, ctx)) {
            to->clear();
            return false;
        }
        to->add(native);
    }
    return true;
}
%}

// ----- Ignore Section ------
// Brief: Classes, methods or attributes need to be ignored
//
// Usage:
//
//  %ignore your_namespace::your_class_name;
//  %ignore your_namespace::your_class_name::your_method_name;
//  %ignore your_namespace::your_class_name::your_attribute_name;
//
// Note: 
//  1. 'Ignore Section' should be placed before attribute definition and %import/%include
//  2. namespace is needed
//
%ignore cc::RefCounted;
%ignore *::rtti;
%ignore cc::spine4::SkeletonCache::SegmentData;
%ignore cc::spine4::SkeletonCache::BoneData;
%ignore cc::spine4::SkeletonCache::FrameData;
%ignore cc::spine4::SkeletonCache::AnimationData;
%ignore spine4::Skin::AttachmentMap::getEntries;

%ignore spine4::Polygon::Polygon;
%ignore spine4::Polygon::_vertices;

%ignore cc::spine4::SkeletonDataInfo;
%ignore cc::SlotCacheInfo;
%ignore cc::spine4::SkeletonRenderer::create;
%ignore cc::spine4::SkeletonRenderer::initWithJsonFile;
%ignore cc::spine4::SkeletonRenderer::initWithBinaryFile;
%ignore cc::spine4::SkeletonRenderer::createWithData;
%ignore cc::spine4::SkeletonRenderer::initWithData;
%ignore cc::spine4::SkeletonRenderer::createWithSkeleton;
%ignore cc::spine4::SkeletonRenderer::createWithFile;
%ignore cc::spine4::SkeletonRenderer::requestDrawInfo;
%ignore cc::spine4::SkeletonRenderer::requestMaterial;
%ignore cc::spine4::SkeletonAnimation::createWithData;
%ignore cc::spine4::SkeletonAnimation::onTrackEntryEvent;
%ignore cc::spine4::SkeletonAnimation::onAnimationStateEvent;
%ignore cc::spine4::SkeletonAnimation::cacheAnimationEvent;
%ignore cc::spine4::SkeletonAnimation::cacheTrackEvent;
%ignore cc::spine4::SkeletonAnimation::dispatchEvents;
%ignore spine4::TrackEntry::setListener;
%ignore spine4::AnimationState::setListener;
%ignore spine4::Attachment::getRTTI;
%ignore spine4::AttachmentTimeline::getRTTI;
%ignore spine4::BoundingBoxAttachment::getRTTI;
%ignore spine4::Bone::getRTTI;
%ignore spine4::Bone::worldToLocal(float, float, float&, float&);
%ignore spine4::Bone::localToWorld(float, float, float&, float&);
%ignore spine4::ClippingAttachment::getRTTI;
%ignore spine4::ColorTimeline::getRTTI;
%ignore spine4::CurveTimeline::getRTTI;
%ignore spine4::DeformTimeline::getVertices;
%ignore spine4::DeformTimeline::getRTTI;
%ignore spine4::DrawOrderTimeline::getRTTI;
%ignore spine4::EventTimeline::getRTTI;
%ignore spine4::IkConstraint::getRTTI;
%ignore spine4::IkConstraint::apply(Bone&, float, float, bool, bool, bool, float);
%ignore spine4::IkConstraint::apply(Bone&, Bone&, float, float, int, bool, bool, float, float);
%ignore spine4::IkConstraintTimeline::getRTTI;
%ignore spine4::MeshAttachment::getRTTI;
%ignore spine4::PathAttachment::getRTTI;
%ignore spine4::PathConstraint::getRTTI;
%ignore spine4::PathConstraintMixTimeline::getRTTI;
%ignore spine4::PathConstraintPositionTimeline::getRTTI;
%ignore spine4::PathConstraintSpacingTimeline::getRTTI;
%ignore spine4::PointAttachment::getRTTI;
%ignore spine4::RegionAttachment::getRTTI;
%ignore spine4::RotateTimeline::getRTTI;
%ignore spine4::ScaleTimeline::getRTTI;
%ignore spine4::ShearTimeline::getRTTI;
%ignore spine4::Skin::findNamesForSlot;
%ignore spine4::Skin::getAttachments;
%ignore spine4::Timeline::getRTTI;
%ignore spine4::TransformConstraint::getRTTI;
%ignore spine4::TransformConstraintTimeline::getRTTI;
%ignore spine4::TranslateTimeline::getRTTI;
%ignore spine4::VertexAttachment::getRTTI;
%ignore spine4::Interpolation::getRTTI;
%ignore spine4::VertexEffect::getRTTI;
%ignore spine4::ConstraintData::getRTTI;

%ignore cc::spine4::SkeletonDataMgr::destroyInstance;
%ignore cc::spine4::SkeletonDataMgr::hasSkeletonData;
%ignore cc::spine4::SkeletonDataMgr::setSkeletonData;
%ignore cc::spine4::SkeletonDataMgr::retainByUUID;
%ignore cc::spine4::SkeletonDataMgr::releaseByUUID;
%ignore cc::spine4::SkeletonDataMgr::getSkeletonDataInfo;
%ignore cc::spine4::SkeletonDataMgr::getSkeletonDataInfos();
%ignore cc::spine4::SkeletonCacheAnimation::render;
%ignore cc::spine4::SkeletonCacheAnimation::requestDrawInfo;
%ignore cc::spine4::SkeletonCacheAnimation::requestMaterial;
%ignore spine4::Timeline::apply(Skeleton&, float, float, Vector<Event*>*, float, MixBlend, MixDirection);
%ignore spine4::AnimationState::apply(Skeleton&);
%ignore spine4::Animation::apply(Skeleton&, float, float, bool, Vector<Event*>*, float, MixBlend, MixDirection);
%ignore spine4::VertexAttachment::computeWorldVertices;
%ignore spine4::Bone::Bone(BoneData&, Skeleton&, Bone*);
%ignore spine4::Bone::Bone(BoneData&, Skeleton&);
%ignore spine4::Event::Event(float, const EventData&);
%ignore spine4::IkConstraint::IkConstraint(IkConstraintData&, Skeleton&);
%ignore spine4::PathConstraint::PathConstraint(PathConstraintData&, Skeleton&);
%ignore spine4::PointAttachment::computeWorldPosition;
%ignore spine4::PointAttachment::computeWorldRotation(Bone&);
%ignore spine4::RegionAttachment::computeWorldVertices;
%ignore spine4::Slot::Slot(SlotData&, Bone&);
%ignore spine4::VertexEffect::begin(Skeleton &);
%ignore spine4::TransformConstraint::TransformConstraint(TransformConstraintData&, Skeleton&);
%ignore spine4::SkeletonBounds::update(Skeleton&, bool);
%ignore spine4::SlotData::SlotData(int, const String&, BoneData&);
%ignore spine4::DeformTimeline::setFrame(int, float, Vector<float>&);
%ignore spine4::DrawOrderTimeline::setFrame(size_t, float, Vector<int>&);
%ignore spine4::Skeleton::getBounds;
%ignore spine4::Bone::updateWorldTransform(float, float, float, float, float, float, float);
%ignore spine4::Skin::findAttachmentsForSlot;
%ignore spine4::TextureLoader::load(AtlasPage&, const String&);

// ----- Rename Section ------
// Brief: Classes, methods or attributes needs to be renamed
//
// Usage:
//
//  %rename(rename_to_name) your_namespace::original_class_name;
//  %rename(rename_to_name) your_namespace::original_class_name::method_name;
//  %rename(rename_to_name) your_namespace::original_class_name::attribute_name;
// 
// Note:
//  1. 'Rename Section' should be placed before attribute definition and %import/%include
//  2. namespace is needed
%rename(create) cc::spine4::SkeletonAnimation::createWithFile;
%rename(setCompleteListenerNative) cc::spine4::SkeletonAnimation::setCompleteListener;
%rename(setTrackCompleteListenerNative) cc::spine4::SkeletonAnimation::setTrackCompleteListener;
%rename(create) cc::spine4::SkeletonRenderer::createWithFile;

%rename(frames) spine4::TranslateTimeline::_frames;
%rename(boneIndex) spine4::TranslateTimeline::_boneIndex;
%rename(frames) spine4::IkConstraintTimeline::_frames;
%rename(ikConstraintIndex) spine4::IkConstraintTimeline::_ikConstraintIndex;
%rename(frames) spine4::TransformConstraintTimeline::_frames;
%rename(transformConstraintIndex) spine4::TransformConstraintTimeline::_transformConstraintIndex;
%rename(frames) spine4::PathConstraintPositionTimeline::_frames;
%rename(pathConstraintIndex) spine4::PathConstraintPositionTimeline::_pathConstraintIndex;
%rename(frames) spine4::PathConstraintMixTimeline::_frames;
%rename(pathConstraintIndex) spine4::PathConstraintMixTimeline::_pathConstraintIndex;
%rename(events) spine4::AnimationState::_events;
%rename(queue) spine4::AnimationState::_queue;
%rename(animationsChanged) spine4::AnimationState::_animationsChanged;
%rename(trackEntryPool) spine4::AnimationState::_trackEntryPool;
%rename(listener) spine4::TrackEntry::_listener;
%rename(nextAnimationLast) spine4::TrackEntry::_nextAnimationLast;
%rename(trackLast) spine4::TrackEntry::_trackLast;
%rename(nextTrackLast) spine4::TrackEntry::_nextTrackLast;
%rename(interruptAlpha) spine4::TrackEntry::_interruptAlpha;
%rename(totalAlpha) spine4::TrackEntry::_totalAlpha;
%rename(timelineMode) spine4::TrackEntry::_timelineMode;
%rename(timelineHoldMix) spine4::TrackEntry::_timelineHoldMix;
%rename(timelinesRotation) spine4::TrackEntry::_timelinesRotation;
%rename(drainDisabled) spine4::EventQueue::_drainDisabled;
%rename(animState) spine4::EventQueue::_state;
%rename(setMixWith) spine4::AnimationStateData::setMix;
%rename(TextureAtlas) spine4::Atlas;
%rename(sorted) spine4::Bone::_sorted;
%rename(spaces) spine4::PathConstraint::_spaces;
%rename(positions) spine4::PathConstraint::_positions;
%rename(world) spine4::PathConstraint::_world;
%rename(curves) spine4::PathConstraint::_curves;
%rename(lengths) spine4::PathConstraint::_lengths;
%rename(segments) spine4::PathConstraint::_segments;
%rename(minX) spine4::SkeletonBounds::_minX;
%rename(minY) spine4::SkeletonBounds::_minY;
%rename(maxX) spine4::SkeletonBounds::_maxX;
%rename(maxY) spine4::SkeletonBounds::_maxY;
%rename(boundingBoxes) spine4::SkeletonBounds::_boundingBoxes;
%rename(polygons) spine4::SkeletonBounds::_polygons;
%rename(setSkinByName) spine4::Skeleton::setSkin(const String &);
%rename(slotIndex) spine4::Skin::AttachmentMap::Entry::_slotIndex;
%rename(name) spine4::Skin::AttachmentMap::Entry::_name;
%rename(attachment) spine4::Skin::AttachmentMap::Entry::_attachment;
%rename(signum) spine4::MathUtil::sign(float);
%rename(TextureAtlasPage) spine4::AtlasPage;
%rename(TextureAtlasRegion) spine4::AtlasRegion;

// ----- Module Macro Section ------
// Brief: Generated code should be wrapped inside a macro
// Usage:
//  1. Configure for class
//    %module_macro(CC_USE_GEOMETRY_RENDERER) cc::pipeline::GeometryRenderer;
//  2. Configure for member function or attribute
//    %module_macro(CC_USE_GEOMETRY_RENDERER) cc::pipeline::RenderPipeline::geometryRenderer;
// Note: Should be placed before 'Attribute Section'

// Write your code bellow


// ----- Attribute Section ------
// Brief: Define attributes ( JS properties with getter and setter )
// Usage:
//  1. Define an attribute without setter
//    %attribute(your_namespace::your_class_name, cpp_member_variable_type, js_property_name, cpp_getter_name)
//  2. Define an attribute with getter and setter
//    %attribute(your_namespace::your_class_name, cpp_member_variable_type, js_property_name, cpp_getter_name, cpp_setter_name)
//  3. Define an attribute without getter
//    %attribute_writeonly(your_namespace::your_class_name, cpp_member_variable_type, js_property_name, cpp_setter_name)
//
// Note:
//  1. Don't need to add 'const' prefix for cpp_member_variable_type 
//  2. The return type of getter should keep the same as the type of setter's parameter
//  3. If using reference, add '&' suffix for cpp_member_variable_type to avoid generated code using value assignment
//  4. 'Attribute Section' should be placed before 'Import Section' and 'Include Section'
//

%attribute(spine4::Animation, spine4::String&, name, getName);
%attribute(spine4::Animation, spine4::Vector<spine4::Timeline*>&, timelines, getTimelines);
%attribute(spine4::Animation, float, duration, getDuration, setDuration);

%attribute(spine4::RotateTimeline, int, boneIndex, getBoneIndex, setBoneIndex);
%attribute(spine4::RotateTimeline, spine4::Vector<float>&, frames, getFrames);

%attribute(spine4::RGBATimeline, int, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::RGBTimeline, int, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::AlphaTimeline, int, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::RGBA2Timeline, int, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::RGB2Timeline, int, slotIndex, getSlotIndex, setSlotIndex);


%attribute(spine4::AttachmentTimeline, size_t, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::AttachmentTimeline, spine4::Vector<float>&, frames, getFrames);
%attribute(spine4::AttachmentTimeline, spine4::Vector<spine4::String>&, attachmentNames, getAttachmentNames);

%attribute(spine4::DeformTimeline, int, slotIndex, getSlotIndex, setSlotIndex);
%attribute(spine4::DeformTimeline, spine4::Vector<float>&, frames, getFrames);
%attribute(spine4::DeformTimeline, spine4::Vector<float>&, frameVertices, getVertices);
%attribute(spine4::DeformTimeline, spine4::VertexAttachment*, attachment, getAttachment);

%attribute(spine4::EventTimeline, spine4::Vector<float>, frames, getFrames);
%attribute(spine4::EventTimeline, spine4::Vector<spine4::Event*>&, events, getEvents);

%attribute(spine4::DrawOrderTimeline, spine4::Vector<float>&, frames, getFrames);
%attribute(spine4::DrawOrderTimeline, spine4::Vector<spine4::Vector<int>>&, drawOrders, getDrawOrders);

%attribute(spine4::AnimationState, spine4::AnimationStateData*, data, getData);
%attribute(spine4::AnimationState, spine4::Vector<spine4::TrackEntry*>&, tracks, getTracks);
%attribute(spine4::AnimationState, float, timeScale, getTimeScale, setTimeScale);

%attribute(spine4::TrackEntry, spine4::Animation*, animation, getAnimation);
%attribute(spine4::TrackEntry, spine4::TrackEntry*, next, getNext);
%attribute(spine4::TrackEntry, spine4::TrackEntry*, mixingFrom, getMixingFrom);
%attribute(spine4::TrackEntry, spine4::TrackEntry*, mixingTo, getMixingTo);
%attribute(spine4::TrackEntry, int, trackIndex, getTrackIndex);
%attribute(spine4::TrackEntry, bool, loop, getLoop, setLoop);
%attribute(spine4::TrackEntry, bool, holdPrevious, getHoldPrevious, setHoldPrevious);
%attribute(spine4::TrackEntry, float, eventThreshold, getEventThreshold, setEventThreshold);
%attribute(spine4::TrackEntry, float, mixAttachmentThreshold, getMixAttachmentThreshold, setMixAttachmentThreshold);
%attribute(spine4::TrackEntry, float, mixDrawOrderThreshold, getMixDrawOrderThreshold, setMixDrawOrderThreshold);
%attribute(spine4::TrackEntry, float, alphaAttachmentThreshold, getAlphaAttachmentThreshold, setAlphaAttachmentThreshold);
%attribute(spine4::TrackEntry, float, animationStart, getAnimationStart, setAnimationStart);
%attribute(spine4::TrackEntry, float, animationEnd, getAnimationEnd, setAnimationEnd);
%attribute(spine4::TrackEntry, float, animationLast, getAnimationLast, setAnimationLast);
%attribute(spine4::TrackEntry, float, delay, getDelay, setDelay);
%attribute(spine4::TrackEntry, float, trackTime, getTrackTime, setTrackTime);
%attribute(spine4::TrackEntry, float, trackEnd, getTrackEnd, setTrackEnd);
%attribute(spine4::TrackEntry, float, timeScale, getTimeScale, setTimeScale);
%attribute(spine4::TrackEntry, float, alpha, getAlpha, setAlpha);
%attribute(spine4::TrackEntry, float, mixTime, getMixTime, setMixTime);
%attribute(spine4::TrackEntry, float, mixDuration, getMixDuration, setMixDuration);
%attribute(spine4::TrackEntry, spine4::MixBlend, mixBlend, getMixBlend, setMixBlend);

%attribute(spine4::AnimationStateData, spine4::SkeletonData*, skeletonData, getSkeletonData);
%attribute(spine4::AnimationStateData, float, defaultMix, getDefaultMix, setDefaultMix);

%attribute(spine4::Bone, spine4::BoneData&, data, getData);
%attribute(spine4::Bone, spine4::Skeleton&, skeleton, getSkeleton);
%attribute(spine4::Bone, spine4::Bone*, parent, getParent);
%attribute(spine4::Bone, spine4::Vector<spine4::Bone*>&, children, getChildren);
%attribute(spine4::Bone, float, x, getX, setX);
%attribute(spine4::Bone, float, y, getY, setY);
%attribute(spine4::Bone, float, rotation, getRotation, setRotation);
%attribute(spine4::Bone, float, scaleX, getScaleX, setScaleX);
%attribute(spine4::Bone, float, scaleY, getScaleY, setScaleY);
%attribute(spine4::Bone, float, shearX, getShearX, setShearX);
%attribute(spine4::Bone, float, shearY, getShearY, setShearY);
%attribute(spine4::Bone, float, ax, getAX, setAX);
%attribute(spine4::Bone, float, ay, getAY, setAY);
%attribute(spine4::Bone, float, arotation, getAppliedRotation, setAppliedRotation);
%attribute(spine4::Bone, float, ascaleX, getAScaleX, setAScaleX);
%attribute(spine4::Bone, float, ascaleY, getAScaleY, setAScaleY);
%attribute(spine4::Bone, float, ashearX, getAShearX, setAShearX);
%attribute(spine4::Bone, float, ashearY, getAShearY, setAShearY);
%attribute(spine4::Bone, float, a, getA, setA);
%attribute(spine4::Bone, float, b, getB, setB);
%attribute(spine4::Bone, float, c, getC, setC);
%attribute(spine4::Bone, float, d, getD, setD);
%attribute(spine4::Bone, float, worldX, getWorldX, setWorldX);
%attribute(spine4::Bone, float, worldY, getWorldY, setWorldY);
%attribute(spine4::Bone, bool, active, isActive, setActive);

%attribute(spine4::BoneData, int, index, getIndex);
%attribute(spine4::BoneData, spine4::String&, name, getName);
%attribute(spine4::BoneData, spine4::BoneData*, parent, getParent);
%attribute(spine4::BoneData, float, length, getLength, setLength);
%attribute(spine4::BoneData, float, x, getX, setX);
%attribute(spine4::BoneData, float, y, getY, setY);
%attribute(spine4::BoneData, float, rotation, getRotation, setRotation);
%attribute(spine4::BoneData, float, scaleX, getScaleX, setScaleX);
%attribute(spine4::BoneData, float, scaleY, getScaleY, setScaleY);
%attribute(spine4::BoneData, float, shearX, getShearX, setShearX);
%attribute(spine4::BoneData, float, shearY, getShearY, setShearY);
%attribute(spine4::BoneData, bool, skinRequired, isSkinRequired, setSkinRequired);
%attribute(spine4::BoneData, spine4::String&, icon, getIcon, setIcon);
%attribute(spine4::BoneData, bool, visible, isVisible, setVisible);

%attribute(spine4::ConstraintData, spine4::String&, name, getName);
%attribute(spine4::ConstraintData, size_t, order, getOrder, setOrder);
%attribute(spine4::ConstraintData, bool, skinRequired, isSkinRequired, setSkinRequired);

%attribute(spine4::Event, spine4::EventData&, data, getData);
%attribute(spine4::Event, int, intValue, getIntValue, setIntValue);
%attribute(spine4::Event, float, floatValue, getFloatValue, setFloatValue);
%attribute(spine4::Event, spine4::String&, stringValue, getStringValue, setStringValue);
%attribute(spine4::Event, float, time, getTime);
%attribute(spine4::Event, float, volume, getVolume, setVolume);
%attribute(spine4::Event, float, balance, getBalance, setBalance);

%attribute(spine4::EventData, spine4::String&, name, getName);
%attribute(spine4::EventData, int, intValue, getIntValue, setIntValue);
%attribute(spine4::EventData, float, floatValue, getFloatValue, setFloatValue);
%attribute(spine4::EventData, spine4::String&, stringValue, getStringValue, setStringValue);
%attribute(spine4::EventData, float, volume, getVolume, setVolume);
%attribute(spine4::EventData, float, balance, getBalance, setBalance);
%attribute(spine4::EventData, spine4::String&, audioPath, getAudioPath, setAudioPath);

%attribute(spine4::IkConstraint, spine4::IkConstraintData&, data, getData);
%attribute(spine4::IkConstraint, spine4::Vector<spine4::Bone*>&, bones, getBones);
%attribute(spine4::IkConstraint, spine4::Bone*, target, getTarget, setTarget);
%attribute(spine4::IkConstraint, int, bendDirection, getBendDirection, setBendDirection);
%attribute(spine4::IkConstraint, bool, compress, getCompress, setCompress);
%attribute(spine4::IkConstraint, bool, stretch, getStretch, setStretch);
%attribute(spine4::IkConstraint, float, mix, getMix, setMix);
%attribute(spine4::IkConstraint, float, softness, getSoftness, setSoftness);
%attribute(spine4::IkConstraint, bool, active, isActive, setActive);

%attribute(spine4::IkConstraintData, spine4::Vector<spine4::BoneData*>&, bones, getBones);
%attribute(spine4::IkConstraintData, spine4::BoneData*, target, getTarget);
%attribute(spine4::IkConstraintData, int, bendDirection, getBendDirection, setBendDirection);
%attribute(spine4::IkConstraintData, bool, compress, getCompress, setCompress);
%attribute(spine4::IkConstraintData, bool, stretch, getStretch, setStretch);
%attribute(spine4::IkConstraintData, bool, uniform, getUniform, setUniform);
%attribute(spine4::IkConstraintData, float, mix, getMix, setMix);
%attribute(spine4::IkConstraintData, float, softness, getSoftness, setSoftness);

%attribute(spine4::PathConstraint, spine4::PathConstraintData&, data, getData);
%attribute(spine4::PathConstraint, spine4::Vector<spine4::Bone*>&, bones, getBones);
%attribute(spine4::PathConstraint, spine4::Slot*, target, getTarget, setTarget);
%attribute(spine4::PathConstraint, float, position, getPosition, setPosition);
%attribute(spine4::PathConstraint, float, spacing, getSpacing, setSpacing);
%attribute(spine4::PathConstraint, float, mixRotate, getMixRotate, setMixRotate);
%attribute(spine4::PathConstraint, float, mixX, getMixX, setMixX);
%attribute(spine4::PathConstraint, float, mixY, getMixY, setMixY);
%attribute(spine4::PathConstraint, bool, active, isActive, setActive);

%attribute(spine4::PathConstraintData, spine4::Vector<spine4::BoneData*>&, bones, getBones);
%attribute(spine4::PathConstraintData, spine4::SlotData*, target, getTarget, setTarget);
%attribute(spine4::PathConstraintData, spine4::PositionMode, positionMode, getPositionMode, setPositionMode);
%attribute(spine4::PathConstraintData, spine4::SpacingMode, spacingMode, getSpacingMode, setSpacingMode);
%attribute(spine4::PathConstraintData, spine4::RotateMode, rotateMode, getRotateMode, setRotateMode);
%attribute(spine4::PathConstraintData, float, offsetRotation, getOffsetRotation, setOffsetRotation);
%attribute(spine4::PathConstraintData, float, position, getPosition, setPosition);
%attribute(spine4::PathConstraintData, float, spacing, getSpacing, setSpacing);
%attribute(spine4::PathConstraintData, float, mixRotate, getMixRotate, setMixRotate);
%attribute(spine4::PathConstraintData, float, mixX, getMixX, setMixX);
%attribute(spine4::PathConstraintData, float, mixY, getMixY, setMixY);

%attribute(spine4::Skeleton, spine4::SkeletonData*, data, getData);
%attribute(spine4::Skeleton, spine4::Vector<spine4::Bone*>&, bones, getBones);
%attribute(spine4::Skeleton, spine4::Vector<spine4::Slot*>&, slots, getSlots);
%attribute(spine4::Skeleton, spine4::Vector<spine4::Slot*>&, drawOrder, getDrawOrder);
%attribute(spine4::Skeleton, spine4::Vector<spine4::IkConstraint*>&, ikConstraints, getIkConstraints);
%attribute(spine4::Skeleton, spine4::Vector<spine4::TransformConstraint*>&, transformConstraints, getTransformConstraints);
%attribute(spine4::Skeleton, spine4::Vector<spine4::PathConstraint*>&, pathConstraints, getPathConstraints);
%attribute(spine4::Skeleton, spine4::Vector<spine4::Updatable*>&, _updateCache, getUpdateCacheList);
%attribute(spine4::Skeleton, spine4::Skin*, skin, getSkin, setSkin);
%attribute(spine4::Skeleton, spine4::Color&, color, getColor);
%attribute(spine4::Skeleton, float, time, getTime, setTime);
%attribute(spine4::Skeleton, float, scaleX, getScaleX, setScaleX);
%attribute(spine4::Skeleton, float, scaleY, getScaleY, setScaleY);
%attribute(spine4::Skeleton, float, x, getX, setX);
%attribute(spine4::Skeleton, float, y, getY, setY);

%attribute(spine4::SkeletonData, spine4::String&, name, getName, setName);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::BoneData*>&, bones, getBones);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::SlotData*>&, slots, getSlots);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::Skin*>&, skins, getSkins);
%attribute(spine4::SkeletonData, spine4::Skin*, defaultSkin, getDefaultSkin, setDefaultSkin);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::EventData*>&, events, getEvents);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::Animation*>&, animations, getAnimations);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::IkConstraintData*>&, ikConstraints, getIkConstraints);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::TransformConstraintData*>&, transformConstraints, getTransformConstraints);
%attribute(spine4::SkeletonData, spine4::Vector<spine4::PathConstraintData*>&, pathConstraints, getPathConstraints);
%attribute(spine4::SkeletonData, float, x, getX, setX);
%attribute(spine4::SkeletonData, float, y, getY, setY);
%attribute(spine4::SkeletonData, float, width, getWidth, setWidth);
%attribute(spine4::SkeletonData, float, height, getHeight, setHeight);
%attribute(spine4::SkeletonData, spine4::String&, version, getVersion, setVersion);
%attribute(spine4::SkeletonData, spine4::String&, hash, getHash, setHash);
%attribute(spine4::SkeletonData, float, fps, getFps, setFps);
%attribute(spine4::SkeletonData, spine4::String&, imagesPath, getImagesPath, setImagesPath);
%attribute(spine4::SkeletonData, spine4::String&, audioPath, getAudioPath, setAudioPath);

%attribute(spine4::Skin, spine4::String&, name, getName);
%attribute(spine4::Skin, spine4::Vector<BoneData*>&, bones, getBones);
%attribute(spine4::Skin, spine4::Vector<ConstraintData*>&, constraints, getConstraints);

%attribute(spine4::Slot, spine4::SlotData&, data, getData);
%attribute(spine4::Slot, spine4::Bone&, bone, getBone);
%attribute(spine4::Slot, spine4::Color&, color, getColor);
%attribute(spine4::Slot, spine4::Color&, darkColor, getDarkColor);
%attribute(spine4::Slot, spine4::Attachment*, attachment, getAttachment, setAttachment);
%attribute(spine4::Slot, spine4::Vector<float>&, deform, getDeform);

%attribute(spine4::SlotData, int, index, getIndex);
%attribute(spine4::SlotData, spine4::String&, name, getName);
%attribute(spine4::SlotData, spine4::BoneData&, boneData, getBoneData);
%attribute(spine4::SlotData, spine4::Color&, color, getColor);
%attribute(spine4::SlotData, spine4::Color&, darkColor, getDarkColor);
%attribute(spine4::SlotData, spine4::String&, attachmentName, getAttachmentName, setAttachmentName);
%attribute(spine4::SlotData, spine4::BlendMode, blendMode, getBlendMode, setBlendMode);

%attribute(spine4::TransformConstraint, spine4::TransformConstraintData&, data, getData);
%attribute(spine4::TransformConstraint, spine4::Vector<spine4::Bone*>&, bones, getBones);
%attribute(spine4::TransformConstraint, spine4::Bone*, target, getTarget, setTarget);
%attribute(spine4::TransformConstraint, float, mixRotate, getMixRotate, setMixRotate);
%attribute(spine4::TransformConstraint, float, mixX, getMixX, setMixX);
%attribute(spine4::TransformConstraint, float, mixY, getMixY, setMixY);
%attribute(spine4::TransformConstraint, float, mixScaleX, getMixScaleX, setMixScaleX);
%attribute(spine4::TransformConstraint, float, mixScaleY, getMixScaleY, setMixScaleY);
%attribute(spine4::TransformConstraint, float, mixShearY, getMixShearY, setMixShearY);
%attribute(spine4::TransformConstraint, bool, active, isActive, setActive);

%attribute(spine4::TransformConstraintData, spine4::Vector<spine4::BoneData*>&, bones, getBones);
%attribute(spine4::TransformConstraintData, spine4::BoneData*, target, getTarget);
%attribute(spine4::TransformConstraintData, float, mixX, getMixX);
%attribute(spine4::TransformConstraintData, float, mixY, getMixY);
%attribute(spine4::TransformConstraintData, float, mixRotate, getMixRotate);
%attribute(spine4::TransformConstraintData, float, mixScaleX, getMixScaleX);
%attribute(spine4::TransformConstraintData, float, mixScaleY, getMixScaleY);
%attribute(spine4::TransformConstraintData, float, mixShearY, getMixShearY);
%attribute(spine4::TransformConstraintData, float, offsetRotation, getOffsetRotation);
%attribute(spine4::TransformConstraintData, float, offsetX, getOffsetX);
%attribute(spine4::TransformConstraintData, float, offsetY, getOffsetY);
%attribute(spine4::TransformConstraintData, float, offsetScaleX, getOffsetScaleX);
%attribute(spine4::TransformConstraintData, float, offsetScaleY, getOffsetScaleY);
%attribute(spine4::TransformConstraintData, float, offsetShearY, getOffsetShearY);
%attribute(spine4::TransformConstraintData, bool, relative, isRelative);
%attribute(spine4::TransformConstraintData, bool, local, isLocal);

%attribute(spine4::Attachment, spine4::String&, name, getName);

%attribute(spine4::VertexAttachment, int, id, getId);
%attribute(spine4::VertexAttachment, spine4::Vector<size_t>&, bones, getBones);
%attribute(spine4::VertexAttachment, spine4::Vector<float>&, vertices, getVertices);
%attribute(spine4::VertexAttachment, size_t, worldVerticesLength, getWorldVerticesLength, setWorldVerticesLength);
%attribute(spine4::VertexAttachment, spine4::Attachment*, timelineAttachment, getTimelineAttachment, setTimelineAttachment);

%attribute(spine4::ClippingAttachment, spine4::SlotData*, endSlot, getEndSlot, setEndSlot);

%attribute(spine4::MeshAttachment, spine4::String&, path, getPath, setPath);
%attribute(spine4::MeshAttachment, spine4::Vector<float>&, regionUVs, getRegionUVs);
%attribute(spine4::MeshAttachment, spine4::Vector<float>&, uvs, getUVs);
%attribute(spine4::MeshAttachment, spine4::Vector<unsigned short>&, triangles, getTriangles);
%attribute(spine4::MeshAttachment, spine4::Color&, color, getColor);
%attribute(spine4::MeshAttachment, float, width, getWidth, setWidth);
%attribute(spine4::MeshAttachment, float, height, getHeight, setHeight);
%attribute(spine4::MeshAttachment, int, hullLength, getHullLength, setHullLength);
%attribute(spine4::MeshAttachment, spine4::Vector<unsigned short>&, edges, getEdges);

%attribute(spine4::PathAttachment, spine4::Vector<float>&, lengths, getLengths);
%attribute(spine4::PathAttachment, bool, closed, isClosed, setClosed);
%attribute(spine4::PathAttachment, bool, constantSpeed, isConstantSpeed, setConstantSpeed);

%attribute(spine4::PointAttachment, float, x, getX, setX);
%attribute(spine4::PointAttachment, float, y, getY, setY);
%attribute(spine4::PointAttachment, float, rotation, getRotation, setRotation);

%attribute(spine4::RegionAttachment, float, x, getX, setX);
%attribute(spine4::RegionAttachment, float, y, getY, setY);
%attribute(spine4::RegionAttachment, float, scaleX, getScaleX, setScaleX);
%attribute(spine4::RegionAttachment, float, scaleY, getScaleY, setScaleY);
%attribute(spine4::RegionAttachment, float, rotation, getRotation, setRotation);
%attribute(spine4::RegionAttachment, float, width, getWidth, setWidth);
%attribute(spine4::RegionAttachment, float, height, getHeight, setHeight);
%attribute(spine4::RegionAttachment, spine4::Color&, color, getColor);
%attribute(spine4::RegionAttachment, spine4::String&, path, getPath, setPath);
%attribute(spine4::RegionAttachment, spine4::Vector<float>&, offset, getOffset);
%attribute(spine4::RegionAttachment, spine4::Vector<float>&, uvs, getUVs);

// ----- Import Section ------
// Brief: Import header files which are depended by 'Include Section'
// Note: 
//   %import "your_header_file.h" will not generate code for that header file
//
#define CC_USE_SPINE_4_2 1
%import "base/Macros.h"
%import "base/RefCounted.h"
%import "editor-support/spine4/dll.h"
%import "editor-support/spine4/RTTI.h"
%import "editor-support/spine4/SpineString.h"
%import "editor-support/spine4/Vector.h"

// ----- Include Section ------
// Brief: Include header files in which classes and methods will be bound
%include "editor-support/spine4/MathUtil.h"
%include "editor-support/spine4/MixBlend.h"
%include "editor-support/spine4/MixDirection.h"
%include "editor-support/spine4/PositionMode.h"
%include "editor-support/spine4/SpacingMode.h"
%include "editor-support/spine4/RotateMode.h"
%include "editor-support/spine4/BlendMode.h"
%include "editor-support/spine4/Timeline.h"
%include "editor-support/spine4/Animation.h"
%include "editor-support/spine4/AnimationState.h"
%include "editor-support/spine4/AnimationStateData.h"
%include "editor-support/spine4/Attachment.h"
%include "editor-support/spine4/AttachmentTimeline.h"
%include "editor-support/spine4/VertexAttachment.h"
%include "editor-support/spine4/BoundingBoxAttachment.h"
%include "editor-support/spine4/Bone.h"
%include "editor-support/spine4/BoneData.h"
%include "editor-support/spine4/ClippingAttachment.h"
%include "editor-support/spine4/Color.h"
%include "editor-support/spine4/CurveTimeline.h"
%include "editor-support/spine4/ColorTimeline.h"
%include "editor-support/spine4/DeformTimeline.h"
%include "editor-support/spine4/DrawOrderTimeline.h"
%include "editor-support/spine4/Event.h"
%include "editor-support/spine4/EventData.h"
%include "editor-support/spine4/EventTimeline.h"
%include "editor-support/spine4/ConstraintData.h"
%include "editor-support/spine4/IkConstraint.h"
%include "editor-support/spine4/IkConstraintData.h"
%include "editor-support/spine4/IkConstraintTimeline.h"
%include "editor-support/spine4/MeshAttachment.h"
%include "editor-support/spine4/PathAttachment.h"
%include "editor-support/spine4/PathConstraint.h"
%include "editor-support/spine4/PathConstraintData.h"
%include "editor-support/spine4/PathConstraintMixTimeline.h"
%include "editor-support/spine4/PathConstraintPositionTimeline.h"
%include "editor-support/spine4/PathConstraintSpacingTimeline.h"
%include "editor-support/spine4/PointAttachment.h"
%include "editor-support/spine4/RegionAttachment.h"
%include "editor-support/spine4/TranslateTimeline.h"
%include "editor-support/spine4/RotateTimeline.h"
%include "editor-support/spine4/ScaleTimeline.h"
%include "editor-support/spine4/ShearTimeline.h"
%include "editor-support/spine4/Skeleton.h"
%include "editor-support/spine4/Slot.h"
%include "editor-support/spine4/Skin.h"
%include "editor-support/spine4/SkeletonBounds.h"
%include "editor-support/spine4/SkeletonData.h"
%include "editor-support/spine4/SlotData.h"
%include "editor-support/spine4/Sequence.h"
%include "editor-support/spine4/Atlas.h"
%include "editor-support/spine4/TextureLoader.h"
%include "editor-support/spine4/TextureRegion.h"

%include "editor-support/spine4/TransformConstraint.h"
%include "editor-support/spine4/TransformConstraintData.h"
%include "editor-support/spine4/TransformConstraintTimeline.h"

%include "editor-support/spine4-creator-support/SkeletonRenderer.h"
%include "editor-support/spine4-creator-support/SkeletonAnimation.h"
%include "editor-support/spine4-creator-support/SkeletonDataMgr.h"
%include "editor-support/spine4-creator-support/SkeletonCacheAnimation.h"
%include "editor-support/spine4-creator-support/SkeletonCacheMgr.h"

%extend spine4::IkConstraint {
    void apply1(Bone *bone, float targetX, float targetY, bool compress, bool stretch, bool uniform, float alpha) {
        IkConstraint::apply(*bone, targetX, targetY, compress, stretch, uniform, alpha);
    }

    void apply2(Bone *parent, Bone *child, float targetX, float targetY, int bendDir, bool stretch, bool uniform, float softness, float alpha) {
        IkConstraint::apply(*parent, *child, targetX, targetY, bendDir, stretch, uniform, softness, alpha);
    }
};

%extend spine4::Bone {
    Bone(spine4::BoneData *data, spine4::Skeleton *skeleton, spine4::Bone *parent) {
        return new Bone(*data, *skeleton, parent);
    }

    void updateWorldTransformWith(float x, float y, float rotation, float scaleX, float scaleY, float shearX, float shearY) {
        $self->updateWorldTransform(x, y, rotation, scaleX, scaleY, shearX, shearY);
    }
}

%extend spine4::Slot {
    Slot(spine4::SlotData *data, spine4::Bone *bone) {
        return new Slot(*data, *bone);
    }
}

%extend spine4::Timeline {
    void apply(spine4::Skeleton *skeleton, float lastTime, float time, const ccstd::vector<spine4::Event*>& events, float alpha, spine4::MixBlend blend, spine4::MixDirection direction) {
        spine4::Vector<spine4::Event*> spEvents;
        for (int i = 0; i < events.size(); ++i) {
            spEvents.add(events[i]);
        }
        $self->apply(*skeleton, lastTime, time, &spEvents, alpha, blend, direction);
    }
}

%extend spine4::AnimationState {
    void apply(spine4::Skeleton* skeleton) {
        $self->apply(*skeleton);
    }
}

%extend spine4::Animation {
    void apply(spine4::Skeleton *skeleton, float lastTime, float time, bool loop, const ccstd::vector<spine4::Event*>& events, float alpha, spine4::MixBlend blend, spine4::MixDirection direction) {
        spine4::Vector<spine4::Event*> spEvents;
        for (int i = 0; i < events.size(); ++i) {
            spEvents.add(events[i]);
        }
        $self->apply(*skeleton, lastTime, time, loop, &spEvents, alpha, blend, direction);
    }
}

%extend spine4::Event {
    Event(float time, spine4::EventData *data) {
        return new Event(time, *data);
    }
}

%extend spine4::IkConstraint {
    IkConstraint(spine4::IkConstraintData *data, spine4::Skeleton *skeleton) {
        return new IkConstraint(*data, *skeleton);
    }
}

%extend spine4::PathConstraint {
    PathConstraint(spine4::PathConstraintData* data, spine4::Skeleton* skeleton) {
        return new PathConstraint(*data, *skeleton);
    }
}

%extend spine4::PointAttachment {
    float computeWorldRotation(spine4::Bone* bone) {
        return $self->computeWorldRotation(*bone);
    }
}

%extend spine4::SkeletonBounds {
    void update(spine4::Skeleton* skeleton, bool updateAabb) {
        $self->update(*skeleton, updateAabb);
    }
}

%extend spine4::TransformConstraint {
    TransformConstraint(spine4::TransformConstraintData* data, spine4::Skeleton* skeleton) {
        return new TransformConstraint(*data, *skeleton);
    }
}

%extend spine4::SlotData {
    SlotData(int index, const ccstd::string *name, spine4::BoneData *boneData) {
        spine4::String spName(name->data());
        return new SlotData(index, spName, *boneData);
    }
}

%extend spine4::DeformTimeline {
    void setFrame(int frameIndex, float time, const ccstd::vector<float>& vertices) {
        spine4::Vector<float> spVertices;
        for (int i = 0; i < vertices.size(); ++i) {
            spVertices.add(vertices[i]);
        }
        $self->setFrame(frameIndex, time, spVertices);
    }
}

%extend spine4::DrawOrderTimeline {
    void setFrame(size_t frameIndex, float time, const ccstd::vector<int>& drawOrder) {
        spine4::Vector<int> spDrawOrder;
        spDrawOrder.ensureCapacity(drawOrder.size());
        for (int i = 0; i < drawOrder.size(); ++i) {
            spDrawOrder.add(drawOrder[i]);
        }
        $self->setFrame(frameIndex, time, spDrawOrder);
    }
}

%extend spine4::Color {
    spine4::Color &setFromColor(const spine4::Color &other) {
        return $self->set(other);
    }
}

%extend spine4::Skeleton {
    spine4::Attachment &getAttachmentByName(const std::string &slotName, const std::string &attachmentName) {
        spine4::String slot(slotName.data());
        spine4::String attachment(attachmentName.data());
        return *($self->getAttachment(slot, attachment));
    }
}

%extend spine4::TextureLoader {
    void load(spine4::AtlasPage* page, const spine4::String& path) {
        $self->load(*page, path);
    }
}
