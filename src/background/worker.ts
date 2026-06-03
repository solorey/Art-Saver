browser.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((message, p) => {
        const m = message as WorkMessage | { action: undefined };
        if (m.action) {
            workMessageActions(m, p);
        }
    });
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function workMessageActions(message: WorkMessage, port: Browser.Runtime.Port) {
    try {
        let result;
        switch (message.action) {
            case 'work_fetch': {
                result = await workFetch(message.url, message.init, (loaded, total) => {
                    port.postMessage({ message: 'progress', loaded, total } satisfies WorkProgress);
                });
                break;
            }
            case 'work_ugoira': {
                result = await workUqoira(message);
                break;
            }
            case 'work_zip': {
                result = await workZip(message.blob);
                break;
            }
            case 'work_tile': {
                result = await workTile(message);
                break;
            }
        }
        port.postMessage({ message: 'result', result } satisfies WorkResult<typeof result>);
    } catch (error) {
        port.postMessage({ message: 'error', error } satisfies WorkError);
    }
}

//---------------------------------------------------------------------------------------------------------------------
// work fetch
//---------------------------------------------------------------------------------------------------------------------

async function workFetch(
    url: RequestInfo,
    init?: RequestInit,
    progressfn?: (loaded: number, total: number) => void,
): Promise<WorkFetchResult> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Received ${response.status}: ${response.url}`);
    }
    const headers = Object.fromEntries(response.headers.entries());
    const body = response.body;
    if (!body) {
        return { url: response.url, headers, body: new Blob() };
    }
    const chunks: Uint8Array<ArrayBuffer>[] = [];
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
        progressfn?.(loaded, total);
    }
    return { url: response.url, headers, body: new Blob(chunks) };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function readTimeout(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>, seconds: number) {
    return new Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>((resolve, reject) => {
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

//---------------------------------------------------------------------------------------------------------------------
// work uqoira
//---------------------------------------------------------------------------------------------------------------------

async function workUqoira(params: WorkUgoiraSend): Promise<WorkUgoiraResult> {
    const { type, blobs, delays, width, height, ext } = params;
    switch (type) {
        case 'gif':
            return await createGIF(blobs, delays, width, height);
        case 'apng':
            return await createAPNG(blobs, delays, width, height);
        case 'zip':
            return await createZIP(blobs, delays, ext);
        case 'webm':
            return await createWEBM(blobs, delays, width, height);
        default:
            throw new Error('Unknown ugoira convert type');
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createGIF(blobs: Blob[], delays: number[], width: number, height: number) {
    // require '/libs/gif.js'

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
    // require '/libs/UZIP.js', '/libs/UPNG.js';

    const frames = await createImageDatas(blobs, width, height);

    const array_buffers = frames.map((f) => f.data);

    const apng = UPNG.encode(array_buffers, width, height, 0, delays) as Uint8Array<ArrayBuffer>;
    return new Blob([apng], { type: 'image/png' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createZIP(blobs: Blob[], delays: number[], ext: string) {
    // require '/libs/UZIP.js'

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
    // require '/libs/whammy.js'

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
    return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', (data) => {
            resolve(data.target?.result as string);
        });
        reader.readAsDataURL(blob);
    });
}

//---------------------------------------------------------------------------------------------------------------------
// work zip
//---------------------------------------------------------------------------------------------------------------------

async function workZip(blob: Blob): Promise<WorkZipResult> {
    const buffer = await blob.arrayBuffer();
    return UZIP.parse(buffer);
}

//---------------------------------------------------------------------------------------------------------------------
// work tile
//---------------------------------------------------------------------------------------------------------------------

async function workTile(params: WorkTileSend): Promise<WorkTileResult> {
    const { width, height, tile_width, tile_height, url, token, watermarked } = params;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }

    let f: string;
    if (url.split('/')[5].endsWith('.png')) {
        f = '/_.png';
    } else {
        f = ',q_100/_.jpg';
    }

    function tileUrl(x: number, y: number, w: number, h: number): string {
        return `${url}crop/w_${w},h_${h},x_${x},y_${y},scl_1${f}?token=${token}`;
    }

    const tile_promises = [];
    let x = 0;
    while (x < width) {
        let y = 0;
        while (y < height) {
            const w = Math.min(width - x, tile_width);
            const h = Math.min(height - y, tile_height);
            tile_promises.push(drawTile(tileUrl(x, y, w, h), x, y, ctx));

            y += tile_height;
        }
        x += tile_width;
    }
    if (watermarked) {
        const canvas_r1 = new OffscreenCanvas(width, height);
        const ctx_r1 = canvas_r1.getContext('2d');

        const canvas_r2 = new OffscreenCanvas(width, height);
        const ctx_r2 = canvas_r2.getContext('2d');

        if (!ctx_r1 || !ctx_r2) {
            throw new Error('Unable to get offscreen canvas context');
        }

        const mark_percent = 0.5;

        type Rects = [x: number, y: number, w: number, h: number][];
        const rects_r1: Rects = [];
        const rects_r2: Rects = [];

        x = 0;
        while (x < width) {
            let y = 0;
            while (y < height) {
                const w = Math.min(width - x, tile_width);
                const h = Math.min(height - y, tile_height);
                const y_mid = y + h * 0.5;
                const x_mid = x + w * 0.5;

                // round 1
                const h1 = Math.round(Math.min(w, h) * mark_percent);
                const y1 = Math.round(y_mid - h1 * 0.5);
                const w1 = Math.round(h1 * 1.5);
                const x1 = Math.max(0, Math.round(x_mid - h1));
                tile_promises.push(drawTile(tileUrl(x1, y1, w1, h1), x1, y1, ctx_r1));
                rects_r1.push([x1, y1, w1, h1]);

                // round 2
                const h2 = Math.round(h1 * mark_percent);
                const y2 = Math.round(y_mid - h2 * 0.5);
                const x2 = Math.round(x_mid - h1 * 0.5);
                const w2 = Math.min(width - x2, w1);
                tile_promises.push(drawCover(tileUrl(x2, y2, w2, h2), 0, 0, h2, h2, x2, y2, h2, h2, ctx_r2));
                rects_r2.push([x2, y2, h2, h2]);

                y += tile_height;
            }
            x += tile_width;
        }
        await Promise.all(tile_promises);
        // clear to account for transparency
        for (const [x, y, w, h] of rects_r1) {
            ctx.clearRect(x, y, w, h);
        }
        ctx.drawImage(canvas_r1, 0, 0);
        for (const [x, y, w, h] of rects_r2) {
            ctx.clearRect(x, y, w, h);
        }
        ctx.drawImage(canvas_r2, 0, 0);
    } else {
        await Promise.all(tile_promises);
    }

    return await canvas.convertToBlob();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function loadImage(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function drawTile(url: string, x: number, y: number, ctx: OffscreenCanvasRenderingContext2D) {
    const bitmap = await loadImage(url);
    ctx.drawImage(bitmap, x, y);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function drawCover(
    url: string,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
    ctx: OffscreenCanvasRenderingContext2D,
) {
    const bitmap = await loadImage(url);
    ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}
