var globalsavedinfo;
var globalrunningobservers = [];
var globaltooltip = createTooltip();
var globaloptions;
var globalqueue;
var globalbuttons = createButtonsState();

const optionsKey = (s) => `${s}_options`;
const savedKey = (s) => `${s}_saved`;

main();

async function main(){
	globaloptions = await getOptions('global');
	document.body.style.setProperty('--as-icon-size', `${globaloptions.iconSize}px`);

	globalqueue = createPageQueue(globaloptions.useQueue, {
		concurrent: globaloptions.queueConcurrent,
		waittime: globaloptions.queueWait,
		infobar: globaloptions.infoBar ? await createPageInfoBar() : false
	});

	let page = await getPage();

	await setSavedInfo(page.site);

	as[page.site].check.startChecking();
	//$insert(document.body, 'button', {id: 'artsaver-test-button', text: 'test button'}).onclick = () => testing();
}

//function testing(){
//	asLog(globalbuttons);
//}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getOptions(site){
	let key = optionsKey(site);
	let res = await browser.storage.local.get(key);
	return res[key];
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setSavedInfo(site){
	let key = savedKey(site);
	let item = await browser.storage.local.get(key);
	globalsavedinfo = item[key] || {};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getPage(){
	return new Promise((resolve, reject) => {
		try {
			resolve(pageInfo());
		}
		catch (err){
			setTimeout(() => resolve(getPage()), 300);
		}
	});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function reCheck(){
	let page = await getPage();
	await setSavedInfo(page.site);

	globalrunningobservers.forEach(ob => ob.disconnect());
	globalrunningobservers = [];

	$$('[data-checkstatus]').forEach(e => e.removeAttribute('data-checkstatus'));
	$$('.artsaver-check, .artsaver-screen').forEach(e => $remove(e));

	as[page.site].check.startChecking();
}

//---------------------------------------------------------------------------------------------------------------------
// quality of life functions
//---------------------------------------------------------------------------------------------------------------------
//themed console log

function asLog(...texts){
	let log = ['%c[Art Saver]%c', 'color: #006efe', ''];
	if (typeof(texts[0]) === 'string'){
		log[0] += ` ${texts.shift()}`;
	}
	console.log(...log.concat(texts));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//simpler fetch function with document support

async function fetcher(url, type = 'response', init = {}){
	init = {
		credentials: 'include',
		referrer: window.location.href,
		...init
	};

	let response = await fetch(url, init);

	if (!response.ok && type !== 'response'){
		let err = new Error(url);
		err.name = `Error ${response.status}`;
		return err;
	}

	switch (type){
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
// main on page buttons state
//---------------------------------------------------------------------------------------------------------------------

function createButtonsState(){
	let state = {
		idsMap: new Map(),
		runningloop: false
	};

	state.createState = function(type, site, subid){
		let base = {
			type,
			status: 'idle',
			site,
			subid,
			buttons: []
		};

		if (type === 'check'){
			this.idsMap.set(subid, base);
		}
		else if (type === 'download'){
			this.idsMap.set(subid, {
				text: '',
				width: 0,
				...base
			});
		}
	}

	state.hasId = function(subid){
		return this.idsMap.has(subid);
	}

	state.addButton = function(type, site, subid, button){
		if (!this.hasId(subid)){
			this.createState(type, site, subid);
		}
		this.idsMap.get(subid).buttons.push(button);
		this.setValue(subid, 'type', type);
	}

	state.setValue = function(subid, key, value){
		this.idsMap.get(subid)[key] = value;
		this.runUpdateLoop();
	}

	state.getValue = function(subid, key){
		return this.idsMap.get(subid)[key];
	}

	state.removeState = function(subid){
		this.idsMap.delete(subid);
	}

	state.runUpdateLoop = function(){
		if (this.runningloop){
			return;
		}
		this.runningloop = true;
		window.requestAnimationFrame(() => {state.updateButtons()});
	}

	state.cleanButtons = function(){
		//clean diconnected nodes
		for (let [subid, info] of this.idsMap){
			for (let b of info.buttons){
				if (!b.button.isConnected){
					removeListeners(b);
				}
			}
			info.buttons = info.buttons.filter(b => b.button.isConnected);
			if (info.status === 'idle' && info.buttons.length <= 0){
				this.removeState(subid);
			}
		}
	}

	state.updateButtons = function(){
		this.cleanButtons();

		let keeprunning = false;
		let recheck = false;
		for (let [subid, info] of this.idsMap){
			let status = info.status;
			switch (info.type){
				case 'check':
					updateCheck(subid, info);
					if (status === 'removing'){
						keeprunning = true;
					}
					else if (status === 'finished'){
						recheck = true;
					}
					break;

				case 'download':
					updateDownload(subid, info);
					if (status === 'inprogress'){
						keeprunning = true;
					}
					else if (status === 'finished'){
						recheck = true;
					}
					break;

				case 'error':
					updateError(subid, info);
					if (status === 'remove'){
						recheck = true;
					}
			}
		}

		if (recheck){
			reCheck();
		}
		if (keeprunning){
			window.requestAnimationFrame(() => {state.updateButtons()});
		}
		else {
			this.runningloop = false;
		}
	}

	function removeListeners(button){
		for (let e of button.events){
			e.target.removeEventListener(e.type, e.listener);
		}
		button.events = [];
	}

	function updateCheck(subid, info){
		if (info.status === 'removing'){
			for (let b of info.buttons){
				if (b.button.className !== 'artsaver-loading'){
					b.button.className = 'artsaver-loading';
					removeListeners(b);
				}
			}
		}
		else if (info.status === 'finished'){
			info.buttons.forEach(b => $remove(b.button));
			state.removeState(subid);
		}
	}

	function updateDownload(subid, info){
		if (info.status === 'inprogress'){
			for (let b of info.buttons){
				if (b.button.className !== 'artsaver-loading'){
					b.button.className = 'artsaver-loading';
					b.bar = $insert(b.button, 'div', {position: 'beforebegin', class: 'artsaver-progress'});
					$insert($insert(b.bar, 'div', {class: 'artsaver-bar'}), 'div', {class: 'artsaver-bar-text'});
					removeListeners(b);
				}
				b.bar.firstElementChild.style.width = `${info.width}%`;
				b.bar.firstElementChild.firstElementChild.textContent = info.text;
			}
		}
		else if (info.status === 'finished'){
			for (let b of info.buttons){
				$remove(b.button);
				$remove(b.bar);
			}
			state.removeState(subid);
		}
	}

	function updateError(subid, info){
		for (let b of info.buttons){
			if (b.button.className !== 'artsaver-error'){
				b.button.className = 'artsaver-error';
				$remove(b.bar);
				b.button.addEventListener('click', event => {
					event.preventDefault();
					event.stopPropagation();

					state.setValue(subid, 'status', 'remove');
				}, {once: true});
			}
		}

		if (info.status === 'remove'){
			info.buttons.forEach(b => $remove(b.button));
			state.removeState(subid);
		}
	}

	return state;
}

//---------------------------------------------------------------------------------------------------------------------
// 'create' functions
//---------------------------------------------------------------------------------------------------------------------

function createTooltip(){
	$remove($('.artsaver-tip'));

	let tip = $insert(document.body, 'div', {class: 'artsaver-tip'});
	let table = $insert(tip, 'table');
	let tr1 = $insert(table, 'tr');
	$insert(tr1, 'td', {text: 'User:'});
	$insert(tr1, 'td');
	let tr2 = $insert(table, 'tr');
	$insert(tr2, 'td', {text: 'Id:'});
	$insert(tr2, 'td');

	tooltip = {tip};

	tooltip.show = function(){
		this.tip.setAttribute('data-display', 'show');
	}
	tooltip.fade = function(){
		this.tip.removeAttribute('data-display');
	}
	tooltip.set = function(user, id){
		let fields = $$(this.tip, 'td:last-child');
		fields[0].textContent = user;
		fields[1].textContent = id;
	}
	tooltip.move = function(x, user, id){
		let rect = x.getBoundingClientRect();
		this.set(user, id);
		this.tip.style.top = `${rect.top + window.scrollY - this.tip.offsetHeight - 1}px`;
		//don't let the tooltip cross the document width
		this.tip.style.left = `${Math.min(rect.left + window.scrollX, document.body.offsetWidth - this.tip.offsetWidth)}px`;
		this.show();
	}

	return tooltip;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createCheck(site, user, subid, color, anchor, screen){
	let checkbutton = $insert(anchor, 'div', {class: 'artsaver-check', 'data-color': color});

	if (tooltip){
		checkbutton.onmouseover = function(){
			globaltooltip.move(this, user, subid);
		};
		checkbutton.onmouseout = () => {
			globaltooltip.fade();
		}
	}

	let clickevent = event => {
		event.preventDefault();
		event.stopPropagation();

		removeSubmission(site, subid);
		globaltooltip.fade();
	};

	checkbutton.addEventListener('click', clickevent, {once: true});

	if (globaloptions.addScreen && screen){
		let cover = $insert(checkbutton, 'div', {position: 'beforebegin', class: 'artsaver-screen'});
		cover.style.opacity = `${globaloptions.screenOpacity}%`;
		$insert(cover, 'div');
	}

	let events = [
		{target: checkbutton, type: 'click', listener: clickevent}
	];

	globalbuttons.addButton('check', site, subid, {button: checkbutton, events});

	return checkbutton;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function removeSubmission(site, subid){
	globalbuttons.setValue(subid, 'status', 'removing');
	try {
		globalsavedinfo = await browser.runtime.sendMessage({
			function: 'removesubmission',
			site: site,
			sid: subid
		});
	}
	catch (err){}
	globalbuttons.setValue(subid, 'status', 'finished');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createDownload(site, subid, anchor){
	let dlbutton = $insert(anchor, 'div', {class: 'artsaver-download'});

	let clickevent = event => {
		event.preventDefault();
		event.stopPropagation();

		globalqueue.addDownload(site, subid);
	};

	dlbutton.addEventListener('click', clickevent, {once: true});

	let keyevent = event => {
		if (anchor.matches(':hover') && event.key === 'd'){
			globalqueue.addDownload(site, subid);
		}
	};

	document.addEventListener('keypress', keyevent);

	let events = [
		{target: dlbutton, type: 'click', listener: clickevent},
		{target: document, type: 'keypress', listener: keyevent}
	];

	globalbuttons.addButton('download', site, subid, {button: dlbutton, events});

	return dlbutton;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createError(dlbutton){
	dlbutton.className = 'artsaver-error';
	dlbutton.addEventListener('click', function(event){
		event.preventDefault();
		event.stopPropagation();

		$remove(this);
		reCheck();
	}, {once: true});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function addButton(site, user, subid, anchor, screen = true){
	if ($(anchor, '.artsaver-error, .artsaver-loading')){
		return;
	}
	let button = $(anchor, '.artsaver-check, .artsaver-download');

	if (anchor.getAttribute('data-checkstatus') !== 'checked' && !$(anchor, '[data-checkstatus]')){
		let result = checkSavedInfo(site, user, subid);
		anchor.setAttribute('data-checkstatus', 'checked');

		if (result.found){
			$$(anchor, '[class^=artsaver]').forEach(e => $remove(e));

			button = createCheck(site, user, subid, result.color, anchor, screen);
		}
	}

	if (!button){
		button = createDownload(site, subid, anchor);
	}

	return button;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkSavedInfo(site, user, id){
	let found = false;
	let founduser = user;
	let color = 'green';

	if (globalsavedinfo[user] && globalsavedinfo[user].includes(id)){
		found = true;
	}
	else {
		for (let otheruser in globalsavedinfo){
			if (otheruser === user || !globalsavedinfo[otheruser].includes(id)){
				continue;
			}

			founduser = otheruser;
			if (user){
				color = 'yellow';
			}
			found = true;
			break;
		}
	}

	return {found, user: founduser, color};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createProgress(subid){
	let progress = {};


	progress.say = function(text){
		globalbuttons.setValue(subid, 'text', text);
	}
	progress.width = function(width){
		globalbuttons.setValue(subid, 'width', width);
	}
	progress.start = function(text){
		this.width(0);
		this.say(text);
	}
	progress.onOf = function(message, index, total){
		let multiple = (total > 1) ? ` ${index}/${total}` : '';
		this.say(`${message}${multiple}`);
	}
	progress.blobProgress = function(index, total, bytes, loaded, blobtotal){
		let block = (1 / total) * 100;
		let initalwidth = (index / total) * 100;
		let onof = (total > 1) ? `${index + 1}/${total} ` : '';
		let size = fileSize(bytes + loaded);
		if (!blobtotal){
			this.width(initalwidth + block);
			this.say(`... ${onof}${size}`);
		}
		else {
			let percent = initalwidth + (block * (loaded / blobtotal));
			this.width(percent);
			this.say(`${onof}${size} ${Math.floor(percent)}%`);
		}
	}
	progress.finished = function(){
		globalbuttons.setValue(subid, 'status', 'finished');
	}
	progress.error = function(){
		globalbuttons.setValue(subid, 'type', 'error');
		globalbuttons.setValue(subid, 'status', 'error');
	}

	return progress;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function fileSize(bytes){
	for (let size of ['bytes', 'KB', 'MB', 'GB', 'TB']){
		if (bytes < 1024 || size === 'TB'){
			return `${bytes.toFixed(2)} ${size}`;
		}
		bytes = bytes / 1024;
	}
}

//---------------------------------------------------------------------------------------------------------------------
// functions used when downloading a submission
//---------------------------------------------------------------------------------------------------------------------

function timeParse(timestring){
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

async function fetchBlob(url, callback){
	let response = await fetcher(url);

	if (!response.ok){
		let err = new Error(url);
		err.name = `Error ${response.status}`;
		throw err;
	}

	let loaded = 0;
	let total = parseInt(response.headers.get('Content-Length'), 10);

	let reader = response.body.getReader();
	let chunks = [];

	while (true){
		let {done, value} = await reader.read();
		if (done){
			break;
		}
		chunks.push(value);
		loaded += value.length;

		callback(loaded, total);
	}

	return new Blob(chunks);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function downloadBlob(blob, filename, meta){
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

async function handleAllDownloads(downloads, progress){
	progress.start('Starting download');

	let bytes = 0;
	let total = downloads.length;
	let results = [];

	for (let i = 0; i < total; i += 1){
		let blob;
		if (downloads[i].blob){
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

function logDownloadResponse(message){
	if (message.response === 'Success'){
		asLog('%cDownloading:', 'color: #006efe', message.filename);
	}
	else if (message.response === 'Failure'){
		asLog('%cFailed to download:', 'color: #d70022', message.filename);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function updateSavedInfo(site, user, id){
	let message = await browser.runtime.sendMessage({function: 'updatesavedinfo', site, user, id});
	if (message.response === 'Success'){
		globalsavedinfo = message.list;
	}
	else if (message.response === 'Failure'){
		asLog('%cFailed to update list:', 'color: #d70022', message.error);
	}
}

//---------------------------------------------------------------------------------------------------------------------
// message listener functions
//---------------------------------------------------------------------------------------------------------------------

browser.runtime.onMessage.addListener(message => {
	switch (message.command){
		case 'downloadall':
			downloadAll();
			break;

		case 'recheck':
			reCheck();
			setTimeout(() => sendStats(), 300);
			break;

		case 'sitestats':
			sendStats();
	}
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadAll(){
	globalbuttons.cleanButtons();
	for (let b of globalbuttons.idsMap.values()){
		if (b.type === 'download' && b.status === 'idle'){
			b.buttons[0].button.click();
		}
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function sendStats(){
	globalbuttons.cleanButtons();
	let downloads = 0;
	let saved = 0
	for (let b of globalbuttons.idsMap.values()){
		if (b.type === 'download' && b.status === 'idle'){
			downloads += 1;
		}
		if (b.type === 'check' && b.status === 'idle'){
			saved += 1;
		}
	}
	let page;
	try {
		page = pageInfo();
	}
	catch (err){
		browser.runtime.sendMessage({
			function: 'pageerror'
		});
		return;
	}

	let isuser = page.user ? true : false;
	browser.runtime.sendMessage({
		function: 'sitestats',
		total: {saved, downloads},
		//links: page.links,
		site: page.site,
		user: isuser
	});

	if (isuser){
		userInfo(page);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function userInfo(page){
	let user = {
		site: page.site,
		name: page.user
	};

	let key = savedKey(page.site);
	let item = await browser.storage.local.get(key);
	let savedlist = item[key] || {};
	user = await as[user.site].userInfo(user, page, savedlist);

	browser.runtime.sendMessage({function: 'userstats', site: page.site, user});
}

//---------------------------------------------------------------------------------------------------------------------
// queue functions
//---------------------------------------------------------------------------------------------------------------------

async function timer(s){
	return await new Promise((resolve, reject) => {
		setTimeout(resolve, s * 1000); //seconds
	});
}

function createPageQueue(usequeue, options){
	let concurrent = usequeue ? options.concurrent || 1 : Infinity;
	let waittime = usequeue ? options.waittime || 0 : 0;
	let infobar = options.infobar;

	let queue = {
		list: [],
		downloading: 0,
		inprogress: 0,
		threads: 0
	};

	queue.addDownload = function(site, subid){
		globalbuttons.setValue(subid, 'status', 'inprogress');
		this.list.push([site, subid]);
		this.downloading += 1;
		this.updateDownloadInfo();

		if (this.threads < concurrent){
			this.addThread();
		}
	}

	queue.addThread = async function(){
		this.threads += 1;
		while (this.list.length > 0){
			await this.downloadNext();
			if (waittime > 0){
				await timer(waittime);
			}
		}
		this.threads -= 1;

		if (this.threads <= 0){
			this.downloading = 0;
		}

		this.updateDownloadInfo();
	}

	queue.downloadNext = async function(){
		this.inprogress += 1;
		let [site, subid] = this.list.shift();
		this.updateDownloadInfo();
		try {
			let result = await as[site].download.startDownloading(subid, createProgress(subid));

			if (infobar){
				if (result.status === 'Success'){
					infobar.addSaved(result);
				}
				else {
					infobar.addError(result);
				}
			}
		}
		catch (err){
			asLog('Uncaught download error', err);
		}
		this.inprogress -= 1;
		this.updateDownloadInfo();
		return;
	}

	queue.updateDownloadInfo = function(){
		this.list.map(l => l[1]).forEach((subid, i) => {
			globalbuttons.setValue(subid, 'text', `In queue pos: ${i + 1}`);
		});

		if (infobar){
			infobar.setProgress(this.downloading, this.inprogress, this.list.length);
		}
	}

	return queue
}

//---------------------------------------------------------------------------------------------------------------------
// Page Info Bar
//---------------------------------------------------------------------------------------------------------------------

async function createPageInfoBar(){
	$remove($('#artsaver-info-bar'));
	$remove($('#artsaver-show-info-bar'));

	let infobarui = await fetcher(browser.runtime.getURL('/content_ui/infobar.html'), 'document');
	document.body.append(...infobarui.body.childNodes);

	let infobar = {
		element: $('#artsaver-info-bar'),
		tab: $('#artsaver-show-info-bar'),
		saved: [],
		errors: [],
		state: 'initial'
	};

	infobar.show = function(){
		this.element.classList.remove('collapsed');
		this.tab.classList.add('hide');
	}

	infobar.hide = function(){
		this.element.addEventListener('transitionend', () => {
			this.tab.classList.remove('hide');
		}, {once: true});
		this.element.classList.add('collapsed');
	}

	$(infobar.tab, '#show-tab').onclick = () => {
		infobar.show();
		infobar.state = 'show';
	}
	$(infobar.element, '#collapse').onclick = () => {
		infobar.hide();
		if (parseInt($(infobar.element, '#stat-downloading').textContent, 10) > 0){
			infobar.state = 'staydown';
		}
	}
	$(infobar.element, '#list-files input').oninput = function(){
		classToggle(this.checked, $(infobar.element, '#list-files'), 'show-folders');
	}

	infobar.addSaved = function(saved){
		this.saved.push(saved);

		let recentrow = $(this.element, '#recent-row-template').content.cloneNode(true);

		rspans = $$(recentrow, 'span');
		rspans[0].textContent = saved.submission.user;
		rspans[1].textContent = saved.submission.id;
		if (saved.files.length > 1){
			rspans[2].classList.remove('hide');
			rspans[2].textContent = `(${saved.files.length})`;
		}
		rspans[3].textContent = saved.submission.title;

		$(recentrow, 'a').href = saved.submission.url;

		$(this.element, '#list-recent .list').appendChild(recentrow);

		for (let f of saved.files){
			let filerow = $(this.element, '#file-row-template').content.cloneNode(true);

			let reg = /^(.*\/)?(.+)$/.exec(f.filename);
			let fspans = $$(filerow, 'span');
			fspans[0].textContent = reg[1];
			fspans[1].textContent = reg[2];

			$(filerow, 'button').onclick = () => {
				browser.runtime.sendMessage({function: 'showdownload', id: f.id});
			}

			$(this.element, '#list-files .list').appendChild(filerow);
		}

		this.updateHistoryInfo();
	}

	infobar.addError = function(error){
		this.errors.push(error);
		let errorrow = $(this.element, '#error-row-template').content.cloneNode(true);

		let espans = $$(errorrow, 'span');
		espans[0].textContent = error.url;
		espans[1].textContent = error.error;
		$(errorrow, 'a').href = error.url;

		$(this.element, '#list-errors .list').appendChild(errorrow);

		this.updateHistoryInfo();
	}

	infobar.updateHistoryInfo = function(){
		let total = {
			recent: this.saved.length,
			files: this.saved.reduce((acc, s) => acc += s.files.length, 0),
			errors: this.errors.length
		};

		for (let [name, stat] of Object.entries(total)){
			let statrow = $(this.element, `#stat-${name}`);
			$(statrow, '.badge').textContent = stat;
			let statlist = $(this.element, `#list-${name}`);

			classToggle(stat > 0, statrow, 'stat-button');
			if (stat > 0) {
				statrow.onclick = function(){
					classToggle(!statlist.classList.toggle('hide'), this, 'active');
				};
			}
			else {
				statlist.classList.add('hide');
			}
		}

		classToggle(total.errors <= 0, $(this.element, '#stat-errors'), 'hide');
	}

	infobar.setProgress = function(downloading = 0, inprogress = 0, inqueue = 0){
		classToggle(downloading <= 0, $(this.element, '#queue'), 'hide');
		if (downloading > 0){
			if (this.state !== 'staydown'){
				this.show();
			}
			let percent = (downloading - (inqueue + inprogress)) / downloading * 100;
			$(this.element, '.artsaver-bar').style.width = `${percent}%`;
			$(this.element, '.artsaver-bar-text').textContent = `${Math.floor(percent)}%`;
		}

		$(this.element, '#stat-downloading').textContent = downloading;
		$(this.element, '#stat-progress').textContent = inprogress;
		let queue = $(this.element, '#stat-queue');
		queue.textContent = inqueue;

		classToggle(inqueue <= 0, queue.parentElement, 'hide');
	}

	infobar.updateHistoryInfo();
	infobar.setProgress();
	return infobar;
}
