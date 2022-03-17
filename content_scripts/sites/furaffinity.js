//---------------------------------------------------------------------------------------------------------------------
// page and user information
//---------------------------------------------------------------------------------------------------------------------

function getPageInfo() {
	let page = {
		url: window.location.href,
		site: 'furaffinity'
	};
	let split = page.url.split('/');
	page.page = split[3];
	page.modern = $('#ddmenu') ? true : false;

	if (['user', 'journals', 'gallery', 'scraps', 'favorites', 'commissions'].includes(page.page)) {
		page.user = split[4];
	}
	else if (['view', 'full'].includes(page.page)) {
		page.user = $('.classic-submission-title a, .submission-id-avatar a').href.split('/')[4];
	}
	else if (page.page === 'journal') {
		page.user = $('.maintable .avatar-box a, .user-nav .current').href.split('/')[4];
	}

	return page;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUserInfo(user_id) {
	let userpage = await fetcher(`https://www.furaffinity.net/user/${user_id}/`, 'document');
	let modern = $(userpage, '#ddmenu');
	let iconelement = $(userpage, modern ? 'img.user-nav-avatar' : 'img.avatar');

	let user = {
		site: 'furaffinity',
		id: user_id,
	}

	if (iconelement) {
		user.icon = iconelement.src;
		user.name = /([^ ]+)(?: -- Fur |'s)/.exec($(userpage, 'title').textContent)[1]

		let stats = modern ? $(userpage, 'div[class^=userpage-section-] .cell') : $(userpage, '[title^="Once"]').parentElement;
		stats = stats.textContent.replace(/\D+/g, ' ').trim().split(' ');

		if (modern) {
			user.stats = new Map([
				['Submissions', stats[1]],
				['Favs', stats[2]],
				['Views', stats[0]]
			]);
		}
		else {
			user.stats = new Map([
				['Submissions', stats[1]],
				['Favorites', stats[5]],
				['Page Visits', stats[0]]
			]);
		}
	}
	else {
		user.name = /"(.+?)"/.exec($(userpage, '.alt1, .redirect-message').textContent)[1]
		user.stats = new Map([]);
		user.icon = $('.submission-id-avatar img, .avatar img').src;
	}

	user.folderMeta = {
		site: user.site,
		userName: user.name,
		userLower: user.id
	};

	return user;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userHomeLink(userLower) {
	return `https://www.furaffinity.net/user/${userLower}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userGalleryLink(userLower) {
	return `https://www.furaffinity.net/gallery/${userLower}`;
}

//---------------------------------------------------------------------------------------------------------------------
// main add checks and download buttons to image thumbnails
//---------------------------------------------------------------------------------------------------------------------

function startChecking() {
	asLog('Checking Fur Affinity');
	let page = getPageInfo();
	checkPage(page);

	let observer = new MutationObserver((mutationsList, observer) => {
		let changed = [...mutationsList].filter(m => m.attributeName === 'id').map(m => m.target);
		//remove art saver buttons
		changed.flatMap(c => $$(c, '.artsaver-check, .artsaver-download, .artsaver-screen')).forEach(e => $remove(e));
		//remove attribute indicating the submission has already been checked
		for (let c of changed) {
			c.removeAttribute('data-checkstatus');
			$$(c, '[data-checkstatus]').forEach(e => {
				e.removeAttribute('data-checkstatus');
			});
		}

		changed = changed.map(c => (c.matches('.preview_img a') ? c.parentElement.parentElement : c));
		checkThumbnails(changed, page.user);
	});

	globalrunningobservers.push(observer);

	if (page.page === 'user') {
		//gallery highlight submissions on the user page
		$$('[class*="userpage-first"] > b, .section-body > .preview_img > a').forEach(e => observer.observe(e, { attributes: true }));
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkPage(page) {
	checkThumbnails(getThumbnails(), page.user);

	if (['view', 'full'].includes(page.page)) {
		checkSubmission(page.user, page.url, page.modern);
	}

	if (page.page === 'user') {
		checkUserFavorites();
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getThumbnails() {
	$$('.preview-gallery-container').forEach(c => { c.style.position = 'relative' });

	let previews = [];

	for (let pimg of $$('.section-body > .preview_img')) {
		pimg.firstElementChild.style.position = 'relative';
		previews.push(pimg.parentElement);
	}

	let profile = $('.section-submission');
	if (profile) {
		previews.push(profile);

		if (!$(profile, '.artsaver-holder')) {
			$insert($(profile, 'img'), 'div', { position: 'parent', class: 'artsaver-holder' });
		}
	}

	return [...$$(':not(#gallery-latest-favorites) > [id^="sid"], .preview-gallery-container'), ...previews];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkThumbnails(thumbnails, user) {
	for (let figure of thumbnails) {
		try {
			let sub = $(figure, 'img');
			let url = $(figure, 'a').href;
			let subid = parseInt(url.split('/')[4], 10);

			let otheruser = $(figure, 'a[href^="/user/"]');
			let subuser = otheruser ? otheruser.getAttribute('href').split('/')[2] : user;

			addButton('furaffinity', subuser, subid, sub.parentElement);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkUserFavorites() {
	let favdata = JSON.parse(/submission_data\ =\ (.+);/.exec($('#pageid-userpage > div > script, #page-userpage + script').textContent)[1]);

	for (let fav of $$('#gallery-latest-favorites > [id^="sid"]')) {
		try {
			let sub = $(fav, 'img');
			let subid = parseInt(/(\d+)/.exec(fav.id)[1], 10);
			let user = favdata[subid].lower;

			addButton('furaffinity', user, subid, sub.parentElement);
		}
		catch (err) { }
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkSubmission(user, url, modern) {
	let submission = $('img#submissionImg');
	if (!submission) {
		return;
	}
	//checkSubmission(submission.parentElement);
	if (!submission.matches('.artsaver-holder *')) {
		let holder = $insert(submission, 'div', { position: 'parent', class: 'artsaver-holder' });

		if (modern) {
			holder.style.margin = '10px 0';
			holder.style.display = 'inline-table';
			submission.style.margin = '0';
		}
		else {
			holder.style.maxWidth = '99%';
			let flex = $insert(submission, 'div', { position: 'parent' });
			flex.style.display = 'flex';
			submission.style.maxWidth = '100%';
		}
	}

	try {
		let subid = parseInt(url.split('/')[4], 10);

		addButton('furaffinity', user, subid, submission.parentElement, false);
	}
	catch (err) { }
}

//---------------------------------------------------------------------------------------------------------------------
// main download function
//---------------------------------------------------------------------------------------------------------------------

async function startDownloading(subid, progress) {
	progress.say('Getting submission');
	let options = await getOptions('furaffinity');
	let pageurl = `https://www.furaffinity.net/view/${subid}`;

	try {
		let response = await fetcher(pageurl, 'document');

		let { info, meta } = getMeta(response, pageurl, progress);
		let downloads = [{ url: info.downloadurl, meta, filename: options.file }];

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

function getMeta(r, url, progress) {
	let info = {}, meta = {};
	meta.site = 'furaffinity';
	meta.userName = /([^ ]+)(?: -- )/.exec($(r, 'title').textContent)[1];

	info.downloadurl = decodeURI($(r, 'a[href*="/art/"]').href);

	//example download urls
	//https://d.furaffinity.net/art/username/0123456789/0123456789.username_filename.ext
	//https://d.furaffinity.net/art/username/0123456789/0123456789.username.filename.ext
	//https://d.furaffinity.net/download/art/username/category/0123456789/0123456789.username_filename.ext
	//https://d.furaffinity.net/art/username/0123456789/username_0123456789_filename.ext
	//https://d.furaffinity.net/art/username/0123456789/usernamefilename.ext

	let reg = /\/art\/(.+?)\/(?:.+\/)*(\d+)\/((\d+)?(?:.+_(\d{10,}))?.+?)\.(\w+)$/.exec(info.downloadurl);
	meta.userLower = reg[1];
	meta.fileName = reg[3];
	meta.fileId = reg[4] || reg[5] || reg[2];
	meta.ext = reg[6];

	meta.submissionId = parseInt(url.split('/')[4], 10);
	meta.title = $(r, 'div.classic-submission-title > h2, .submission-title p').textContent;

	meta = { ...meta, ...timeParse(parseInt(`${meta.fileId}000`, 10)) };

	info.savedSite = meta.site;
	info.savedUser = meta.userLower;
	info.savedId = meta.submissionId;
	return { info, meta }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function handleDownloads(downloads, progress) {
	return await handleAllDownloads(downloads, progress);
}