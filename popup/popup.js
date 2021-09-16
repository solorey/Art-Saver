var globalopened = false;
var globalrunningobservers = [];
var globalpopupstate;

//---------------------------------------------------------------------------------------------------------------------
// state functions
//---------------------------------------------------------------------------------------------------------------------

browser.storage.local.get('popup_state').then(s => globalpopupstate = s.popup_state);

function updateState(component, value){
	globalpopupstate[component] = value;
	browser.runtime.sendMessage({
		function: 'updatestate',
		ui: 'popup',
		component,
		value
	});
}

//---------------------------------------------------------------------------------------------------------------------
// page information
//---------------------------------------------------------------------------------------------------------------------

async function getPageInfo(){
	let tabs = await browser.tabs.query({
		active: true,
		currentWindow: true
	});
	let id = tabs[0].id;

	send(id, 'sitestats');

	$('#download-all').onclick = () => send(id, 'downloadall');
	$('#recheck').onclick = () => send(id, 'recheck');
}

getPageInfo();

//---------------------------------------------------------------------------------------------------------------------
// message send/listen functions
//---------------------------------------------------------------------------------------------------------------------

function send(id, message){
	browser.tabs.sendMessage(id, {
		command: message,
	}).catch(() => {
		openTab('unsupported-page');
	});
}

browser.runtime.onMessage.addListener(request => {
	messageActions(request);
});

async function messageActions(request){
	if (request.function === 'pageerror'){
		openTab('unsupported-page');
		return;
	}
	let savedkey = `${request.site}_saved`;
	let sitekey = `${request.site}_options`;

	let res = await browser.storage.local.get([savedkey, sitekey]);

	switch(request.function){
		case 'sitestats':
			siteStats(request, res[savedkey] || {});
			break;

		case 'userstats':
			userStats(request, res[sitekey]);
	}
}

//---------------------------------------------------------------------------------------------------------------------
// tabs
//---------------------------------------------------------------------------------------------------------------------

function openTab(tab){
	$$('.tabs > button').forEach(t => t.classList.remove('active'));
	$$('.tab-content').forEach(t => t.classList.add('hide'));

	let tabbutton = $(`.tabs > button[data-tab="${tab}"]`);
	if (tabbutton){
		tabbutton.classList.add('active');
	}
	$(`#${tab}`).classList.remove('hide')
}

openTab('getting-page');

for (let t of $$('.tabs > button[data-tab]')){
	t.onclick = function(){
		let tab = this.getAttribute('data-tab');

		openTab(tab);

		switch (tab){
			case 'user-page':
				updateState('tab', 'user');
				break;

			case 'stats-page':
				updateState('tab', 'stats');
				break;
		}
	};
}

$('#settings-tab').onclick = () => browser.runtime.openOptionsPage();

//---------------------------------------------------------------------------------------------------------------------
// download all button
//---------------------------------------------------------------------------------------------------------------------

function toggleDownload(){
	let lock = $('#download-lock');
	let bolt = $('#download-bolt');
	let dlall = $('#download-all');

	if (lock.getAttribute('data-toggle') === 'closed'){
		lock.setAttribute('data-toggle', 'open');
		bolt.className = 'icon-lock-open';
		dlall.removeAttribute('disabled');
		return false;
	}
	else {
		lock.setAttribute('data-toggle', 'closed');
		bolt.className = 'icon-lock-closed';
		dlall.setAttribute('disabled', true);
		return true;
	}
}

$('#download-lock').onclick = () => {
	updateState('downloadLock', toggleDownload());
};

//---------------------------------------------------------------------------------------------------------------------
// stats
//---------------------------------------------------------------------------------------------------------------------

function siteStats(request, sitelist){
	globalrunningobservers.forEach(ob => ob.disconnect());
	globalrunningobservers = [];

	$('#stats-tab').classList.remove('hide');
	$('#stats-site').textContent = SITEINFO[request.site].label;

	$('#downloads-stat').textContent = request.total.downloads;
	if (!globalpopupstate.downloadLock){
		$('#download-lock').setAttribute('data-toggle', 'open');
		$('#download-bolt').className = 'icon-lock-open';
		$('#download-all').removeAttribute('disabled');
	}
	$('#saved-stat').textContent = request.total.saved;

	let savedstats = {
		user: [...new Set(Object.keys(sitelist))].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base', numeric: true})),
		submission: [...new Set(Object.values(sitelist).flat())].sort((a, b) => b - a)
	};

	let createrows = {
		user: (u) => createUserRow(request.site, u),
		submission: (s) => createSubmissionRow(request.site, s)
	};

	for (let [stat, list] of Object.entries(savedstats)){
		let rowelem = $(`#total-${stat}s`);
		let listelem = $(`#${stat}-list`);

		$(rowelem, '.badge').textContent = list.length;

		classToggle(list.length > 0, rowelem, 'stat-button')
		if (list.length > 0){
			let searchbox = $(listelem, '.search-box');
			let list = createVirtualList($(listelem, '.list-box'), searchResult(searchbox, savedstats[stat]), createrows[stat]);
			setupSearch(list, searchbox, savedstats[stat]);

			rowelem.onclick = function(){
				classToggle(!listelem.classList.toggle('hide'), this, 'active');
			};
		}
	}

	let ul = $('#user-list .list-box');
	let srow = $('#submission-list');
	let sl = $('#submission-list .list-box');

	let resize = new ResizeObserver(() => {
		let sblock = srow.classList.contains('hide') ? 45 : 0;
		ul.style.maxHeight = `${600 - ul.offsetTop - sblock}px`;
		sl.style.maxHeight = `${600 - sl.offsetTop}px`;
	});
	globalrunningobservers.push(resize);
	resize.observe(ul);
	resize.observe(sl);

	openTab('stats-page');
	if (request.user && !globalopened){
		$('#user-tab').classList.remove('hide');
		if (globalpopupstate['tab'] === 'user'){
			openTab('user-page');
		}
		globalopened = true;
	}
}

function createUserRow(site, reguser){
	let links = SITEINFO[site].links;

	let row = $('#user-row-template').content.cloneNode(true);
	let spans = $$(row, 'span')
	spans[0].textContent = reguser[1];
	spans[1].textContent = reguser[reguser.length - 1];
	$(row, 'strong').textContent = reguser[2];

	let alinks = $$(row, 'a');
	alinks[0].href = links.user(reguser[0]);
	alinks[1].href = links.gallery(reguser[0]);
	alinks[2].href = links.favorites(reguser[0]);
	return row.firstElementChild;
}

function createSubmissionRow(site, regsubmission){
	let links = SITEINFO[site].links;

	let row = $('#submission-row-template').content.cloneNode(true);
	let spans = $$(row, 'span')
	spans[0].textContent = regsubmission[1];
	spans[1].textContent = regsubmission[regsubmission.length - 1];
	$(row, 'strong').textContent = regsubmission[2];

	$(row, 'a').href = links.submission(regsubmission[0]);
	return row.firstElementChild;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userStats(request, siteoptions){
	let user = request.user;

	$('#profile-cover').style.width = 'auto';

	let pic = $('#profile-pic');
	//make sure user icon url provided by the site is safe to display in the popup
	//using DOMPurify as recommended by Mozilla
	pic.src = DOMPurify.sanitize(user.icon);
	pic.classList.remove('loading-icon');

	$('#user-name').textContent = user.name;

	$('#user-buttons').classList.remove('hide');
	let links = SITEINFO[user.site].links
	$('#user-home').href = links.user(user.id);
	$('#user-gallery').href = links.gallery(user.id);
	$('#user-favorites').href = links.favorites(user.id);

	let userstats = $('#user-stats');
	$$(userstats, '.header ~ .stat-row').forEach(row => $remove(row));

	let userprofile = $('#user-profile');

	classToggle(user.stats.size <= 0, userprofile, 'no-stats');
	if (user.stats.size > 0){
		$(userstats, '.header').classList.remove('hide');

		for (let [stat, value] of user.stats.entries()){
			let row = $insert(userstats, 'div', {class: 'stat-row'});
			$insert(row, 'div', {text: stat});
			$insert($insert(row, 'div'), 'span', {class: 'badge', text: value});
		}
	}

	userstats.classList.remove('hide');

	if (user.saved.length <= 0){
		if (user.stats.size <= 0){
			userstats.classList.add('hide');
		}
		return;
	}

	let savedelem = $('#total-saved');
	$(savedelem, '.badge').textContent = user.saved.length;
	savedelem.classList.remove('hide');

	let listbox = $('#saved-list .list-box');
	let searchbox = $('#saved-list .search-box');

	listbox.style.maxHeight = `${600 - (userprofile.offsetTop + userprofile.offsetHeight + 29)}px`;

	let list = createVirtualList(listbox, searchResult(searchbox, user.saved), (s) => createSubmissionRow(user.site, s));
	setupSearch(list, searchbox, user.saved);

	savedelem.onclick = function(){
		classToggle(!$('#saved-list').classList.toggle('hide'), this, 'active');
	};

	let folderelem = $('#user-folder');
	folderelem.classList.remove('hide');
	folderelem.onclick = () => {
		browser.runtime.sendMessage({
			function: 'openuserfolder',
			folderFile: `${siteoptions.userFolder}folderopener.file`,
			meta: user.folderMeta
		});
	};
}