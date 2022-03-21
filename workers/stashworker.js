//var stashes;

onmessage = async function (m) {
	try {
		switch (m.data.message) {
			case 'getstashurls':
				let urls = await navigateStacks(m.data.data);
				postMessage({ message: 'result', result: urls });
				break;

			case 'fetchstash':
				let stash = await fetcher(m.data.data, 'text');
				postMessage({ message: 'result', result: stash });
				break;
		}
	}
	catch (err) {
		postMessage({ message: 'error', name: err.name, description: err.message });
	}
}

async function fetcher(url, type) {
	let response = await fetch(url, { credentials: 'include' });

	if (!response.ok && type !== 'response') {
		return response.status;
	}

	switch (type) {
		case 'text':
			return response.text();

		case 'blob':
			return await response.blob();

		default:
			return response;
	}
}

function findStashUrlsInStack(sr) {
	let thumbreg = /gmi-stashid(?:.|\n)+?<\//g;
	let result;
	let stashthumbs = [];
	while ((result = thumbreg.exec(sr)) !== null) {
		stashthumbs.push(result[0]);
	}

	let surls = [];
	for (let thumb of stashthumbs) {
		let hrefreg = /<a.+?href="(.+?)"/.exec(thumb);
		if (hrefreg) {
			surls.push(hrefreg[1]);
		}
		else {
			let stashid = parseInt(/gmi-stashid="(.+?)"/.exec(thumb)[1], 10);
			surls.push(`https://sta.sh/2${stashid.toString(36)}`);
		}
	}
	//stacks are paginated per 120
	let next = /class="next "><[^>]+?data-offset="(\d+)"/.exec(sr);
	if (next) {
		url = /<link href="(.+?)" rel="canonical">/.exec(sr)[1];
		surls.push(`${url}?offset=${next[1]}`);
	}
	return surls;
}

async function navigateStacks(urls) {
	let urlslist = urls;
	let stacks;
	while ((stacks = urlslist.filter(u => /\/2/.test(u))).length > 0) {
		let responses = await Promise.all(stacks.map(g => fetcher(g, 'text')));
		let stackurls = responses.map(r => findStashUrlsInStack(r));

		urlslist = [urlslist.filter(u => !/\/2/.test(u)), stackurls].flat(Infinity).filter(s => s);
	}
	return [...new Set(urlslist)];
}