//---------------------------------------------------------------------------------------------------------------------
// tooltip
//---------------------------------------------------------------------------------------------------------------------

class ToolTip {
	async load() {
		$remove($('#artsaver-tip'));
		let infobar_ui = await fetcher(browser.runtime.getURL('/content_ui/tooltip.html'), 'document');
		$('#artsaver-ui').append(...infobar_ui.body.childNodes);
		this.tooltip = $('#artsaver-tip');
		this.user = $(this.tooltip, '.user-value');
		this.id = $(this.tooltip, '.id-value')
	}
	show() {
		this.tooltip.setAttribute('data-display', 'show');
	}
	fade() {
		this.tooltip.removeAttribute('data-display');
	}
	set(user, id) {
		this.user.textContent = user;
		this.id.textContent = id;
		const links = $$(this.tooltip, 'a');
		links[0].href = userHomeLink(user);
		links[1].href = userGalleryLink(user);
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

//---------------------------------------------------------------------------------------------------------------------
// buttons
//---------------------------------------------------------------------------------------------------------------------

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class ButtonCheck {
	constructor(site, user_id, submission_id, color, anchor, screen, tooltip) {
		this.site = site;
		this.user_id = user_id;
		this.submission_id = submission_id;
		this.color = color;
		this.anchor = anchor;
		this.status = 'idle';
		this.type = 'check';
		this.tooltip = tooltip;

		this.button = $insert(this.anchor, 'div', { class: 'artsaver-check', 'data-color': this.color });
		this.button.onmouseover = () => {
			this.tooltip.move(this.button, this.user_id, this.submission_id);
		};
		this.button.onmouseout = () => {
			this.tooltip.fade();
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
		this.tooltip.fade();
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

//---------------------------------------------------------------------------------------------------------------------
// downloading
//---------------------------------------------------------------------------------------------------------------------

class Progress {
	constructor(submission_id, buttons_state) {
		this.submission_id = submission_id;
		this.buttons_state = buttons_state;
	}
	say(text) {
		this.buttons_state.setValue(this.submission_id, 'text', text);
	}
	width(width) {
		this.buttons_state.setValue(this.submission_id, 'width', width);
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
		this.buttons_state.setValue(this.submission_id, 'status', 'finished');
	}
	error() {
		this.buttons_state.setValue(this.submission_id, 'type', 'error');
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DownloadQueue {
	constructor(concurrent, waittime, buttons_state, infobar = undefined) {
		this.concurrent = concurrent;
		this.waittime = waittime;
		this.buttons_state = buttons_state;
		this.infobar = infobar;

		this.list = [];
		this.downloading = 0;
		this.inprogress = 0;
		this.threads = 0;
	}
	addDownload(site, subid) {
		this.buttons_state.setValue(subid, 'status', 'downloading');
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
			let result = await startDownloading(subid, new Progress(subid, this.buttons_state));

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
			this.buttons_state.setValue(subid, 'text', `In queue pos: ${i + 1}`);
		});

		if (this.infobar) {
			this.infobar.setProgress(this.downloading, this.inprogress, this.list.length);
		}
	}
}

//---------------------------------------------------------------------------------------------------------------------
// infobar
//---------------------------------------------------------------------------------------------------------------------

class InfoBar {
	constructor() {
		this.saved = [];
		this.errors = [];
		this.state = 'initial';
	}
	async load() {
		$remove($('#artsaver-info-bar'));
		$remove($('#artsaver-show-info-bar'));

		let infobar_ui = await fetcher(browser.runtime.getURL('/content_ui/infobar.html'), 'document');
		$('#artsaver-ui').append(...infobar_ui.body.childNodes);

		this.main = $('#artsaver-info-bar');
		this.tab = $('#artsaver-show-info-bar');

		this.e = {}
		for (let top_element of [this.main, this.tab]) {
			for (let element of $$(top_element, '[id]')) {
				let name = element.id.replace(/-/g, '_');
				this.e[name] = element;
			}
		}

		this.e.show_tab.onclick = () => {
			this.show();
			this.state = 'show';
		}
		this.e.collapse.onclick = () => {
			this.hide();
			if (parseInt(this.e.stat_downloading.textContent, 10) > 0) {
				this.state = 'staydown';
			}
		}
		this.e.folder_switch.oninput = () => {
			classToggle(this.e.folder_switch.checked, this.e.list_files, 'show-folders');
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

		let recentrow = this.e.recent_row_template.content.cloneNode(true);

		let rspan = $(recentrow, 'span');
		let pages = (saved.files.length > 1) ? ` (${saved.files.length})` : '';
		rspan.textContent = `${saved.submission.user} ${saved.submission.id}${pages} ${saved.submission.title}`;

		$(recentrow, 'a').href = saved.submission.url;

		this.e.list_recent.firstElementChild.appendChild(recentrow);

		for (let f of saved.files) {
			let filerow = this.e.file_row_template.content.cloneNode(true);

			let reg = /^(.*\/)?(.+)$/.exec(f.filename);
			let fspans = $$(filerow, 'span');
			fspans[0].textContent = reg[1];
			fspans[1].textContent = reg[2];

			$(filerow, 'button').onclick = () => {
				browser.runtime.sendMessage({ function: 'showdownload', id: f.id });
			}

			this.e.list_files.firstElementChild.appendChild(filerow);
		}

		this.updateHistoryInfo();
	}
	addError(error) {
		this.errors.push(error);
		let errorrow = this.e.error_row_template.content.cloneNode(true);

		let espans = $$(errorrow, 'span');
		espans[0].textContent = error.error;
		espans[1].textContent = error.url;
		$(errorrow, 'a').href = error.url;

		this.e.list_errors.firstElementChild.appendChild(errorrow);

		this.updateHistoryInfo();
	}
	updateHistoryInfo() {
		let total = {
			recent: this.saved.length,
			files: this.saved.reduce((acc, s) => acc += s.files.length, 0),
			errors: this.errors.length
		};

		for (let [name, stat] of Object.entries(total)) {
			let statrow = this.e[`stat_${name}`];
			$(statrow, '.badge').textContent = stat;
			let statlist = this.e[`list_${name}`];

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

		classToggle(total.errors <= 0, this.e.stat_errors, 'hide');
	}
	setProgress(downloading = 0, inprogress = 0, inqueue = 0) {
		classToggle(downloading <= 0, this.e.queue, 'hide');
		if (downloading > 0) {
			if (this.state !== 'staydown') {
				this.show();
			}
			let percent = (downloading - (inqueue + inprogress)) / downloading * 100;
			this.e.progress_bar.style.width = `${percent}%`;
			this.e.progress_bar_text.textContent = `${Math.floor(percent)}%`;
		}

		this.e.stat_downloading.textContent = downloading;
		this.e.stat_progress.textContent = inprogress;
		this.e.stat_queue.textContent = inqueue;

		classToggle(inqueue <= 0, this.e.stat_queue.parentElement, 'hide');
	}
	test() {
		for (let i = 0; i < 3; i += 1) {
			this.addSaved({
				status: 'Success',
				submission: {
					url: 'https://art.site/s/12345',
					user: 'user',
					id: '12345',
					title: 'title'
				},
				files: [
					{ response: 'Success', url: 'https://art.img/i/12345_1.ext', filename: 'folder/12345_title_1_by_user.ext', id: 1 },
					{ response: 'Success', url: 'https://art.img/i/12345_2.ext', filename: 'folder/12345_title_2_by_user.ext', id: 2 }
				]
			});
		}
		for (let i = 0; i < 3; i += 1) {
			this.addError({
				status: 'Failure',
				error: new Error('Files failed to download.'),
				url: 'https://art.site/s/12345'
			});
		}
		for (let name of ['recent', 'files', 'errors']) {
			this.e[`stat_${name}`].classList.add('active');
			this.e[`list_${name}`].classList.remove('hide');
		}
		this.setProgress(10, 2, 3);
		this.show();
	}
}