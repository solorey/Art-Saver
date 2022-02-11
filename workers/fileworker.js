let create = {};

onmessage = async function (m) {
	try {
		postMessage(await create[m.data.type](m.data.data));
	}
	catch (err) {
		console.log(err);
		postMessage(null);
	}
}

create.gif = async function (data) {
	importScripts('/lib/gif.js');

	let gif = new GIF({
		workers: 2,
		quality: 10,
		workerScript: '/lib/gif.worker.js'
	});

	for (let i = 0; i < data.frames.length; i++) {
		gif.addFrame(data.frames[i], { delay: data.delays[i] });
	}

	gif.render();

	return new Promise((resolve, reject) => {
		gif.on('finished', blob => {
			resolve(blob);
		});
	});
}

create.apng = async function (data) {
	importScripts('/lib/pako_deflate.min.js', '/lib/UPNG.js');

	let imgdata = data.frames.map(f => f.data);

	let png = UPNG.encode(imgdata, data.width, data.height, 0, data.delays);
	return new Blob([png], { type: 'image/png' });
}

create.zip = async function (data) {
	importScripts('/lib/jszip.min.js');

	var zip = new JSZip();

	let bl = data.blobs.length;
	let npad = `${bl}`.length;
	let dpad = `${Math.max(...data.delays)}`.length;

	for (let i = 0; i < bl; i++) {
		let n = `${i + 1}`.padStart(npad, '0');
		let d = `${data.delays[i]}`.padStart(dpad, '0');
		zip.file(`${n}_${d}ms.${data.exts[i]}`, data.blobs[i]);
	}

	return await zip.generateAsync({ type: 'blob' });
}

create.bitmaps = async function (data) {
	return await Promise.all(data.blobs.map(b => createImageBitmap(b, 0, 0, data.width, data.height)));
}