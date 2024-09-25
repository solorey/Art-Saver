"use strict";
onmessage = async function (message) {
    const { url, init } = message.data;
    try {
        const blob = await workerFetch(url, init);
        postMessage({ message: 'result', result: blob });
    }
    catch (error) {
        postMessage({ message: 'error', error });
    }
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function workerFetch(url, init) {
    let response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Received ${response.status}: ${response.url}`);
    }
    const content_length = response.headers.get('Content-Length');
    const total = content_length ? parseInt(content_length, 10) : 0;
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Unable to get stream reader');
    }
    const chunks = [];
    let loaded = 0;
    while (true) {
        const { done, value } = await readTimeout(reader, 20);
        if (done) {
            break;
        }
        chunks.push(value);
        loaded += value.length;
        postMessage({ message: 'progress', loaded, total });
    }
    return new Blob(chunks);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function readTimeout(reader, seconds) {
    return new Promise((resolve, reject) => {
        const id = setTimeout(reject, seconds * 1000, new Error('Read timeout'));
        reader
            .read()
            .then(resolve)
            .catch(reject)
            .finally(() => {
            clearTimeout(id);
        });
    });
}
