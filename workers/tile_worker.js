"use strict";
onmessage = async function (message) {
    try {
        postMessage({ message: 'result', result: await buildImage(message.data) });
    }
    catch (error) {
        postMessage({ message: 'error', error });
    }
};
async function buildImage(params) {
    const { width, height, tile_width, tile_height, url, token, watermarked } = params;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Unable to get offscreen canvas context');
    }
    let f;
    if (url.split('/')[5].endsWith('.png')) {
        f = '/_.png';
    }
    else {
        f = ',q_100/_.jpg';
    }
    function tileUrl(x, y, w, h) {
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
        const rects_r1 = [];
        const rects_r2 = [];
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
    }
    else {
        await Promise.all(tile_promises);
    }
    return await canvas.convertToBlob();
}
async function loadImage(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}
async function drawTile(url, x, y, ctx) {
    const bitmap = await loadImage(url);
    ctx.drawImage(bitmap, x, y);
}
async function drawCover(url, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, ctx) {
    const bitmap = await loadImage(url);
    ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}
