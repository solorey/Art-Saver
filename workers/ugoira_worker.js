"use strict";
onmessage = async function (message) {
    const { type, blobs, delays, width, height, ext } = message.data;
    try {
        let result;
        switch (type) {
            case 'gif':
                result = await createGIF(blobs, delays, width, height);
                break;
            case 'apng':
                result = await createAPNG(blobs, delays, width, height);
                break;
            case 'zip':
                result = await createZIP(blobs, delays, ext);
                break;
            case 'webm':
                result = await createWEBM(blobs, delays, width, height);
                break;
            default:
                throw new Error('Unknown ugoira convert type');
        }
        postMessage({ message: 'result', result });
    }
    catch (error) {
        postMessage({ message: 'error', error });
    }
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createGIF(blobs, delays, width, height) {
    importScripts('/lib/gif.js');
    const frames = await createImageDatas(blobs, width, height);
    const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/lib/gif.worker.js',
    });
    for (let i = 0; i < frames.length; i++) {
        gif.addFrame(frames[i], { delay: delays[i] });
    }
    const gif_promise = new Promise((resolve) => {
        gif.on('finished', resolve);
    });
    gif.render();
    return await gif_promise;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createAPNG(blobs, delays, width, height) {
    importScripts('/lib/UZIP.js', '/lib/UPNG.js');
    const frames = await createImageDatas(blobs, width, height);
    const array_buffers = frames.map((f) => f.data);
    const apng = UPNG.encode(array_buffers, width, height, 0, delays);
    return new Blob([apng], { type: 'image/png' });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createZIP(blobs, delays, ext) {
    importScripts('/lib/UZIP.js');
    const frame_pad = `${blobs.length}`.length;
    const delay_pad = `${Math.max(...delays)}`.length;
    const zip_object = {};
    for (let i = 0; i < blobs.length; i++) {
        const n = `${i + 1}`.padStart(frame_pad, '0');
        const d = `${delays[i]}`.padStart(delay_pad, '0');
        zip_object[`${n}_${d}ms.${ext}`] = new Uint8Array(await blobs[i].arrayBuffer());
    }
    return new Blob([UZIP.encode(zip_object)], { type: 'application/zip' });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createBitmaps(blobs, width, height) {
    return await Promise.all(blobs.map((blob) => createImageBitmap(blob, 0, 0, width, height)));
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createImageDatas(blobs, width, height) {
    const image_bitmaps = await createBitmaps(blobs, width, height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }
    const frames = [];
    for (const image of image_bitmaps) {
        ctx.drawImage(image, 0, 0);
        frames.push(ctx.getImageData(0, 0, width, height));
    }
    return frames;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function createWEBM(blobs, delays, width, height) {
    importScripts('/lib/whammy.js');
    const image_bitmaps = await createBitmaps(blobs, width, height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }
    const webm = new Whammy.Video();
    for (let i = 0; i < image_bitmaps.length; i++) {
        ctx.drawImage(image_bitmaps[i], 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.95 });
        const data_url = await blobToDataUrl(blob);
        webm.add(data_url, delays[i]);
    }
    return await new Promise((resolve) => {
        webm.compile(false, resolve);
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function blobToDataUrl(blob) {
    // using FileReaderSync made the worker get garbage collected?
    return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', function (data) {
            resolve(data.target?.result);
        });
        reader.readAsDataURL(blob);
    });
}
