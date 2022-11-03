if (!$('#artsaver-ui')) {
	$insert(document.body, 'div', { id: 'artsaver-ui' });
}

var globaltooltip = new ToolTip();
var globalbuttons = new ButtonsState();
var globalrunningobservers = [];
var globalsavedinfo;
var globaloptions;
var globalqueue;

async function main() {
	globaloptions = await getOptions('global');
	document.body.style.setProperty('--as-icon-size', `${globaloptions.iconSize}px`);
	$('#artsaver-ui').classList.add(`artsaver-theme-${globaloptions.theme}`);

	await globaltooltip.load();

	let concurrent = globaloptions.useQueue ? globaloptions.queueConcurrent : Infinity;
	let waittime = globaloptions.useQueue ? globaloptions.queueWait : 0;
	let infobar;
	if (globaloptions.infoBar) {
		infobar = new InfoBar();
		await infobar.load();
		//infobar.test();
	}

	globalqueue = new DownloadQueue(concurrent, waittime, globalbuttons, infobar);

	let page = await getPage();

	await setSavedInfo(page.site);

	startChecking();
	//$insert(document.body, 'button', {id: 'artsaver-test-button', text: 'test button'}).onclick = () => testing();
}

main();

/*function testing() {

}*/

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getOptions(site) {
	let key = optionsKey(site);
	let res = await browser.storage.local.get(key);
	return res[key];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setSavedInfo(site) {
	let key = savedKey(site);
	let item = await browser.storage.local.get(key);
	globalsavedinfo = item[key] ?? {};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUI(ui) {
	return (await fetcher(browser.runtime.getURL(`/content_ui/${ui}.html`), 'document')).body.childNodes;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getPage() {
	while (true) {
		try {
			return getPageInfo();
		}
		catch (err) {
			await timer(0.1);
		}
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function reCheck() {
	let page = await getPage();
	await setSavedInfo(page.site);

	globalrunningobservers.forEach(ob => ob.disconnect());
	globalrunningobservers = [];

	$$('[data-checkstatus]').forEach(e => e.removeAttribute('data-checkstatus'));
	$$('.artsaver-check, .artsaver-screen').forEach(e => $remove(e));

	startChecking();
}

//---------------------------------------------------------------------------------------------------------------------
// quality of life functions
//---------------------------------------------------------------------------------------------------------------------
//themed console log

function asLog(...texts) {
	let log = ['%c[Art Saver]%c', 'color: #006efe', ''];
	if (typeof (texts[0]) === 'string') {
		log[0] += ` ${texts.shift()}`;
	}
	console.log(...log.concat(texts));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//simpler fetch function with document support

async function fetcher(url, type = 'response', init = {}) {
	init = {
		credentials: 'include',
		referrer: window.location.href,
		...init
	};

	let response = await fetch(url, init);

	if (!response.ok && type !== 'response') {
		let err = new Error(url);
		err.name = `Error ${response.status}`;
		return err;
	}

	switch (type) {
		case 'document':
			let html = await response.text();
			let parser = new DOMParser();
			return parser.parseFromString(html, 'text/html');

		case 'json':
			return await response.json();

		case 'blob':
			return await response.blob();

		default:
			return response;
	}
}

//---------------------------------------------------------------------------------------------------------------------
// button functions
//---------------------------------------------------------------------------------------------------------------------

async function removeSubmission(site, subid) {
	globalbuttons.setValue(subid, 'status', 'removing');
	try {
		globalsavedinfo = await browser.runtime.sendMessage({
			function: 'removesubmission',
			site: site,
			sid: subid
		});
	}
	catch (err) { }
	globalbuttons.setValue(subid, 'status', 'finished');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function addButton(site, user, subid, anchor, screen = true) {
	if ($(anchor, '.artsaver-error, .artsaver-loading')) {
		return;
	}
	let button = $(anchor, '.artsaver-check, .artsaver-download');

	if (anchor.getAttribute('data-checkstatus') !== 'checked' && !$(anchor, '[data-checkstatus]')) {
		let result = checkSavedInfo(site, user, subid);
		anchor.setAttribute('data-checkstatus', 'checked');

		if (result.found) {
			$$(anchor, '[class^=artsaver]').forEach(e => $remove(e));

			button = new ButtonCheck(site, result.user, subid, result.color, anchor, screen, globaltooltip).button;
		}
	}

	if (!button) {
		button = new ButtonDownload(site, subid, anchor).button;
	}

	return button;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkSavedInfo(site, user, id) {
	let found = false;
	let founduser = user;
	let color = 'green';

	if (globalsavedinfo[user] && globalsavedinfo[user].includes(id)) {
		found = true;
	}
	else {
		for (let otheruser in globalsavedinfo) {
			if (otheruser === user || !globalsavedinfo[otheruser].includes(id)) {
				continue;
			}

			founduser = otheruser;
			if (user) {
				color = 'yellow';
			}
			found = true;
			break;
		}
	}

	return { found, user: founduser, color };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function fileSize(bytes) {
	sizes = ['bytes', 'KB', 'MB', 'GB', 'TB']
	for (let size of sizes) {
		if (bytes < 1024 || size === sizes[-1]) {
			return `${bytes.toFixed(2)} ${size}`;
		}
		bytes = bytes / 1024;
	}
}

//---------------------------------------------------------------------------------------------------------------------
// functions used when downloading a submission
//---------------------------------------------------------------------------------------------------------------------

async function workerMessage(worker, message, data, callback) {
	let result = new Promise((resolve, reject) => {
		worker.onmessage = m => {
			switch (m.data.message) {
				case 'progress':
					if (callback) {
						callback(m.data);
					}
					break;

				case 'result':
					resolve(m.data.result);

				case 'error':
					let error = new Error(m.data.description);
					error.name = m.data.name;
					reject(error);
			}
		}
	});

	worker.postMessage({ message, data });

	return await result;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function timeParse(timestring) {
	let time = new Date(timestring);

	let pad = (n) => `${n}`.padStart(2, '0');

	return {
		YYYY: pad(time.getFullYear()),
		MM: pad(time.getMonth() + 1),
		DD: pad(time.getDate()),
		hh: pad(time.getHours()),
		mm: pad(time.getMinutes()),
		ss: pad(time.getSeconds())
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fetchBlob(url, callback) {
	let response = await fetcher(url);

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

		callback(loaded, total);
	}

	return new Blob(chunks);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function downloadBlob(blob, filename, meta) {
	let message = await browser.runtime.sendMessage({
		function: 'blob',
		blob,
		filename,
		meta
	});

	logDownloadResponse(message);
	return message;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function handleAllDownloads(downloads, progress) {
	progress.start('Starting download');

	let bytes = 0;
	let total = downloads.length;
	let results = [];

	for (let i = 0; i < total; i += 1) {
		let blob;
		if (downloads[i].blob) {
			blob = downloads[i].blob;
			progress.blobProgress(i, total, bytes, blob.size, blob.size);
		}
		else {
			blob = await fetchBlob(downloads[i].url, (loaded, blobtotal) => {
				progress.blobProgress(i, total, bytes, loaded, blobtotal)
			});
		}
		bytes += blob.size;

		let result = await downloadBlob(blob, downloads[i].filename, downloads[i].meta);
		results.push(result);
	}

	return results;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function logDownloadResponse(message) {
	if (message.response === 'Success') {
		asLog('%cDownloading:', 'color: #006efe', message.filename);
	}
	else if (message.response === 'Failure') {
		asLog('%cFailed to download:', 'color: #d70022', `${message.filename} | ${message.message}`);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function updateSavedInfo(site, user, id) {
	let message = await browser.runtime.sendMessage({ function: 'updatesavedinfo', site, user, id });
	if (message.response === 'Success') {
		globalsavedinfo = message.list;
	}
	else if (message.response === 'Failure') {
		asLog('%cFailed to update list:', 'color: #d70022', message.error);
	}
}

//---------------------------------------------------------------------------------------------------------------------
// message listener functions
//---------------------------------------------------------------------------------------------------------------------

browser.runtime.onMessage.addListener(message => {
	switch (message.command) {
		case 'downloadall':
			downloadAll();
			break;

		case 'recheck':
			reCheck();
			setTimeout(() => sendStats(), 300);
			break;

		case 'sitestats':
			//setTimeout(() => sendStats(), 2000);
			sendStats();
	}
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadAll() {
	globalbuttons.cleanButtons();
	for (let b of globalbuttons.idsMap.values()) {
		if (b.type === 'download' && b.status === 'idle') {
			b.buttons[0].button.click();
		}
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function sendStats() {
	globalbuttons.cleanButtons();
	let downloads = 0;
	let saved = 0
	for (let b of globalbuttons.idsMap.values()) {
		if (b.type === 'download' && b.status === 'idle') {
			downloads += 1;
		}
		if (b.type === 'check' && b.status === 'idle') {
			saved += 1;
		}
	}
	let page;
	try {
		page = getPageInfo();
	}
	catch (err) {
		browser.runtime.sendMessage({
			function: 'siteerror'
		});
		return;
	}

	browser.runtime.sendMessage({
		function: 'sitestats',
		total: { saved, downloads },
		//links: page.links,
		site: page.site,
		hasuser: Boolean(page.user),
		user: {
			id: page.user,
			link: page.user ? userHomeLink(page.user) : ''
		}
	});

	if (page.user) {
		userInfo(page);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function userInfo(page) {
	let user;
	try {
		user = await getUserInfo(page.user);
	}
	catch (err) {
		browser.runtime.sendMessage({
			function: 'usererror'
		});
		return;
	}

	browser.runtime.sendMessage({ function: 'userstats', site: page.site, user });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function timer(s) {
	return await new Promise((resolve, reject) => {
		setTimeout(resolve, s * 1000); //seconds
	});
}
