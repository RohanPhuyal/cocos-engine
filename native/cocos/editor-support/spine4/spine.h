/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated July 28, 2023. Replaces all prior versions.
 *
 * Copyright (c) 2013-2023, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software or
 * otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THE
 * SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

#ifndef SPINE4_SPINE_H_
#define SPINE4_SPINE_H_

#include <spine4/Animation.h>
#include <spine4/AnimationState.h>
#include <spine4/AnimationStateData.h>
#include <spine4/Atlas.h>
#include <spine4/AtlasAttachmentLoader.h>
#include <spine4/Attachment.h>
#include <spine4/AttachmentLoader.h>
#include <spine4/AttachmentTimeline.h>
#include <spine4/AttachmentType.h>
#include <spine4/BlendMode.h>
#include <spine4/Bone.h>
#include <spine4/BoneData.h>
#include <spine4/BoundingBoxAttachment.h>
#include <spine4/ClippingAttachment.h>
#include <spine4/Color.h>
#include <spine4/ColorTimeline.h>
#include <spine4/ConstraintData.h>
#include <spine4/ContainerUtil.h>
#include <spine4/CurveTimeline.h>
#include <spine4/DeformTimeline.h>
#include <spine4/DrawOrderTimeline.h>
#include <spine4/Event.h>
#include <spine4/EventData.h>
#include <spine4/EventTimeline.h>
#include <spine4/Extension.h>
#include <spine4/HasRendererObject.h>
#include <spine4/HashMap.h>
#include <spine4/IkConstraint.h>
#include <spine4/IkConstraintData.h>
#include <spine4/IkConstraintTimeline.h>
#include <spine4/Inherit.h>
#include <spine4/InheritTimeline.h>
#include <spine4/Json.h>
#include <spine4/LinkedMesh.h>
#include <spine4/MathUtil.h>
#include <spine4/MeshAttachment.h>
#include <spine4/MixBlend.h>
#include <spine4/MixDirection.h>
#include <spine4/PathAttachment.h>
#include <spine4/PathConstraint.h>
#include <spine4/PathConstraintData.h>
#include <spine4/PathConstraintMixTimeline.h>
#include <spine4/PathConstraintPositionTimeline.h>
#include <spine4/PathConstraintSpacingTimeline.h>
#include <spine4/Physics.h>
#include <spine4/PhysicsConstraint.h>
#include <spine4/PhysicsConstraintData.h>
#include <spine4/PointAttachment.h>
#include <spine4/Pool.h>
#include <spine4/PositionMode.h>
#include <spine4/Property.h>
#include <spine4/RTTI.h>
#include <spine4/RegionAttachment.h>
#include <spine4/RotateMode.h>
#include <spine4/RotateTimeline.h>
#include <spine4/ScaleTimeline.h>
#include <spine4/ShearTimeline.h>
#include <spine4/Skeleton.h>
#include <spine4/SkeletonBinary.h>
#include <spine4/SkeletonBounds.h>
#include <spine4/SkeletonClipping.h>
#include <spine4/SkeletonData.h>
#include <spine4/SkeletonJson.h>
#include <spine4/SkeletonRenderer.h>
#include <spine4/Skin.h>
#include <spine4/Slot.h>
#include <spine4/SlotData.h>
#include <spine4/SpacingMode.h>
#include <spine4/SpineObject.h>
#include <spine4/SpineString.h>
#include <spine4/TextureLoader.h>
#include <spine4/Timeline.h>
#include <spine4/TransformConstraint.h>
#include <spine4/TransformConstraintData.h>
#include <spine4/TransformConstraintTimeline.h>
#include <spine4/TranslateTimeline.h>
#include <spine4/Triangulator.h>
#include <spine4/Updatable.h>
#include <spine4/Vector.h>
#include <spine4/VertexAttachment.h>
#include <spine4/Vertices.h>

#endif // SPINE4_SPINE_H_
