/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated January 1, 2020. Replaces all prior versions.
 *
 * Copyright (c) 2013-2020, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
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
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

#pragma once

#include <string>
#include "base/RefCounted.h"
#include "spine4/spine.h"

namespace spine4 {
class VertexEffect {
public:
    virtual ~VertexEffect() = default;
    virtual void begin(Skeleton &) {}
    virtual void transform(float &, float &, float &, float &, Color &, Color &) {}
    virtual void end() {}
};

class JitterVertexEffect : public VertexEffect {
public:
    JitterVertexEffect(float /*jitterX*/, float /*jitterY*/) {}
};

class SwirlVertexEffect : public VertexEffect {
public:
    SwirlVertexEffect(float /*radius*/) {}
};
} // namespace spine4

namespace cc::spine4 {

class VertexEffectDelegate : public cc::RefCounted {
public:
    VertexEffectDelegate();
    ~VertexEffectDelegate() override;
    ::spine4::JitterVertexEffect *initJitter(float jitterX, float jitterY);
    ::spine4::SwirlVertexEffect *initSwirlWithPow(float radius, int power);
    ::spine4::SwirlVertexEffect *initSwirlWithPowOut(float radius, int power);
    ::spine4::VertexEffect *getVertexEffect() {
        return _vertexEffect;
    }
    ::spine4::JitterVertexEffect *getJitterVertexEffect();
    ::spine4::SwirlVertexEffect *getSwirlVertexEffect();
    const std::string &getEffectType() const {
        return _effectType;
    }
    void clear();

private:
    ::spine4::VertexEffect *_vertexEffect = nullptr;
    std::string _effectType = "none";
};
} // namespace cc::spine4
