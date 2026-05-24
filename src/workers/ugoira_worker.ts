addEventListener('message', async (message: MessageEvent<UgoiraWorkerSend>) => {
    asLog('info', 'Got message for UgoiraWorker');
    const { type, blobs, delays, width, height, ext } = message.data;
    asLog('info', `UgoiraWorker requested for type ${type}`)
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
        asLog('info', 'UgoiraWorker succeeded. Returning now.');
        postMessage({ message: 'result', result } satisfies UgoiraWorkerResponse);
    } catch (error) {
        asLog('error', `UgoiraWorker failed with reason: ${error.message}`);
        postMessage({ message: 'error', error } satisfies UgoiraWorkerResponse);
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createGIF(blobs: Blob[], delays: number[], width: number, height: number) {
    asLog('info', 'createGIF called');
    asLog('debug', 'Attempting to load gif lib');
    importScripts('/libs/gif.js');
    asLog('debug', 'Successfully loaded gif lib');

    asLog('debug', 'Creating GIF image data now');
    const frames = await createImageDatas(blobs, width, height);
    asLog('info', 'Successfully created GIF image data. Assembling GIF file now.');
    const gif: GIFLib = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/libs/gif.worker.js',
    });
    asLog('debug', 'GIF object created. Adding frames.');
    for (let i = 0; i < frames.length; i++) {
        gif.addFrame(frames[i], { delay: delays[i] });
    }
    asLog('debug', 'All GIF frames added. Creating promise.');
    const gif_promise = new Promise<Blob>((resolve) => {
        gif.on('finished', resolve);
    });
    asLog('debug', 'Triggering GIF render now');
    gif.render();
    return await gif_promise;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createAPNG(blobs: Blob[], delays: number[], width: number, height: number) {
    asLog('info', 'createAPNG called');
    asLog('debug', 'Attempting to load UZIP and UPNG libs');
    importScripts('/libs/UZIP.js', '/libs/UPNG.js');
    asLog('debug', 'Successfully loaded UZIP and UPNG libs');

    asLog('debug', 'Attempting to create APNG image datas');
    const frames = await createImageDatas(blobs, width, height);
    asLog('info', 'Successfully created APNG image datas');

    const array_buffers = frames.map((f) => f.data);

    asLog('debug', 'Encoding PNG now');
    const apng = UPNG.encode(array_buffers, width, height, 0, delays) as Uint8Array<ArrayBuffer>;
    asLog('info', 'Successfully encoded PNG');
    return new Blob([apng], { type: 'image/png' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createZIP(blobs: Blob[], delays: number[], ext: string) {
    asLog('info', 'createZIP called');
    asLog('debug', 'Attempting to load UZIP lib');
    importScripts('/libs/UZIP.js');
    asLog('debug', 'Successfully loaded UZIP lib');

    asLog('debug', 'Getting ZIP metadata');
    const frame_pad = `${blobs.length}`.length;
    const delay_pad = `${Math.max(...delays)}`.length;

    asLog('debug', 'Assembling ZIP object now');
    const zip_object: Record<string, Uint8Array<ArrayBuffer>> = {};
    for (let i = 0; i < blobs.length; i++) {
        const n = `${i + 1}`.padStart(frame_pad, '0');
        const d = `${delays[i]}`.padStart(delay_pad, '0');
        zip_object[`${n}_${d}ms.${ext}`] = new Uint8Array(await blobs[i].arrayBuffer());
    }
    asLog('info', 'Successfully assembled ZIP file. Beginning encoding.');

    const zip_data = UZIP.encode(zip_object);
    asLog('info', 'Successfully encoded ZIP data.');
    return new Blob([zip_data], { type: 'application/zip' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createBitmaps(blobs: Blob[], width: number, height: number) {
    return await Promise.all(blobs.map((blob) => createImageBitmap(blob, 0, 0, width, height)));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createImageDatas(blobs: Blob[], width: number, height: number) {
    asLog('debug', 'createImageDatas called');
    asLog('debug', 'Creataing bitmaps');
    const image_bitmaps = await createBitmaps(blobs, width, height);
    asLog('debug', 'Successfully created bitmaps');
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }
    asLog('debug', 'Successfully created OffscreenCanvas. Drawing images to canvas now.');

    const frames = [];
    for (const image of image_bitmaps) {
        ctx.drawImage(image, 0, 0);
        frames.push(ctx.getImageData(0, 0, width, height));
    }
    asLog('debug', 'Successfully rendered frames to canvas.')

    return frames;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createWEBM(blobs: Blob[], delays: number[], width: number, height: number) {
    asLog('info', 'createWEBM called');
    asLog('debug', 'Attempting to load whammy lib');
    importScripts('/libs/whammy.js');
    asLog('debug', 'Successfully loaded whammy lib');

    asLog('debug', 'Creating WEBM bitmaps');
    const image_bitmaps = await createBitmaps(blobs, width, height);
    asLog('info', 'Successfully created WEBM bitmaps.');
    const canvas = new OffscreenCanvas(width, height);
    // whammy does not support transparency
    // TODO: use something else
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }

    const webm: WhammyLib = new Whammy.Video();

    asLog('debug', 'Rendering WEBM to canvas now');
    // white is the default background color for transparent animations
    ctx.fillStyle = 'white';
    for (let i = 0; i < image_bitmaps.length; i++) {
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image_bitmaps[i], 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.95 });
        const data_url = await blobToDataUrl(blob);
        webm.add(data_url, delays[i]);
    }
    asLog('info', 'Successfully rendered WEBM frames. Compiling now.')

    const completeWebM = await new Promise<Blob>((resolve) => {
        webm.compile(false, resolve);
    });
    asLog('info', 'WebM compilation complete.');
    return completeWebM;
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
