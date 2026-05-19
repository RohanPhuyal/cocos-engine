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

#include <functional>
#include <map>
#include <string>
#include <vector>
#include <unordered_map>
#include "AttachmentVertices.h"
#include "base/RefCounted.h"
#include "spine4/SkeletonData.h"
#include "spine4/spine.h"

namespace cc::spine4 {

class AttachmentVertices;


class SkeletonDataInfo {
public:
    SkeletonDataInfo() = default;

    ~SkeletonDataInfo();

    ::spine4::SkeletonData *data = nullptr;
    ::spine4::Atlas *atlas = nullptr;
    ::spine4::AttachmentLoader *attachmentLoader = nullptr;
    std::vector<int> texturesIndex;
    std::unordered_map<::spine4::Attachment *, AttachmentVertices *> attachmentVerticesMap;
};

/**
 * Cache skeleton data.
 */
class SkeletonDataMgr final {
public:
    static SkeletonDataMgr *getInstance() {
        if (instance == nullptr) {
            instance = new SkeletonDataMgr();
        }
        return instance;
    }

    static void destroyInstance() {
        if (instance) {
            delete instance;
            instance = nullptr;
        }
    }

    SkeletonDataMgr() = default;
    ~SkeletonDataMgr();

    bool hasSkeletonData(const std::string &uuid);
    void setSkeletonData(const std::string &uuid, ::spine4::SkeletonData *data, ::spine4::Atlas *atlas, ::spine4::AttachmentLoader *attachmentLoader, const std::vector<int> &texturesIndex);
    // equal to 'findByUUID'
    ::spine4::SkeletonData *retainByUUID(const std::string &uuid);
    // equal to 'deleteByUUID'
    void releaseByUUID(const std::string &uuid);

    SkeletonDataInfo *getSkeletonDataInfo(const std::string &uuid);

    using destroyCallback = std::function<void(int)>;
    void setDestroyCallback(destroyCallback callback) {
        _destroyCallback = std::move(callback);
    }

    std::vector<SkeletonDataInfo*> getSkeletonDataInfos() const;

private:
    static SkeletonDataMgr *instance;
    destroyCallback _destroyCallback = nullptr;
    std::map<std::string, SkeletonDataInfo *> _dataMap;
};
} // namespace cc::spine4
