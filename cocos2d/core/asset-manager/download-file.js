/****************************************************************************
 Copyright (c) 2019 Xiamen Yaji Software Co., Ltd.

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
const { parseParameters } = require('./utilities');

function isRequestSuccessful (status) {
    return (status >= 200 && status < 300) || status === 304 || status === 0 || status === 1223;
}

function appendCacheBust (url) {
    if (typeof url !== 'string') {
        return url;
    }
    if (/\?/.test(url)) {
        return url + '&_cb=' + (new Date() - 0);
    }
    return url + '?_cb=' + (new Date() - 0);
}

function downloadFile (url, options, onProgress, onComplete) {
    var { options, onProgress, onComplete } = parseParameters(options, onProgress, onComplete);

    var xhr = new XMLHttpRequest(), errInfo = 'download failed: ' + url + ', status: ';

    xhr.open('GET', url, true);

    if (options.responseType !== undefined) xhr.responseType = options.responseType;
    if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
    if (options.mimeType !== undefined && xhr.overrideMimeType ) xhr.overrideMimeType(options.mimeType);
    if (options.timeout !== undefined) xhr.timeout = options.timeout;

    if (options.header) {
        for (var header in options.header) {
            xhr.setRequestHeader(header, options.header[header]);
        }
    }

    function hasEmptyResponse () {
        var response = xhr.response;
        if (options.responseType === 'blob') {
            if (typeof Blob === 'undefined' || !(response instanceof Blob)) {
                return true;
            }
            return response.size === 0;
        }
        if (options.responseType === 'arraybuffer') {
            return !response || response.byteLength === 0;
        }
        return response == null || response === '';
    }

    function shouldRetryNoCacheFor304 () {
        if (options.__cacheBustRetry) {
            return false;
        }

        // Some dev servers return 304 for blob requests with unusable payload in XHR.
        // Force one cache-busted retry for image/blob downloads to guarantee valid data.
        if (xhr.status === 304 && options.responseType === 'blob') {
            return true;
        }

        // Defensive: handle cases where status looks successful but payload is empty.
        return (xhr.status === 304 || xhr.status === 0) && hasEmptyResponse();
    }

    function retryNoCache () {
        var retryOptions = {};
        for (var key in options) {
            retryOptions[key] = options[key];
        }
        retryOptions.__cacheBustRetry = true;

        var headers = {};
        if (options.header) {
            for (var name in options.header) {
                headers[name] = options.header[name];
            }
        }
        if (headers['Cache-Control'] === undefined) {
            headers['Cache-Control'] = 'no-cache';
        }
        if (headers['Pragma'] === undefined) {
            headers['Pragma'] = 'no-cache';
        }
        retryOptions.header = headers;
        downloadFile(appendCacheBust(url), retryOptions, onProgress, onComplete);
    }

    xhr.onload = function () {
        if (isRequestSuccessful(xhr.status)) {
            if (shouldRetryNoCacheFor304()) {
                retryNoCache();
                return;
            }
            onComplete && onComplete(null, xhr.response);
        } else {
            onComplete && onComplete(new Error(errInfo + xhr.status + '(no response)'));
        }
    };

    if (onProgress) {
        xhr.onprogress = function (e) {
            if (e.lengthComputable) {
                onProgress(e.loaded, e.total);
            }
        };
    }

    xhr.onerror = function(){
        if (isRequestSuccessful(xhr.status)) {
            if (shouldRetryNoCacheFor304()) {
                retryNoCache();
                return;
            }
            onComplete && onComplete(null, xhr.response);
            return;
        }
        onComplete && onComplete(new Error(errInfo + xhr.status + '(error)'));
    };

    xhr.ontimeout = function(){
        onComplete && onComplete(new Error(errInfo + xhr.status + '(time out)'));
    };

    xhr.onabort = function(){
        onComplete && onComplete(new Error(errInfo + xhr.status + '(abort)'));
    };

    xhr.send(null);
    
    return xhr;
}

module.exports = downloadFile;
