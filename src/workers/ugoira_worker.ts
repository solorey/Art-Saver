addEventListener('message', async (message: MessageEvent<UgoiraWorkerSend>) => {
    const { type, blobs, delays, width, height, ext } = message.data;
    try {
        let result: Blob;
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
        postMessage({ message: 'result', result } satisfies UgoiraWorkerResponse);
    } catch (error) {
        postMessage({ message: 'error', error } satisfies UgoiraWorkerResponse);
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createGIF(blobs: Blob[], delays: number[], width: number, height: number) {
    importScripts('/libs/gif.js');

    const frames = await createImageDatas(blobs, width, height);

    const gif: GIFLib = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/libs/gif.worker.js',
    });

    for (let i = 0; i < frames.length; i++) {
        gif.addFrame(frames[i], { delay: delays[i] });
    }

    const gif_promise = new Promise<Blob>((resolve) => {
        gif.on('finished', resolve);
    });

    gif.render();
    return await gif_promise;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createAPNG(blobs: Blob[], delays: number[], width: number, height: number) {
    importScripts('/libs/UZIP.js', '/libs/UPNG.js');

    const frames = await createImageDatas(blobs, width, height);

    const array_buffers = frames.map((f) => f.data);

    const apng = UPNG.encode(array_buffers, width, height, 0, delays) as Uint8Array<ArrayBuffer>;
    return new Blob([apng], { type: 'image/png' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createZIP(blobs: Blob[], delays: number[], ext: string) {
    importScripts('/libs/UZIP.js');

    const frame_pad = `${blobs.length}`.length;
    const delay_pad = `${Math.max(...delays)}`.length;

    const zip_object: Record<string, Uint8Array<ArrayBuffer>> = {};
    for (let i = 0; i < blobs.length; i++) {
        const n = `${i + 1}`.padStart(frame_pad, '0');
        const d = `${delays[i]}`.padStart(delay_pad, '0');
        zip_object[`${n}_${d}ms.${ext}`] = new Uint8Array(await blobs[i].arrayBuffer());
    }

    const zip_data = UZIP.encode(zip_object);
    return new Blob([zip_data], { type: 'application/zip' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createBitmaps(blobs: Blob[], width: number, height: number) {
    return await Promise.all(blobs.map((blob) => createImageBitmap(blob, 0, 0, width, height)));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createImageDatas(blobs: Blob[], width: number, height: number) {
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

async function createWEBM(blobs: Blob[], delays: number[], width: number, height: number) {
    importScripts('/libs/whammy.js');

    const image_bitmaps = await createBitmaps(blobs, width, height);
    const canvas = new OffscreenCanvas(width, height);
    // whammy does not support transparency
    // TODO: use something else
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }

    const webm: WhammyLib = new Whammy.Video();

    // white is the default background color for transparent animations
    ctx.fillStyle = 'white';
    for (let i = 0; i < image_bitmaps.length; i++) {
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image_bitmaps[i], 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.95 });
        const data_url = await blobToDataUrl(blob);
        webm.add(data_url, delays[i]);
    }

    return await new Promise<Blob>((resolve) => {
        webm.compile(false, resolve);
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function blobToDataUrl(blob: Blob) {
    // using FileReaderSync made the worker get garbage collected?
    return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', (data) => {
            resolve(data.target?.result as string);
        });
        reader.readAsDataURL(blob);
    });
}
