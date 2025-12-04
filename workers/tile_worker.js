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
    const { width, height, tile_width, tile_height, url, token } = params;
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
    const p = [];
    let x = 0;
    while (x < width) {
        let y = 0;
        while (y < height) {
            const tile_url = `${url}crop/w_${Math.min(width - x, tile_width)},h_${Math.min(height - y, tile_height)},x_${x},y_${y},scl_1${f}?token=${token}`;
            p.push(loadTile(tile_url, x, y, ctx));
            y += tile_height;
        }
        x += tile_width;
    }
    await Promise.all(p);
    return await canvas.convertToBlob();
}
async function loadTile(url, x, y, ctx) {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, x, y);
}
