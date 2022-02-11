var as = { inkbunny: { check: {}, download: {} } };

//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function pageInfo() {
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

as.inkbunny.userInfo = async function (user_id) {
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

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

as.inkbunny.check.startChecking = function () {
	asLog('Checking Inkbunny');
	let page = pageInfo();
	this.checkPage(page);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.checkPage = function (page) {
	this.checkThumbnails(this.getThumbnails(), page.user);

	if (page.page === 'submission') {
		this.checkSubmission(page.user, page.url);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.getThumbnails = function () {
	let widgets = $$('.widget_imageFromSubmission');
	for (let parent of $$('#files_area, .content.magicboxParent')) {
		widgets = widgets.filter(w => !parent.parentElement.contains(w));
	}
	return widgets;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.check.checkThumbnails = function (thumbnails, user) {
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

as.inkbunny.check.checkSubmission = function (user, url) {
	let contentbox = $('.content.magicboxParent');
	if (!contentbox) {
		return;
	}

	try {
		let subid = parseInt(/\/(\d+)/.exec(url)[1], 10);
		let submission = $(contentbox, '#magicbox, .widget_imageFromSubmission img, #mediaspace');

		let holder = $(contentbox, '.artsaver-holder');
		if (!holder) {
			holder = $insert(submission, 'div', { position: 'parent', class: 'artsaver-holder' });
		}

		addButton('inkbunny', user, subid, holder, false);
	}
	catch (err) { }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

as.inkbunny.download.startDownloading = async function (subid, progress) {
	progress.say('Getting submission');
	let options = await getOptions('inkbunny');
	let pageurl = `https://inkbunny.net/s/${subid}`;

	try {
		let response = await fetcher(pageurl, 'document');

		let { info, meta } = this.getMeta(response, progress);
		let downloads = await this.createDownloads(info, meta, options, progress);

		let results = await this.handleDownloads(downloads, progress);
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

as.inkbunny.download.getMeta = function (r, progress) {
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

	let pm = this.getPageMeta(r);
	return { info: { ...info, ...pm.info }, meta: { ...meta, ...pm.meta } };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.download.getPageMeta = function (r) {
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

as.inkbunny.download.createDownloads = async function (info, meta, options, progress) {
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
		let pm = this.getPageMeta(page);
		downloads.push({
			url: pm.info.downloadurl,
			filename: options.multiple,
			meta: { ...meta, ...pm.meta }
		});
	}

	return downloads;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

as.inkbunny.download.handleDownloads = async function (downloads, progress) {
	return await handleAllDownloads(downloads, progress);
}