class ToolTip {
	constructor() {
		$remove($('#artsaver-tip'));

		this.tooltip = $insert($('#artsaver-ui'), 'div', { id: 'artsaver-tip' });

		const table = $insert(this.tooltip, 'table');
		const tr1 = $insert(table, 'tr');
		$insert(tr1, 'td', { text: 'User:' });
		$insert(tr1, 'td');
		const tr2 = $insert(table, 'tr');
		$insert(tr2, 'td', { text: 'Id:' });
		$insert(tr2, 'td');
	}
	show() {
		this.tooltip.setAttribute('data-display', 'show');
	}
	fade() {
		this.tooltip.removeAttribute('data-display');
	}
	set(user, id) {
		const fields = $$(this.tooltip, 'td:last-child');
		fields[0].textContent = user;
		fields[1].textContent = id;
	}
	move(x, user, id) {
		const rect = x.getBoundingClientRect();
		this.set(user, id);
		this.tooltip.style.top = `${rect.top + window.scrollY - this.tooltip.offsetHeight - 1}px`;
		//don't let the tooltip cross the document width
		this.tooltip.style.left = `${Math.min(rect.left + window.scrollX, document.body.offsetWidth - this.tooltip.offsetWidth)}px`;
		this.show();
	}
}

class ButtonsState {
	constructor() {
		this.idsMap = new Map();
		this.runningloop = false;
	}
	createState(type, site, subid) {
		let base = {
			type,
			status: 'idle',
			site,
			subid,
			buttons: []
		};

		if (type === 'check') {
			this.idsMap.set(subid, base);
		}
		else if (type === 'download') {
			this.idsMap.set(subid, {
				text: '',
				width: 0,
				...base
			});
		}
	}
	addButton(button) {
		if (!this.idsMap.has(button.submission_id)) {
			this.createState(button.type, button.site, button.submission_id);
		}
		this.idsMap.get(button.submission_id).buttons.push(button);
		this.setValue(button.submission_id, 'type', button.type);
	}
	setValue(subid, key, value) {
		this.idsMap.get(subid)[key] = value;
		this.runUpdateLoop();
	}
	removeState(subid) {
		this.idsMap.delete(subid);
	}
	runUpdateLoop() {
		if (this.runningloop) {
			return;
		}
		this.runningloop = true;
		window.requestAnimationFrame(() => { this.updateButtons() });
	}
	cleanButtons() {
		//clean diconnected nodes
		for (let [subid, info] of this.idsMap) {
			for (let b of info.buttons) {
				if (!b.button.isConnected) {
					b.clearListeners();
				}
			}
			info.buttons = info.buttons.filter(b => b.button.isConnected);
			if (info.status === 'idle' && info.buttons.length <= 0) {
				this.removeState(subid);
			}
		}
	}
	updateButtons() {
		this.cleanButtons();
		let recheck = false;
		for (let [subid, info] of this.idsMap) {
			let status = info.status;
			switch (info.type) {
				case 'check':
					this.updateCheck(subid, info);
					if (status === 'finished') {
						recheck = true;
					}
					break;

				case 'download':
					this.updateDownload(subid, info);
					if (status === 'finished') {
						recheck = true;
					}
					break;

				case 'error':
					this.updateError(subid, info);
					if (status === 'remove') {
						recheck = true;
					}
			}
		}

		if (recheck) {
			reCheck();
		}
		this.runningloop = false;
	}
	updateCheck(subid, info) {
		for (let b of info.buttons) {
			b.setStatus(info.status)
		}
		if (info.status === 'finished') {
			this.removeState(subid);
		}
	}
	updateDownload(subid, info) {
		for (let b of info.buttons) {
			b.setStatus(info.status)
			if (info.status === 'downloading') {
				b.setProgress(info.width, info.text);
			}
		}
		if (info.status === 'finished') {
			this.removeState(subid);
		}
	}
	updateError(subid, info) {
		info.buttons.forEach((b, i) => {
			if (b.type !== 'error') {
				b.clear();
				info.buttons[i] = new ButtonError(b.submission_id, b.anchor);
			}
			info.buttons[i].setStatus(info.status);
		});

		if (info.status === 'remove') {
			this.removeState(subid);
		}
	}
}

//---------------------------------------------------------------------------------------------------------------------
// Download queue
//---------------------------------------------------------------------------------------------------------------------

class Progress {
	constructor(submission_id, buttons) {
		this.submission_id = submission_id;
		this.buttons = buttons;
	}
	say(text) {
		this.buttons.setValue(this.submission_id, 'text', text);
	}
	width(width) {
		this.buttons.setValue(this.submission_id, 'width', width);
	}
	start(text) {
		this.width(0);
		this.say(text);
	}
	onOf(message, index, total) {
		let multiple = (total > 1) ? ` ${index}/${total}` : '';
		this.say(`${message}${multiple}`);
	}
	blobProgress(index, total, bytes, loaded, blobtotal) {
		let block = (1 / total) * 100;
		let initalwidth = (index / total) * 100;
		let onof = (total > 1) ? `${index + 1}/${total} ` : '';
		let size = fileSize(bytes + loaded);
		if (!blobtotal) {
			this.width(initalwidth + block);
			this.say(`... ${onof}${size}`);
		}
		else {
			let percent = initalwidth + (block * (loaded / blobtotal));
			this.width(percent);
			this.say(`${onof}${size} ${Math.floor(percent)}%`);
		}
	}
	finished() {
		this.buttons.setValue(this.submission_id, 'status', 'finished');
	}
	error() {
		this.buttons.setValue(this.submission_id, 'type', 'error');
	}
}

class DownloadQueue {
	constructor(concurrent, waittime, buttons, infobar = undefined) {
		this.concurrent = concurrent;
		this.waittime = waittime;
		this.buttons = buttons;
		this.infobar = infobar;

		this.list = [];
		this.downloading = 0;
		this.inprogress = 0;
		this.threads = 0;
	}
	addDownload(site, subid) {
		this.buttons.setValue(subid, 'status', 'downloading');
		this.list.push([site, subid]);
		this.downloading += 1;
		this.updateDownloadInfo();

		if (this.threads < this.concurrent) {
			this.addThread();
		}
	}
	async addThread() {
		this.threads += 1;
		while (this.list.length > 0) {
			await this.downloadNext();
			if (this.waittime > 0) {
				await timer(this.waittime);
			}
		}
		this.threads -= 1;

		if (this.threads <= 0) {
			this.downloading = 0;
		}

		this.updateDownloadInfo();
	}
	async downloadNext() {
		this.inprogress += 1;
		let [site, subid] = this.list.shift();
		this.updateDownloadInfo();
		try {
			let result = await as[site].download.startDownloading(subid, new Progress(subid, this.buttons));

			if (this.infobar) {
				if (result.status === 'Success') {
					this.infobar.addSaved(result);
				}
				else {
					this.infobar.addError(result);
				}
			}
		}
		catch (err) {
			asLog('Uncaught download error', err);
		}
		this.inprogress -= 1;
		this.updateDownloadInfo();
	}
	updateDownloadInfo() {
		this.list.map(l => l[1]).forEach((subid, i) => {
			this.buttons.setValue(subid, 'text', `In queue pos: ${i + 1}`);
		});

		if (this.infobar) {
			this.infobar.setProgress(this.downloading, this.inprogress, this.list.length);
		}
	}
}

//---------------------------------------------------------------------------------------------------------------------
// Page Info Bar
//---------------------------------------------------------------------------------------------------------------------

class InfoBar {
	constructor(ui_nodes) {
		$remove($('#artsaver-info-bar'));
		$remove($('#artsaver-show-info-bar'));
		$('#artsaver-ui').append(...ui_nodes);

		this.main = $('#artsaver-info-bar');
		this.tab = $('#artsaver-show-info-bar');
		this.saved = [];
		this.errors = [];
		this.state = 'initial';
		this.elements = {}
		for (let top_element of [this.main, this.tab]) {
			for (let element of $$(top_element, '[id]')) {
				let name = element.id.replace(/-/g, '_');
				this.elements[name] = element;
			}
		}

		this.elements.show_tab.onclick = () => {
			this.show();
			this.state = 'show';
		}
		this.elements.collapse.onclick = () => {
			this.hide();
			if (parseInt(this.elements.stat_downloading.textContent, 10) > 0) {
				this.state = 'staydown';
			}
		}
		this.elements.folder_switch.oninput = () => {
			classToggle(this.elements.folder_switch.checked, this.elements.list_files, 'show-folders');
		}

		this.updateHistoryInfo();
		this.setProgress();
	}
	show() {
		this.main.classList.remove('collapsed');
		this.tab.classList.add('hide');
	}
	hide() {
		this.main.addEventListener('transitionend', () => {
			this.tab.classList.remove('hide');
		}, { once: true });
		this.main.classList.add('collapsed');
	}
	addSaved(saved) {
		this.saved.push(saved);

		let recentrow = this.elements.recent_row_template.content.cloneNode(true);

		let rspan = $(recentrow, 'span');
		let pages = (saved.files.length > 1) ? ` (${saved.files.length})` : '';
		rspan.textContent = `${saved.submission.user} ${saved.submission.id}${pages} ${saved.submission.title}`;

		$(recentrow, 'a').href = saved.submission.url;

		this.elements.list_recent.firstElementChild.appendChild(recentrow);

		for (let f of saved.files) {
			let filerow = this.elements.file_row_template.content.cloneNode(true);

			let reg = /^(.*\/)?(.+)$/.exec(f.filename);
			let fspans = $$(filerow, 'span');
			fspans[0].textContent = reg[1];
			fspans[1].textContent = reg[2];

			$(filerow, 'button').onclick = () => {
				browser.runtime.sendMessage({ function: 'showdownload', id: f.id });
			}

			this.elements.list_files.firstElementChild.appendChild(filerow);
		}

		this.updateHistoryInfo();
	}
	addError(error) {
		this.errors.push(error);
		let errorrow = this.elements.error_row_template.content.cloneNode(true);

		let espans = $$(errorrow, 'span');
		espans[0].textContent = error.url;
		espans[1].textContent = error.error;
		$(errorrow, 'a').href = error.url;

		this.elements.list_errors.firstElementChild.appendChild(errorrow);

		this.updateHistoryInfo();
	}
	updateHistoryInfo() {
		let total = {
			recent: this.saved.length,
			files: this.saved.reduce((acc, s) => acc += s.files.length, 0),
			errors: this.errors.length
		};

		for (let [name, stat] of Object.entries(total)) {
			let statrow = this.elements[`stat_${name}`];
			$(statrow, '.badge').textContent = stat;
			let statlist = this.elements[`list_${name}`];

			classToggle(stat > 0, statrow, 'stat-button');
			if (stat > 0) {
				statrow.onclick = function () {
					classToggle(!statlist.classList.toggle('hide'), this, 'active');
				};
			}
			else {
				statlist.classList.add('hide');
			}
		}

		classToggle(total.errors <= 0, this.elements.stat_errors, 'hide');
	}
	setProgress(downloading = 0, inprogress = 0, inqueue = 0) {
		classToggle(downloading <= 0, this.elements.queue, 'hide');
		if (downloading > 0) {
			if (this.state !== 'staydown') {
				this.show();
			}
			let percent = (downloading - (inqueue + inprogress)) / downloading * 100;
			this.elements.progress_bar.style.width = `${percent}%`;
			this.elements.progress_bar_text.textContent = `${Math.floor(percent)}%`;
		}

		this.elements.stat_downloading.textContent = downloading;
		this.elements.stat_progress.textContent = inprogress;
		this.elements.stat_queue.textContent = inqueue;

		classToggle(inqueue <= 0, this.elements.stat_queue.parentElement, 'hide');
	}
}

if (!$('#artsaver-ui')) {
	$insert(document.body, 'div', { id: 'artsaver-ui' });
}

var globaltooltip = new ToolTip();
var globalbuttons = new ButtonsState();
var globalrunningobservers = [];
var globalsavedinfo;
var globaloptions;
var globalqueue;

const optionsKey = (s) => `${s}_options`;
const savedKey = (s) => `${s}_saved`;

main();

async function main() {
	globaloptions = await getOptions('global');
	document.body.style.setProperty('--as-icon-size', `${globaloptions.iconSize}px`);
	$('#artsaver-ui').classList.add(`artsaver-theme-${globaloptions.theme}`);

	let concurrent = globaloptions.useQueue ? globaloptions.queueConcurrent : Infinity;
	let waittime = globaloptions.useQueue ? globaloptions.waittime : 0;
	let infobar;
	if (globaloptions.infoBar) {
		let infobar_ui = await fetcher(browser.runtime.getURL('/content_ui/infobar.html'), 'document');
		infobar = new InfoBar(infobar_ui.body.childNodes);
	}

	globalqueue = new DownloadQueue(concurrent, waittime, globalbuttons, infobar);

	let page = await getPage();

	await setSavedInfo(page.site);

	as[page.site].check.startChecking();
	//$insert(document.body, 'button', {id: 'artsaver-test-button', text: 'test button'}).onclick = () => testing();
}

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
	globalsavedinfo = item[key] || {};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getPage() {
	while (true) {
		try {
			return pageInfo();
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

	as[page.site].check.startChecking();
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
// button classes
//---------------------------------------------------------------------------------------------------------------------

class ButtonCheck {
	constructor(site, user_id, submission_id, color, anchor, screen) {
		this.site = site;
		this.user_id = user_id;
		this.submission_id = submission_id;
		this.color = color;
		this.anchor = anchor;
		this.status = 'idle';
		this.type = 'check';

		this.button = $insert(this.anchor, 'div', { class: 'artsaver-check', 'data-color': this.color });
		this.button.onmouseover = () => {
			globaltooltip.move(this.button, this.user_id, this.submission_id);
		};
		this.button.onmouseout = () => {
			globaltooltip.fade();
		}
		this.click_reference = (e) => this.clickEvent(e);
		this.button.addEventListener('click', this.click_reference, { once: true });

		if (globaloptions.addScreen && screen) {
			this.screen = $insert(this.button, 'div', { position: 'beforebegin', class: 'artsaver-screen' });
			this.screen.style.opacity = `${globaloptions.screenOpacity}%`;
		}

		globalbuttons.addButton(this);
	}
	clickEvent(event) {
		event.preventDefault();
		event.stopPropagation();

		removeSubmission(this.site, this.submission_id);
		globaltooltip.fade();
	}
	setStatus(status) {
		if (this.status !== status) {
			this.status = status;
		}
		else {
			return;
		}
		if (this.status === 'removing') {
			this.button.className = 'artsaver-loading';
			this.clearListeners();
		}
		else if (this.status === 'finished') {
			this.clear();
		}
	}
	clearListeners() {
		this.button.removeEventListener('click', this.click_reference);
	}
	clear() {
		this.clearListeners();
		$remove(this.button);
		$remove(this.screen);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

class ButtonDownload {
	constructor(site, submission_id, anchor) {
		this.site = site;
		this.submission_id = submission_id;
		this.anchor = anchor;
		this.status = 'idle';
		this.type = 'download';

		this.button = $insert(this.anchor, 'div', { class: 'artsaver-download' });
		this.click_reference = (e) => this.clickEvent(e);
		this.button.addEventListener('click', this.click_reference, { once: true });

		this.keypress_reference = (e) => this.keypressEvent(e);
		document.addEventListener('keypress', this.keypress_reference);

		globalbuttons.addButton(this);
	}
	clickEvent(event) {
		event.preventDefault();
		event.stopPropagation();

		globalqueue.addDownload(this.site, this.submission_id);
	}
	keypressEvent(event) {
		if (this.anchor.matches(':hover') && event.key === 'd') {
			globalqueue.addDownload(this.site, this.submission_id);
		}
	}
	setStatus(status) {
		if (this.status !== status) {
			this.status = status;
		}
		else {
			return;
		}
		if (this.status === 'downloading') {
			this.button.className = 'artsaver-loading';
			this.bar = $insert(this.button, 'div', { position: 'beforebegin', class: 'artsaver-progress' });
			$insert($insert(this.bar, 'div', { class: 'artsaver-bar' }), 'div', { class: 'artsaver-bar-text' });

			this.clearListeners();
		}
		else if (this.status === 'finished') {
			this.clear();
		}
	}
	setProgress(width, text) {
		this.bar.firstElementChild.style.width = `${width}%`;
		this.bar.firstElementChild.firstElementChild.textContent = text;
	}
	clearListeners() {
		this.button.removeEventListener('click', this.click_reference);
		document.removeEventListener('keypress', this.keypress_reference);
	}
	clear() {
		this.clearListeners();
		$remove(this.button);
		$remove(this.bar);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class ButtonError {
	constructor(submission_id, anchor) {
		this.submission_id = submission_id;
		this.anchor = anchor;
		this.status = 'idle';
		this.type = 'error';

		this.button = $insert(this.anchor, 'div', { class: 'artsaver-error' });
		this.click_reference = (e) => this.clickEvent(e);
		this.button.addEventListener('click', this.click_reference);
	}
	clickEvent(event) {
		event.preventDefault();
		event.stopPropagation();
		globalbuttons.setValue(this.submission_id, 'status', 'remove');
	}
	setStatus(status) {
		if (this.status !== status) {
			this.status = status;
		}
		else {
			return;
		}
		if (this.status === 'remove') {
			this.clear();
		}
	}
	clearListeners() {
		this.button.removeEventListener('click', this.click_reference);
	}
	clear() {
		this.clearListeners();
		$remove(this.button);
	}
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

			button = new ButtonCheck(site, result.user, subid, result.color, anchor, screen).button;
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
		asLog('%cFailed to download:', 'color: #d70022', message.filename);
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
		page = pageInfo();
	}
	catch (err) {
		browser.runtime.sendMessage({
			function: 'pageerror'
		});
		return;
	}

	let isuser = page.user ? true : false;
	browser.runtime.sendMessage({
		function: 'sitestats',
		total: { saved, downloads },
		//links: page.links,
		site: page.site,
		user: isuser
	});

	if (isuser) {
		userInfo(page);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function userInfo(page) {
	let key = savedKey(page.site);
	let item = await browser.storage.local.get(key);

	let user = await as[page.site].userInfo(page.user);
	user.saved = item?.[key]?.[user.id] ?? [];

	browser.runtime.sendMessage({ function: 'userstats', site: page.site, user });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function timer(s) {
	return await new Promise((resolve, reject) => {
		setTimeout(resolve, s * 1000); //seconds
	});
}
