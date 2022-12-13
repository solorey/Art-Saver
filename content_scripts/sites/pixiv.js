//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function getPageInfo() {
	let page = {
		url: window.location.href,
		site: 'pixiv'
	};

	let path = new URL(page.url).pathname;

	let reg1 = /^(?:\/en)?\/users\/\d+(?:\/([^\/\n]+))?/.exec(path);
	let reg2 = /^(?:\/en)?\/(artwork|novel)/.exec(path);
	if (reg1) {
		page.page = reg1[1] || 'user';
	}
	else if (reg2) {
		page.page = reg2[1];
	}

	if (['artworks', 'illustrations', 'manga', 'novels', 'user', 'bookmarks', 'requests'].includes(page.page)) {
		page.user = /\/(\d+)/.exec(page.url)[1];
	}
	else if (['artwork', 'novel'].includes(page.page)) {
		let userelem = $('a[href*="/users/"] ~ div a[href*="/users/"] > div:first-child');
		page.user = /\/(\d+)/.exec(userelem.parentElement.href)[1];
	}
	else if (['following', 'mypixiv'].includes(page.page)) {
		page.user = /\/(\d+)/.exec(page.url)[1];
	}

	return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUserInfo(user_id) {
	let pages = await Promise.all([
		fetcher(`https://www.pixiv.net/ajax/user/${user_id}`, 'json'),
		fetcher(`https://www.pixiv.net/touch/ajax/user/home?id=${user_id}`, 'json'),
		fetcher(`https://www.pixiv.net/ajax/user/${user_id}/illusts/bookmarks?tag=&offset=0&limit=1&rest=show`, 'json')
	]);

	let user = {
		site: 'pixiv',
		id: pages[0].body.userId,
		name: pages[0].body.name
	};

	let iconblob = await fetcher(pages[0].body.imageBig, 'blob');
	user.icon = await browser.runtime.sendMessage({
		function: 'createobjecturl',
		object: iconblob
	});

	user.stats = new Map([
		['Submissions', pages[1].body.work_sets.all.total]
	]);
	if (!(pages[1] instanceof Error)) { //not available when logged out
		user.stats.set('Bookmarks', pages[2].body.total);
	}

	user.folderMeta = {
		site: user.site,
		userName: user.name,
		userId: user.id
	};

	return user;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userHomeLink(userId) {
	return `https://www.pixiv.net/users/${userId}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userGalleryLink(userId) {
	return `https://www.pixiv.net/users/${userId}/artworks`;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

function startChecking() {
	asLog('Checking Pixiv');
	let page = getPageInfo();
	checkPage(page);

	let observer = new MutationObserver((mutationsList, observer) => {
		if (page.url !== window.location.href || (page.page === 'artwork' && page.user !== $('a[href*="/users/"] ~ div a[href*="/users/"] > div:first-child').textContent)) {
			page = getPageInfo();
		}

		let newnodes = mutationsList.flatMap(m => [...m.addedNodes]).filter(n => n.nodeType === 1);

		if (page.page === 'artwork' && newnodes.some(n => n.matches('.artsaver-holder ~ *'))) {
			$remove($('div[role="presentation"] .artsaver-holder'));
			checkPage(page);
		}
		else if (newnodes.some(n => $(n, 'a[href*="/artworks/"], canvas') || n.nodeName === 'IMG')) {
			checkPage(page);
		}
		return;
	});

	globalrunningobservers.push(observer);
	observer.observe($('body'), { childList: true, subtree: true });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkPage(page) {
	checkThumbnails(getThumbnails(), page.user);

	if (page.page === 'artwork') {
		checkSubmission(page.user, page.url);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getThumbnails() {
	let thumbnails = [];

	for (let n of $$('a[href*="/artworks/"] img')) {
		let thumb = n.parentElement;
		//try to get the highest element that relates to a single submission
		while (true) {
			let parent = thumb.parentElement;
			if ($$(parent, 'a[href*="/artworks/"] img').length === 1 && !['UL', 'NAV'].includes(parent.nodeName)) {
				thumb = parent;
			}
			else {
				break;
			}
		}

		thumbnails.push(thumb);
	}

	return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkThumbnails(thumbnails, user) {
	for (let element of thumbnails) {
		try {
			let a = $(element, 'a[href*="/artworks/"]');
			let url = a.href;
			let subid = parseInt(/\/(\d+)$/.exec(url)[1], 10);

			let userlink;
			for (let i = 0; i < 10; i += 1) {
				//requested illustration boxes show requester before artist
				userlink = $$(element, 'a[href*="/users/"]').pop();
				//if no user element is found the thumbail may be part of a group
				//continue navigating up the element tree to try to find a user
				if (userlink || element.nodeName === 'SECTION') {
					break;
				}
				else {
					element = element.parentElement;
				}
			}

			let subuser = userlink ? /\/(\d+)/.exec(userlink.href)[1] : user;

			addButton('pixiv', subuser, subid, a);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkSubmission(user, url) {
	let presentation = $('figure > [role=presentation]');
	if (!presentation) {
		return;
	}

	try {
		let submission = $(presentation, 'a > img, canvas');
		if (submission.nodeName === 'CANVAS') {
			submission.parentElement.style = 'display:flex; justify-content:center;';
		}
		let subid = parseInt(/\/(\d+)$/.exec(url)[1], 10);

		let holder = $(presentation, '.artsaver-holder');
		if (!holder) {
			holder = $insert(submission, 'div', { position: 'afterend', class: 'artsaver-holder' });
		}

		holder.style = `position:absolute; width:${submission.width}px; height:${submission.height}px;`;

		let resize = new ResizeObserver(entries => {
			let change = entries.pop().contentRect;
			holder.style.height = `${change.height}px`;
			holder.style.width = `${change.width}px`;
		});
		globalrunningobservers.push(resize);
		resize.observe(submission);

		addButton('pixiv', user, subid, holder, false);
	}
	catch (err) { }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

async function startDownloading(subid, progress) {
	progress.say('Getting submission');
	let options = await getOptions('pixiv');
	let pageurl = `https://www.pixiv.net/artworks/${subid}`;

	try {
		let ajaxurl = `https://www.pixiv.net/ajax/illust/${subid}`;

		let response = await fetcher(ajaxurl, 'json');

		let { info, meta } = await getMeta(response, ajaxurl, options, progress);
		let downloads = createDownloads(info, meta, options);

		let results = await handleDownloads(downloads, info, options, progress);
		if (results.some(r => r.response === 'Success')) {
			progress.say('Updating');
			await updateSavedInfo(info.savedSite, info.savedUser, info.savedId);
		}
		else {
			throw new Error(results[0].message);
		}

		progress.finished();
		return {
			status: 'Success',
			submission: {
				url: pageurl,
				user: downloads[0].meta.userName,
				id: info.savedId,
				title: downloads[0].meta.title
			},
			files: results
		};
	}
	catch (err) {
		asLog(err);
		progress.error();

		return {
			status: 'Failure',
			error: err,
			url: pageurl,
			progress
		};
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getMeta(r, url, options, progress) {
	let info = {}, meta = {};
	meta.site = 'pixiv';
	meta.submissionId = parseInt(r.body.id, 10);
	meta.userName = r.body.userName;
	meta.userId = r.body.userId;
	meta.title = r.body.title;
	info.downloadurl = r.body.urls.original;
	let reg = /\/([^\/]+)\.(\w+)$/.exec(info.downloadurl);
	meta.fileName = reg[1];
	meta.ext = reg[2];
	meta = { ...meta, ...timeParse(r.body.uploadDate) };

	info.savedSite = meta.site;
	info.savedUser = meta.userId;
	info.savedId = meta.submissionId;

	info.pages = r.body.pageCount;

	if (r.body.illustType === 2) {
		info.isUgoira = true;
		progress.say('Getting ugoira meta');
		let u = await fetcher(`${url}/ugoira_meta`, 'json');
		info.width = r.body.width;
		info.height = r.body.height;
		info.pages = u.body.frames.length;
		info.delays = u.body.frames.map(f => f.delay);
	}
	return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createDownloads(info, meta, options) {
	if (info.pages <= 1) {
		return [{ url: info.downloadurl, meta, filename: options.file }];
	}

	let downloads = [];
	let reg = /(.+\/)([^\/]+)0(\..+)$/.exec(info.downloadurl);

	for (let i = 0, pages = info.pages; i < pages; i++) {
		let fileName = `${reg[2]}${i}`;
		downloads.push({
			url: `${reg[1]}${fileName}${reg[3]}`,
			filename: options.multiple,
			meta: { ...meta, fileName, page: `${i + 1}` }
		});
	}

	return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function handleDownloads(downloads, info, options, progress) {
	let type = options.ugoira;
	if (!info.isUgoira || type === 'multiple') {
		return await handleAllDownloads(downloads, progress);
	}

	progress.start('Getting ugoira frames');

	let bytes = 0;
	let total = downloads.length;
	let blobs = [];

	for (let i = 0; i < total; i += 1) {
		let blob = await fetchBlob(downloads[i].url, (loaded, blobtotal) => {
			progress.blobProgress(i, total, bytes, loaded, blobtotal)
		});
		bytes += blob.size;
		blobs.push(blob);
	}
	//convert ugoira based on option choosen
	progress.start(`Starting ${type} process`);

	let convertedblob;
	switch (type) {
		case 'apng':
		case 'gif':
			convertedblob = await convertUgoira(type, blobs, info.width, info.height, info.delays, progress);
			break;

		case 'webm':
			convertedblob = await recordUgoira(type, blobs, info.width, info.height, info.delays, progress);
			break;

		case 'zip':
			let exts = downloads.map(d => d.meta.ext);
			convertedblob = await createZip(blobs, exts, info.delays, progress);
			break;
	}

	let convertedmeta = downloads[0].meta;
	convertedmeta.ext = type.replace('apng', 'png');
	delete convertedmeta.page;

	let result = await downloadBlob(convertedblob, options.file, convertedmeta);

	return [result];
}

//---------------------------------------------------------------------------------------------------------------------
// worker functions
//---------------------------------------------------------------------------------------------------------------------

async function createZip(blobs, exts, delays, progress) {
	progress.width(100);
	progress.say('Creating zip');

	return await fileWorker('zip', { blobs, exts, delays });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function convertUgoira(type, blobs, width, height, delays, progress) {
	progress.say('Preparing frames');

	let imgbitmaps = await fileWorker('bitmaps', { blobs, width, height });

	let canvas = $create('canvas');
	canvas.width = width;
	canvas.height = height;
	let ctx = canvas.getContext('2d');

	let frames = [];
	for (let bm of imgbitmaps) {
		ctx.drawImage(bm, 0, 0);
		frames.push(ctx.getImageData(0, 0, width, height));
	}

	progress.width(100);
	progress.say(`Creating ${type}`);

	return await fileWorker(type, { frames, width, height, delays });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function recordUgoira(type, blobs, width, height, delays, progress) {
	progress.say('Preparing frames');

	let imgbitmaps = await fileWorker('bitmaps', { blobs, width, height });
	let frames = imgbitmaps.map((bm, i) => ({ img: bm, delay: delays[i] }));

	let canvas = $insert(document.body, 'canvas', { width, height });
	canvas.style.display = 'none';
	let ctx = canvas.getContext('2d');

	progress.width(100);
	progress.say(`Recording ${type}`);

	let options = { videoBitsPerSecond: 5000000 };

	let stream = canvas.captureStream();
	let recorder = new MediaRecorder(stream, options);

	startCapturing();
	recorder.start();

	function startCapturing() {
		if (frames.length > 0) {
			let frame = frames.shift();
			ctx.drawImage(frame.img, 0, 0);

			setTimeout(() => startCapturing(), frame.delay);
		}
		else {
			recorder.stop();
		}
	}

	return await new Promise((resolve, reject) => {
		recorder.ondataavailable = data => {
			$remove(canvas);
			resolve(new Blob([data.data], { type: `video/${type}` }));
		};
	});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fileWorker(type, data) {
	let fileworker = new Worker(browser.runtime.getURL('/workers/fileworker.js'));
	fileworker.postMessage({ type, data });

	return await new Promise((resolve, reject) => {
		fileworker.onmessage = message => {
			fileworker.terminate();
			resolve(message.data);
		}
	});
}