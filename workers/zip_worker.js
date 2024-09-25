"use strict";
importScripts('/lib/UZIP.js');
onmessage = async function (message) {
    const zip_blob = message.data.blob;
    try {
        const buffer = await zip_blob.arrayBuffer();
        postMessage({ message: 'result', result: UZIP.parse(buffer) });
    }
    catch (error) {
        postMessage({ message: 'error', error });
    }
};
