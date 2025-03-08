"use strict";
onmessage = async function (message) {
    const { url, init } = message.data;
    try {
        const response = await workerFetch(url, init);
        postMessage({ message: 'result', result: response });
    }
    catch (error) {
        postMessage({ message: 'error', error });
    }
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function workerFetch(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Received ${response.status}: ${response.url}`);
    }
    const body = response.body;
    if (!body) {
        return { url: response.url, body: new Blob() };
    }
    const chunks = [];
    const content_length = response.headers.get('Content-Length');
    const total = content_length ? parseInt(content_length, 10) : 0;
    const reader = body.getReader();
    if (!reader) {
        throw new Error('Unable to get stream reader');
    }
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
    return { url: response.url, body: new Blob(chunks) };
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
