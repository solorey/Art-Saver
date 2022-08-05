//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function getPageInfo() {
	let page = {
		url: window.location.href,
		site: 'inkbunny'
	};

	let path = new URL(page.url).pathname;

	let reg = /^\/([^\/\.]+)(?:\/([^\/]+))?/.exec(path);
	if (reg) {
		page.page = (!reg[2] && $('title').textContent.split(' |')[0].endsWith('< Profile')) ? 'user' : reg[1];
	}
	if (page.page === 's') {
		page.page = 'submission';
	}
	else if (page.page === 'j') {
		page.page = 'journal';
	}

	if (['user', 'gallery', 'scraps', 'journals', 'journal', 'submission', 'poolslist'].includes(page.page)) {
		page.user = $('.elephant_555753 a[href^="https://inkbunny.net/"] > img').alt;
	}
	else if (['submissionsviewall'].includes(page.page)) {
		let imgicon = 'a[href^="https://inkbunny.net/"] > img';
		let userimage = $(`.elephant_555753 ${imgicon}, .elephant_888a85 ${imgicon}`);
		let favsby = /favsby=(\w+)/.exec(page.url);
		if (userimage) {
			page.user = userimage.alt;
		}
		else if (favsby) {
			page.user = favsby[1];
		}
	}
	return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUserInfo(user_id) {
	let userpage = await fetcher(`https://inkbunny.net/${user_id}`, 'document');

	let user = {
		site: 'inkbunny',
		id: user_id,
		name: user_id
	}

	let number_id;
	if (userpage instanceof Error) {
		user.icon = $(`img[alt=${user.name}]`).src;
		number_id = '{userId}';
		user.stats = new Map([]);
	}
	else {
		user.icon = $(userpage, '.elephant_555753 a[href^="https://inkbunny.net/"] > img').src;
		number_id = $(userpage, 'a[href*="user_id="]').href.split('=').pop();

		let favpage = await fetcher(`https://inkbunny.net/userfavorites_process.php?favs_user_id=${number_id}`, 'document');

		let stats = $$(userpage, '.elephant_babdb6 .content > div > span strong').map(s => s.textContent.replace(/,/g, ''));
		user.stats = new Map([
			['Submissions', stats[1]],
			['Favorites', $(favpage, '.elephant_555753 .content > div:first-child').textContent.split(' ')[0].replace(/,/g, '')],
			['Views', stats[4]]
		]);
	}

	user.folderMeta = {
		site: user.site,
		userName: user.name,
		userId: number_id
	};

	return user;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userHomeLink(userName) {
	return `https://inkbunny.net/${userName}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userGalleryLink(userName) {
	return `https://inkbunny.net/gallery/${userName}`;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

function startChecking() {
	asLog('Checking Inkbunny');
	let page = getPageInfo();
	checkPage(page);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkPage(page) {
	checkThumbnails(getThumbnails(), page.user);

	if (page.page === 'submission') {
		checkSubmission(page.user, page.url);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getThumbnails() {
	let widgets = $$('.widget_imageFromSubmission');
	for (let parent of $$('#files_area, .content.magicboxParent')) {
		widgets = widgets.filter(w => !parent.parentElement.contains(w));
	}
	return widgets;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkThumbnails(thumbnails, user) {
	for (let widget of thumbnails) {
		try {
			let sub = $(widget, 'img');
			let url = $(widget, 'a').href;
			let subid = parseInt(/\/(\d+)/.exec(url)[1], 10);

			let otheruser = /\sby\ (\w+)(?:$|(?:\ -\ ))/.exec(sub.alt);
			let subuser = otheruser ? otheruser[1] : user;

			addButton('inkbunny', subuser, subid, sub.parentElement);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkSubmission(user, url) {
	let contentbox = $('.content.magicboxParent');
	if (!contentbox) {
		return;
	}

	try {
		let subid = parseInt(/\/(\d+)/.exec(url)[1], 10);
		let submission = $(contentbox, '#magicbox, .widget_imageFromSubmission img, #mediaspace');
		if (submission.matches('img')) {
			submission.style.display = 'block';
		}
		let parent = submission.parentElement;
		if (parent.matches('a')) {
			parent.style.display = 'inline-block';
		}
		parent.style.position = 'relative';

		addButton('inkbunny', user, subid, parent, false);
	}
	catch (err) { }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

async function startDownloading(subid, progress) {
	progress.say('Getting submission');
	let options = await getOptions('inkbunny');
	let pageurl = `https://inkbunny.net/s/${subid}`;

	try {
		let response = await fetcher(pageurl, 'document');

		let { info, meta } = getMeta(response, progress);
		let downloads = await createDownloads(info, meta, options, progress);

		let results = await handleDownloads(downloads, progress);
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

function getMeta(r, progress) {
	let info = {}, meta = {};
	meta.site = 'inkbunny';
	meta.title = $(r, '#pictop h1').textContent;
	meta.userName = $(r, '#pictop a[href^="https://inkbunny.net/"] > img').alt;
	try {
		meta.userId = $(r, 'a[href*="user_id"]').href.split('=').pop(); //unavailable when logged out
	}
	catch (err) { }

	meta.submissionId = parseInt(/\/(\d+)/.exec($(r, '[rel="canonical"]').href)[1], 10);
	meta = { ...meta, ...timeParse(/(.+) /.exec($(r, '#submittime_exact').textContent)[1]) };

	info.savedSite = meta.site;
	info.savedUser = meta.userName;
	info.savedId = meta.submissionId;

	info.pages = 1;

	let pages = $(r, '#files_area span');
	if (pages) {
		let p = pages.textContent.split(' ');
		info.pages = parseInt(p[2], 10);
	}

	let pm = getPageMeta(r);
	return { info: { ...info, ...pm.info }, meta: { ...meta, ...pm.meta } };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getPageMeta(r) {
	let info = {}, meta = {};

	let pages = $(r, '#files_area span');
	if (pages) {
		meta.page = pages.textContent.split(' ')[0];
	}

	let sub = $(r, '.content.magicboxParent');
	//Check if these elements exist in order
	let downloadlink = $(sub, 'a[download=""]') || $(sub, 'a[href^="https://tx.ib.metapix.net/files/full/"]') || $(sub, 'img[src*=".ib.metapix.net/files/"]');

	info.downloadurl = decodeURI(downloadlink.href || downloadlink.src);

	let reg = /\/((\d+)_.+)\.(.+)$/.exec(info.downloadurl);
	meta.fileName = reg[1];
	meta.fileId = reg[2];
	meta.ext = reg[3];

	return { info, meta };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createDownloads(info, meta, options, progress) {
	let downloads = [{ url: info.downloadurl, meta, filename: options.file }];
	if (info.pages <= 1) {
		return downloads;
	}
	else {
		downloads[0].filename = options.multiple;
	}

	for (let i = 2; i <= info.pages; i += 1) {
		progress.onOf('Getting page', i, info.pages);

		let page;
		while (true) {
			page = await fetcher(`https://inkbunny.net/s/${meta.submissionId}-p${i}`, 'document');
			if (page instanceof Error) {
				await timer(4); //seconds
			}
			else {
				break;
			}
		}
		let pm = getPageMeta(page);
		downloads.push({
			url: pm.info.downloadurl,
			filename: options.multiple,
			meta: { ...meta, ...pm.meta }
		});
	}

	return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function handleDownloads(downloads, progress) {
	return await handleAllDownloads(downloads, progress);
}