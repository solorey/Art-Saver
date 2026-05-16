importScripts('/lib/UZIP.js');

addEventListener('message', async (message: MessageEvent<ZipWorkerSend>) => {
    const zip_blob = message.data.blob;
    try {
        const buffer = await zip_blob.arrayBuffer();
        postMessage({ message: 'result', result: UZIP.parse(buffer) } satisfies ZipWorkerResponse);
    } catch (error) {
        postMessage({ message: 'error', error } satisfies ZipWorkerResponse);
    }
});
