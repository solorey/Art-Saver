var as = { deviantart: { check: {}, download: {} } };

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo() {
	let page = {
		url: window.location.href,
		site: 'deviantart'
	};

	let path = new URL(page.url).pathname;

	let reg = /^\/([^\/]+)(?:\/([^\/]+))?/.exec(path);
	if (reg) {
		if (['daily-deviations', 'watch'].includes(reg[1])) {
			page.page = reg[1];
		}
		else if (!reg[2] && $('title').textContent.endsWith(' | DeviantArt')) {
			page.page = 'user';
		}
		else if (reg[2]) {
			page.page = reg[2];
		}
	}
	//group pages that still have the old site layout
	let group = $('#group');
	if (group) {
		page.page = 'group';
	}

	if (['art'].includes(page.page)) {
		page.user = $('[data-hook="deviation_meta"] .user-link').title
	}
	if (['journal'].includes(page.page)) {
		page.user = /by\ ([^\ ]+)\ on\ DeviantArt$/.exec($('title').textContent)[1];
	}
	else if (['about', 'user', 'gallery', 'prints', 'favourites', 'posts', 'shop'].includes(page.page)) {
		page.user = $('#content-container [data-username]').title;
	}

	return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.userInfo = async function (user_id) {
	let userresponse = await fetcher(`https://www.deviantart.com/_napi/da-user-profile/api/init/gallery?username=${user_id}`);

	let user = {
		site: 'deviantart',
		id: user_id,
		name: user_id
	}

	if (userresponse.ok) {
		let userstats = (await userresponse.json()).pageData;

		user.icon = userstats.gruser.usericon;

		let us = userstats.stats;
		user.stats = new Map([
			['Deviations', us.deviations],
			['Favourites', us.favourites],
			['Views', us.pageviews]
		]);
	}
	else {
		user.icon = $(`img[title=${user.name}], img[alt="${user.name}'s avatar"]`).src;
		user.stats = new Map([]);
	}
	
	user.folderMeta = {
		site: user.site,
		userName: user.name
	};

	return user;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.deviantart.check.startChecking = function () {
	asLog('Checking Deviantart');
	let page = pageInfo();
	this.checkPage(page);

	let thumbselect = '.thumb, [data-hook=deviation_link]';

	let pageobserver = new MutationObserver((mutationsList, observer) => {
		let diffpage = false;
		let newnodes = mutationsList.flatMap(m => [...m.addedNodes]);

		if (page.url !== window.location.href || newnodes.some(n => $('title').contains(n))) {
			diffpage = true;
			page = pageInfo();
		}

		if (page.page === 'art' && diffpage) {
			let submission = $('[data-hook=art_stage]');
			$$(submission, '[data-checkstatus]').forEach(e => e.removeAttribute('data-checkstatus'));
			$$(submission, '[class^=artsaver]:not(.artsaver-holder)').forEach(e => $remove(e));

			this.checkPage(page);
		}
		else if (newnodes.some(n => n.nodeType === 1 && (n.matches(thumbselect) || $(n, thumbselect)))) {
			this.checkPage(page);
		}
	});

	globalrunningobservers.push(pageobserver);
	pageobserver.observe(document, { childList: true, subtree: true });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkPage = function (page) {
	//old thumbnails still show in art groups
	this.checkOldThumbnails(this.getOldThumbnails());

	this.checkThumbnails(this.getThumbnails());

	if (page.page === 'art') {
		this.checkSubmission(page.user, page.url);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Legacy

as.deviantart.check.getOldThumbnails = function () {
	let thumbnails = [];

	for (let thumb of $$('.thumb, .embedded-image-deviation')) {
		//----------------------------------------------
		//current unsupported thumbs
		//                 journals,  gallery folder preview images
		if (thumb.matches('.freeform:not(.literature), div.stream.col-thumbs *')) {
			continue;
		}
		//----------------------------------------------
		//devations in 'more from <user>/deviantart' or in '<user> added to this collection'
		if (thumb.matches('.tt-crop, #gmi-ResourceStream > *')) {
			thumb.style.position = 'relative';
		}
		//devations in texts
		else if (thumb.matches('.shadow > *:not(.lit)') && !$(thumb, '.artsaver-holder')) {
			$insert($(thumb, 'img'), 'div', { position: 'parent', class: 'artsaver-holder' });
		}

		thumbnails.push(thumb);
	}

	return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkOldThumbnails = function (thumbnails) {
	for (let thumb of thumbnails) {
		try {
			let url = thumb.getAttribute('href') || $(thumb, 'a').href;
			if (/https?:\/\/sta\.sh/.test(url)) { //currently unable to directly download stash links
				continue;
			}
			let subid = parseInt(url.split('-').pop(), 10);
			let user = thumb.getAttribute('data-super-alt');
			let sub;
			if (thumb.matches('.lit')) {
				sub = $(thumb, 'span.wrap');
				user = '';
			}
			else if (thumb.matches('.literature')) {
				sub = $(thumb, 'a.torpedo-thumb-link');
				user = $(thumb, 'a.username').textContent;
			}
			else {
				sub = $(thumb, 'img');
				user = user ? user.split(' ').pop() : sub.alt.split(' ').pop();
			}

			addButton('deviantart', user, subid, sub.parentElement);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.getThumbnails = function () {
	let thumbnails = [];
	for (let thumb of $$('[data-hook=deviation_link]')) {
		//filter out journals
		if (/\/journal\//.test(thumb.href)) {
			continue;
		}
		//main gallery thumbnail title
		else if (thumb.matches('span > a')) {
			continue;
		}
		//deviation spotlight widget title
		else if (!thumb.firstElementChild) {
			continue
		}
		//main gallery thumbnail
		if (thumb.matches('[data-hook=deviation_std_thumb] > a')) {
			thumb = thumb.parentElement;
		}
		//literature thumbnail
		if (!$(thumb, 'img') && $(thumb, 'section')) {
			thumb.style.position = 'relative';
		}
		//popup thumbnails
		if (thumb.matches('[id^=popper] a')) {
			thumb.style.position = 'relative';
		}

		thumbnails.push(thumb);
	}
	return thumbnails;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkThumbnails = function (thumbnails) {
	for (let thumb of thumbnails) {
		try {
			let url = thumb.getAttribute('href') || $(thumb, 'a').href;
			let subid = parseInt(url.split('-').pop(), 10);
			let user = '';
			let userlink = $(thumb, '.user-link');
			if (userlink) {
				user = userlink.getAttribute('title');
			}
			if (!user) {
				//thumbs in the sidebar of a submission page
				let thumbtitle = thumb.getAttribute('title');
				if (thumbtitle) {
					titlereg = /\ by\ ([\w-]+)$/.exec(thumbtitle);
					if (titlereg) {
						user = titlereg[1];
					}
				}
			}
			if (!user) {
				//if no user element is found the thumbail may be part of a group
				//continue navigating up the element tree to try to find a user
				let element = thumb.parentElement;
				for (let i = 0; i < 5; i += 1) {
					userlink = $(element, '.user-link');
					if (userlink) {
						user = userlink.getAttribute('title');
						break;
					}
					else if (element.nodeName === 'SECTION') {
						break;
					}
					element = element.parentElement;
				}
			}

			addButton('deviantart', user, subid, thumb);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.check.checkSubmission = function (user, url) {
	try {
		let subid = parseInt(url.split('-').pop(), 10);
		let stage = $('[data-hook=art_stage]');
		//art, pdf
		let submission = $(stage, 'img, [data-hook=react-playable], object[type="application/pdf"]');
		if (submission) {
			let parent = submission.parentElement
			parent.style.position = 'relative';
			addButton('deviantart', user, subid, parent, false);
			return;
		}
		//literature
		submission = $(stage, 'h1');
		if (submission) {
			let holder = $(stage, '.artsaver-holder')
			if (!holder) {
				holder = $insert(submission, 'div', { position: 'parent', class: 'artsaver-holder', style: 'margin:0;text-align:initial;' });
			}
			addButton('deviantart', user, subid, holder, false);
			return;
		}
	}
	catch (err) { }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------
//submission - https://www.deviantart.com/_napi/shared_api/deviation/extended_fetch?deviationid=<sumbissionId>&type=art&include_session=false
//user       - https://www.deviantart.com/_napi/da-user-profile/api/init/gallery?username=<userName>
//gallery    - https://www.deviantart.com/_napi/da-user-profile/api/gallery/contents?username=<userName>&offset=0&limit=24&all_folder=true&mode=newest //24 is max
//rss        - https://backend.deviantart.com/rss.xml?q=+sort:time+by:<userName>+-in:journals&type=deviation

as.deviantart.download.startDownloading = async function (subid, progress) {
	progress.say('Getting submission');
	let options = await getOptions('deviantart');
	let pageurl = `https://www.deviantart.com/deviation/${subid}`;

	try {
		let params = new URLSearchParams({
			deviationid: subid,
			type: 'art',
			include_session: false
		});
		let response = await fetcher(`https://www.deviantart.com/_napi/shared_api/deviation/extended_fetch?${params}`, 'json');
		let { info, meta } = await this.getMeta(response, options, progress);

		let downloads = [{ url: info.downloadurl, meta, filename: options.file }];
		if (info.blob) {
			downloads[0].blob = info.blob;
		}
		if (info.filesize) {
			downloads[0].filesize = info.filesize;
		}

		if (options.stash && info.stash.length > 0) {
			progress.say('Found stash');
			let stashworker = new Worker(browser.runtime.getURL('/workers/stashworker.js'));

			let stashurls = await workerMessage(stashworker, 'getstashurls', info.stash);

			let parser = new DOMParser();
			let count = 0;
			for (let stashurl of stashurls) {
				count += 1;
				progress.onOf('Getting stash', count, stashurls.length);

				let stashstring = await workerMessage(stashworker, 'fetchstash', stashurl);
				if (typeof (stashstring) === 'number') {
					//asLog(`%cError ${stashstring}:`, 'color: #d70022', stashurl);
					continue;
				}
				let stashresponse = parser.parseFromString(stashstring, 'text/html');

				let { stashinfo, stashmeta } = await this.getStashMeta(stashresponse, { url: info.url, ...meta }, options, progress);
				if (Object.entries(stashmeta).length === 0) {
					continue;
				}

				let stashdownload = {
					url: stashinfo.downloadurl,
					meta: { ...meta, ...stashmeta },
					filename: options.stashFile
				};
				if (stashinfo.blob) {
					stashdownload.blob = stashinfo.blob;
				}

				downloads.push(stashdownload);
			}
			stashworker.terminate();
		}

		let results = await this.handleDownloads(downloads, options, progress);
		if (results.some(r => r.response === 'Success')) {
			progress.say('Updating');
			await updateSavedInfo(info.savedSite, info.savedUser, info.savedId);
		}
		else {
			throw new Error('Files failed to download.');
		}

		progress.finished();
		return {
			status: 'Success',
			submission: {
				url: pageurl,
				user: info.savedUser,
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

as.deviantart.download.getMeta = async function (r, options, progress) {
	r = r.deviation;
	progress.say('Getting meta');
	let info = {}, meta = {};
	meta.site = 'deviantart';
	meta.title = r.title;
	meta.userName = r.author.username;
	meta.submissionId = r.deviationId;
	meta.submissionId36 = r.deviationId.toString(36);
	meta = { ...meta, ...timeParse(r.publishedTime) };
	meta.fileName = r.media.prettyName || deviantArtFileName(r.title, r.author.username, r.deviationId);

	info.savedSite = meta.site;
	info.savedUser = meta.userName;
	info.savedId = meta.submissionId;

	info.url = r.url;

	//find stash in description
	let stashreg = /"(https:\/\/sta\.sh\/.+?)"/g;
	let stashresult;
	let stashurls = [];
	while ((stashresult = stashreg.exec(r.extended.description)) !== null) {
		stashurls.push(stashresult[1]);
	}
	info.stash = [...new Set(stashurls)];

	if (r.isDownloadable) { //the user is cool; downloading full resolution is easy
		info.downloadurl = r.extended.download.url;
		info.filesize = r.extended.download.filesize;
	}
	else if (r.type === 'literature') {
		if (options.literature === 'html') {
			progress.say('Creating html');
			meta.ext = 'html';
			info.blob = await literatureToHtml(r, meta, options);
		}
		else { //options.literature === 'txt'
			progress.say('Creating txt');
			meta.ext = 'txt';
			info.blob = await literatureToText(r, meta, options);
		}
		return { info, meta };
	}
	else { //the user is uncool; downloading is hard and often full resolution is not available
		//Usually
		//type.c = image
		//type.s = swf
		//type.b = mp4, gif
		let type = r.media.types.filter(m => m.f && (m.t === 'fullview' || m.s || m.b)).pop();

		let url = (type.t === 'fullview') ? (type.c ? `${r.media.baseUri}/${type.c}` : r.media.baseUri) : type.s || type.b;

		if (r.media.prettyName) {
			url = url.replace(/<prettyName>/g, r.media.prettyName);
		}
		if (r.media.token) {
			url = `${url}?token=${r.media.token[0]}`;
		}
		//Make sure quailty is 100
		//Replacing .jpg with .png can lead to better quailty
		if (/\/v1\/fill\//.test(url)) {
			url = url.replace(/q_\d+/, 'q_100').replace('.jpg?', '.png?');
		}
		//flash with no download button
		if (/\/\/sandbox/.test(url)) {
			let embedded = await fetcher(url, 'document');
			url = $(embedded, '#sandboxembed').src;
		}

		info.downloadurl = url;
	}

	if (r.type === 'pdf') {
		meta.ext = 'pdf';
		return { info, meta };
	}

	//example download urls
	//https://www.deviantart.com/download/123456789/d21i3v9-3885adbb-f9f1-4fbe-8d2d-98c4578ba244.ext?token=...&ts=1234567890
	//https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/2f9bc7a0-1a23-4a7e-ad00-07e8ffd4105d/d21i3v9-3885adbb-f9f1-4fbe-8d2d-98c4578ba244.ext/v1/fill/w_1280,h_720,q_100,strp/title_by_username_d21i3v9-fullview.ext?token=...

	let reg = /\/[^\/?]+\.(\w+)(?:\?token=.+)?$/;
	meta.ext = reg.exec(info.downloadurl)[1];

	if (info.downloadurl.search('/v1/fill/') < 0 || !options.larger) {
		return { info, meta };
	}
	progress.say('Comparing images');
	info.downloadurl = await compareUrls(info.downloadurl, options);
	//update extension in case it is different
	meta.ext = reg.exec(info.downloadurl)[1];
	return { info, meta };
}

as.deviantart.download.getStashMeta = async function (sr, meta, options, progress) {
	let stashinfo = {}, stashmeta = {};
	let url = $(sr, 'link[rel=canonical]').href;
	let pageview = $(sr, 'div.dev-page-view');
	if (!pageview) {
		return { stashinfo, stashmeta }
	}
	stashmeta.stashSubmissionId = pageview.getAttribute('gmi-deviationid');
	stashmeta.stashTitle = $(sr, '.dev-title-container .title').textContent;
	stashmeta.stashUserName = $(sr, '.dev-title-container .username:not(.group)').textContent;
	stashmeta.stashUrlId = url.split('/0').pop();
	let sid = parseInt(stashmeta.stashSubmissionId, 10);
	stashmeta.stashFileName = deviantArtFileName(stashmeta.stashTitle, stashmeta.stashUserName, sid);

	let timestring = $(sr, 'span[ts]').getAttribute('ts');
	let time = new Date();
	time.setTime(`${timestring}000`); //set time by milliseconds

	let pad = (n) => `${n}`.padStart(2, '0');
	stashmeta.stashYYYY = pad(time.getFullYear());
	stashmeta.stashMM = pad(time.getMonth() + 1);
	stashmeta.stashDD = pad(time.getDate());
	stashmeta.stashhh = pad(time.getHours());
	stashmeta.stashmm = pad(time.getMinutes());
	stashmeta.stashss = pad(time.getSeconds());

	//literature
	if ($(sr, '.journal-wrapper font, .journal-wrapper .text')) {
		if (options.literature === 'html') {
			progress.say('Creating html');
			stashmeta.stashExt = 'html';
			stashinfo.blob = await stashLiteratureToHtml(sr, { ...meta, ...stashmeta }, options);
		}
		else { //options.literature === 'txt'
			progress.say('Creating txt');
			stashmeta.stashExt = 'txt';
			stashinfo.blob = await stashLiteratureToText(sr, { ...meta, ...stashmeta }, options);
		}
		return { stashinfo, stashmeta };
	}
	//video
	let film_player = $(sr, '#gmi-FilmPlayer')
	if (film_player) {
		let sources = JSON.parse(film_player.getAttribute('gmon-sources'));
		let source_list = Object.values(sources);
		source_list.sort((a, b) => b.height - a.height);

		stashinfo.downloadurl = source_list[0].src;
		stashmeta.stashExt = /\.(\w+)$/.exec(stashinfo.downloadurl)[1];

		return { stashinfo, stashmeta };
	}

	stashinfo.downloadurl = $(sr, '.dev-page-download').href;

	let nopreview = $(sr, '.nopreview h2');
	if (nopreview) {
		stashmeta.stashExt = nopreview.textContent.toLowerCase();
		return { stashinfo, stashmeta };
	}

	let dlbuttontext = $(sr, '.dev-page-download .text');
	stashmeta.stashExt = dlbuttontext.textContent.split(' ')[0].toLowerCase();
	return { stashinfo, stashmeta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.deviantart.download.handleDownloads = async function (downloads, options, progress) {
	if (options.moveFile && downloads.length > 1) {
		let stashfolder = /.*\//.exec(options.stashFile);
		let newf = options.file.split('/').pop();
		if (stashfolder) {
			newf = stashfolder[0] + newf;
		}
		downloads[0].filename = newf;
		downloads[0].meta = downloads[1].meta;
	}

	progress.start('Starting download');

	let bytes = 0;
	let total = downloads.length;
	let results = [];

	let blob;
	if (downloads[0].blob) {
		blob = downloads[0].blob;
		progress.blobProgress(0, total, bytes, blob.size, blob.size);
	}
	else {
		blob = await fetchBlob(downloads[0].url, (loaded, blobtotal) => {
			progress.blobProgress(0, total, bytes, loaded, blobtotal || downloads[0].filesize);
		});
	}
	bytes += blob.size;

	let result = await downloadBlob(blob, downloads[0].filename, downloads[0].meta);
	results.push(result);

	if (total <= 1) {
		return results;
	}
	let downloadworker = new Worker(browser.runtime.getURL('/workers/downloadworker.js'));

	//assuming all downloads after the first one are stash downloads
	for (let i = 1; i < total; i += 1) {
		let stashblob;
		if (downloads[i].blob) {
			stashblob = downloads[i].blob;
			progress.blobProgress(i, total, bytes, blob.size, blob.size);
		}
		else {
			stashblob = await workerMessage(downloadworker, 'downloadblob', downloads[i].url, (data) => {
				progress.blobProgress(i, total, bytes, data.loaded, data.total);
			});
		}
		bytes += stashblob.size;

		let result = await downloadBlob(stashblob, downloads[i].filename, downloads[i].meta);
		results.push(result);
	}
	downloadworker.terminate();

	return results;
}

//---------------------------------------------------------------------------------------------------------------------
// download helper functions
//---------------------------------------------------------------------------------------------------------------------

async function compareUrls(url, options) {
	//old larger url link
	//downloadurl = `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}/v1/fill/w_5100,h_5100,q_100,bl/${u[9].split('?token=')[0]}`;
	//possible new larger link
	let u = url.split('/');
	let newurl = `https://${u[2]}/intermediary/f/${u[4]}/${u[5]}`;

	let compare = await Promise.all([getImage(url), getImage(newurl)]);
	if (compare[0].resolution < compare[1].resolution) {
		url = newurl;
	}

	return url;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getImage(imgsrc) {
	let result = await Promise.all([imgSize(imgsrc), imgDim(imgsrc)]);
	return {
		url: imgsrc,
		filesize: result[0],
		resolution: result[1]
	};

	async function imgSize(src) {
		let imgres = await fetcher(src);
		return (imgres.ok) ? parseInt(imgres.headers.get('content-length'), 10) : 0;
	}

	function imgDim(src) {
		return new Promise((resolve, reject) => {
			let img = new Image;
			img.onload = function () { resolve(this.width * this.height); };
			img.onerror = () => resolve(0);
			img.src = src;
		});
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function deviantArtFileName(title, user, subid) {
	let id36 = subid.toString(36);
	let titlelower = title.replace(/[\s\W]/g, '_').toLowerCase();
	let userlower = user.toLowerCase();
	return `${titlelower}_by_${userlower}_d${id36}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function workerMessage(worker, func, data, callback) {
	let result = new Promise((resolve, reject) => {
		worker.onmessage = m => {
			switch (m.data.message) {
				case 'progress':
					callback(m.data);
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

	worker.postMessage({ function: func, data });

	return await result;
}

//---------------------------------------------------------------------------------------------------------------------
// literature conversion
//---------------------------------------------------------------------------------------------------------------------
// to html

async function literatureToHtml(r, meta, options) {
	let page = await fetcher(r.url, 'document');

	let storyelem = $(page, 'section .da-editor-journal > div > div > div, section .legacy-journal') || $create('div');
	let story = cleanContent(storyelem);
	story.firstElementChild.id = 'content';

	let words = getElementText(story.cloneNode(true)).replace(/[^\w\s]+/g, '').match(/\w+/g).length;

	if (options.includeImage) {
		let iconurl = await getImageIcon(meta.submissionId);
		if (iconurl && !story.innerHTML.includes(iconurl)) {
			$insert($insert(story, 'div', { position: 'afterbegin', id: 'image' }), 'img', { src: iconurl });
		}
	}

	let descelem = $(page, '[role=complementary] + div .legacy-journal') || $create('div');
	let description = cleanContent(descelem);
	description.firstElementChild.id = 'description';

	//make sure images in the story are all full quality
	story = await upgradeContentImages(story, options.embedImages);
	description = await upgradeContentImages(description, options.embedImages);

	let storymeta = {
		story: story.innerHTML,
		description: description.innerHTML,
		wordCount: words,
		url: r.url,
		...meta
	}

	let html = options.literatureHTML;
	for (let [key, value] of Object.entries(storymeta)) {
		html = html.replace(RegExp(`{${key}}`, 'g'), `${value}`);
	}

	return new Blob([html], { type: 'text/html' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function stashLiteratureToHtml(sr, meta, options) {
	let storyelem = $(sr, '.journal-wrapper font, .journal-wrapper .text') || $create('div');
	let story = cleanContent(storyelem);
	story.firstElementChild.id = 'content';

	let words = getElementText(story.cloneNode(true)).replace(/[^\w\s]+/g, '').match(/\w+/g).length;

	let descelem = $(sr, '.dev-description') || $create('div');
	let description = cleanContent(descelem);
	description.firstElementChild.id = 'description';

	//make sure images in the story are all full quality
	story = await upgradeContentImages(story, options.embedImages);
	description = await upgradeContentImages(description, options.embedImages);

	let storymeta = {
		story: story.innerHTML,
		stashDescription: description.innerHTML,
		wordCount: words,
		stashUrl: $(sr, 'link[rel=canonical]').href,
		...meta
	}

	let html = options.stashLiteratureHTML;
	for (let [key, value] of Object.entries(storymeta)) {
		html = html.replace(RegExp(`{${key}}`, 'g'), `${value}`);
	}

	return new Blob([html], { type: 'text/html' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getImageIcon(submissionId) {
	let params = new URLSearchParams({
		url: `https://www.deviantart.com/deviation/${submissionId}`,
		format: 'json'
	});
	let back = await fetcher(`https://backend.deviantart.com/oembed?${params}`, 'json');
	return back.fullsize_url;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function cleanContent(element) {
	//simplify thumbnail journal links
	$$(element, 'a.lit').forEach(l => l.textContent = l.href);

	element = DOMPurify.sanitize(element, {
		IN_PLACE: true,
		FORBID_TAGS: ['style'],
		FORBID_ATTR: ['id', 'class', 'style', 'srcset'],
		ALLOW_DATA_ATTR: false
	});

	//remove unecessary div and span elements
	for (let elem of $$(element, 'div, span')) {
		if (elem.attributes.length <= 0) {
			while (elem.firstChild) {
				elem.parentElement.insertBefore(elem.firstChild, elem);
			}
			$remove(elem);
		}
	}
	//deviant art treats paragraphs like line breaks
	//combine paragraphs
	if (element.matches('.da-editor-journal div') && element.firstChild) {
		let child = element.firstChild;
		while (child.nextSibling) {
			let next = child.nextSibling;
			if (child.nodeName === 'P' && next.nodeName === 'P') {
				child.append($create('br'), ...next.childNodes);
				$remove(next);
			}
			else {
				child = child.nextSibling;
			}
		}
	}
	//remove double spacing
	for (let elem of $$(element, 'p + br + p, p + br + br')) {
		$remove(elem.previousElementSibling);
	}

	let content = $create('div');
	let wrap = $insert(content, 'section');
	wrap.append(...element.childNodes);
	return content;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function upgradeContentImages(content, embed) {
	for (let img of $$(content, 'img')) {
		let url = img.src;
		let reg = /.+\w{12}\.\w+/.exec(url);
		if (/token=/.test(url)) {
			url = url.replace(/q_\d+/, 'q_100').replace('.jpg?', '.png?');
		}
		else if (reg) {
			url = reg[0];
		}
		//convert images to data urls
		img.src = (embed) ? await urlToDataUrl(url) : url;
	}

	return content;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function urlToDataUrl(url) {
	let blob = await fetcher(url, 'blob');
	return await new Promise((resolve, reject) => {
		let fr = new FileReader();
		fr.onload = data => resolve(data.target.result);
		fr.readAsDataURL(blob);
	});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// to txt

async function literatureToText(r, meta, options) {
	let page = await fetcher(r.url, 'document');
	let storyelem = $(page, 'section .da-editor-journal > div > div > div, section .legacy-journal') || $create('div');
	let story = getElementText(storyelem);

	let words = story.replace(/[^\w\s]+/g, '').match(/\w+/g).length;

	let descelem = $(page, '[role=complementary] + div .legacy-journal') || $create('div');
	let description = getElementText(descelem);

	let storymeta = {
		story: story,
		description: description,
		wordCount: words,
		url: r.url,
		...meta
	}

	let text = options.literatureText;
	for (let [key, value] of Object.entries(storymeta)) {
		text = text.replace(RegExp(`{${key}}`, 'g'), `${value}`);
	}

	return new Blob([text], { type: 'text/txt' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function stashLiteratureToText(sr, meta, options) {
	let storyelem = $(sr, '.journal-wrapper font, .journal-wrapper .text') || $create('div');
	let story = getElementText(storyelem);

	let words = story.replace(/[^\w\s]+/g, '').match(/\w+/g).length;

	let descelem = $(sr, '.dev-description') || $create('div');
	let description = getElementText(descelem);

	let storymeta = {
		story: story,
		stashDescription: description,
		wordCount: words,
		stashUrl: $(sr, 'link[rel=canonical]').href,
		...meta
	}

	let text = options.stashLiteratureText;
	for (let [key, value] of Object.entries(storymeta)) {
		text = text.replace(RegExp(`{${key}}`, 'g'), `${value}`);
	}

	return new Blob([text], { type: 'text/txt' });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getElementText(elem) {
	elem = cleanContent(elem);
	$$(elem, 'li').forEach(li => li.insertAdjacentText('afterbegin', '  ●  '));
	for (let a of $$(elem, 'a')) {
		a.href = a.href.replace(/https?:\/\/www\.deviantart\.com\/users\/outgoing\?/g, '');
		a.textContent = a.href;
	}

	let renderer = $insert(document.body, 'div', { class: 'artsaver-text-render' });
	renderer.append(...elem.childNodes);

	let text = renderer.innerText;
	//fix for lists
	text = text.replace(/  ●  \n\n/g, '  ●  ');
	$remove(renderer);

	return text;
}