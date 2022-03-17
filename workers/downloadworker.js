onmessage = async function (m) {
	try {
		switch (m.data.message) {
			case 'downloadblob':
				let blob = await fetchBlob(m.data.data);
				postMessage({ message: 'result', result: blob });
				break;
		}
	}
	catch (err) {
		postMessage({ message: 'error', name: err.name, description: err.message });
	}
}

async function fetchBlob(url) {
	let response = await fetch(url, { credentials: 'include' });

	if (!response.ok) {
		let err = new Error(url);
		err.name = `Error ${response.status}`;
		throw err;
	}

	let loaded = 0;
	let total = parseInt(response.headers.get('Content-Length'), 10);

	let reader = response.body.getReader();
	let chunks = [];

	while (true) {
		let { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		loaded += value.length;

		postMessage({ message: 'progress', loaded, total });
	}

	return new Blob(chunks);
}