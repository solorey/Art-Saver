var globalrunningobservers = [];

const METAS = {
	site:              "The name of the website. 'pixiv', 'deviantart', etc.",
	userName:          'The user name of the artist.',
	title:             'Title of the submission.',
	submissionId:      'Id of the submission. Different according to each site.',
	submissionId36:    'submissionId in base 36 format.',
	fileName:          'Original site filename of the submission. Does not include extension.',
	ext:               "File extension. 'jpg', 'png', 'gif', etc.",
	stashUrlId:        'The digits and letters at the end of a the stash url.',
	stashUserName:     'The user name of the artist of the stash submission.',
	stashTitle:        'Title of the stash submission.',
	stashSubmissionId: 'Id of the stash submission.',
	stashFileName:     'The original file name of the stash submission. Does not include extension.',
	stashExt:          'File extension of the stash submission.',
	userId:            'The user Id of the artist.',
	page:              'The page number of the file in the submission set. Pages start at 1.',
	fileId:            'Id of the submission file.',
	userLower:         'The way the user name appears in the url bar.',
	YYYY:              'The year the submission was posted.',
	MM:                'Month, 01 - 12',
	DD:                'Day, 01 - 31',
	hh:                'Hours, 00 - 23',
	mm:                'Minutes, 00 - 59',
	ss:                'Seconds, 00 - 59',
	stashYYYY:         'The year the stash submission was posted.',
	stashMM:           'Month, 01 - 12',
	stashDD:           'Day, 01 - 31',
	stashhh:           'Hours, 00 - 23',
	stashmm:           'Minutes, 00 - 59',
	stashss:           'Seconds, 00 - 59',
	story:             'Story content from written submissions.',
	wordCount:         'Number of words from the story.',
	description:       'Description from the submission page.',
	url:               'Submission page url.',
	stashUrl:          'Stash page url.',
	stashDescription:  'Description from the stash page.'
};

initalSetup();

async function initalSetup() {
	let statekey = stateKey('settings');
	let settingsstate = await browser.storage.local.get(statekey);
	openTab(settingsstate[statekey].tab);
	setupOptions();
	await savedInfoDetails();
	classToggle($('#saved-info-edit-switch input').checked, $('#saved-table'), 'editable');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getJSON(file) {
	return new Promise((resolve, reject) => {
		let reader = new FileReader();
		reader.onload = loaded => {
			resolve(JSON.parse(loaded.target.result));
		};
		reader.readAsText(file);
	});
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function updateState(component, value) {
	browser.runtime.sendMessage({
		function: 'updatestate',
		ui: 'settings',
		component,
		value
	});
}

//---------------------------------------------------------------------------------------------------------------------
// tabs setup
//---------------------------------------------------------------------------------------------------------------------

function openTab(tab) {
	$$('#tabs > button').forEach(t => t.classList.remove('active'));
	$$('.tab-content').forEach(t => t.classList.add('hide'));

	$(`#tabs > button[data-tab=${tab}]`).classList.add('active');

	let content;
	switch (tab) {
		case 'global':
			content = 'global-options-content';
			break;
		case 'sites':
			content = 'site-options-content';
			break;
		case 'saved':
			content = 'saved-info-content';
			break;
		case 'about':
			content = 'about-content';
			break;
	}
	$(`#${content}`).classList.remove('hide');
	updateState('tab', tab);
}

for (let t of $$('#tabs > button')) {
	t.onclick = function () {
		openTab(this.getAttribute('data-tab'));
	};
}

//---------------------------------------------------------------------------------------------------------------------
// option setup
//---------------------------------------------------------------------------------------------------------------------

async function setupOptions() {
	let alloptions = await browser.storage.local.get(ALLOPTIONSKEYS);

	let globalinfo = {
		label: 'Global',
		helplink: 'https://github.com/solorey/Art-Saver/wiki/Options'
	}

	createOptions($('#global-options'), 'global', globalinfo, GLOBALOPTIONS, alloptions.global_options)
	for (let site of SITES) {
		createOptions($('#sites-list'), site, SITEINFO[site], SITEOPTIONS[site], alloptions[optionsKey(site)] || {});
		createSiteToggle($('#sites-toggles'), site, SITEINFO[site], $('#sites-list'));
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#sites-open-all').onclick = () => {
	$$('#sites-toggles .site-toggle').forEach(sb => sb.classList.add('active'));
	$$('#sites-toggles .site-radio').forEach(sr => sr.classList.remove('active'));
	$$('#sites-list .site-options').forEach(so => so.classList.remove('hide'));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#sites-close-all').onclick = () => {
	$$('#sites-toggles .site-toggle').forEach(sb => sb.classList.remove('active'));
	$$('#sites-toggles .site-radio').forEach(sr => sr.classList.remove('active'));
	$$('#sites-list .site-options').forEach(so => so.classList.add('hide'));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createOptions(parent, site, info, options, savedoptions) {
	let section = $('#options-section-template').content.cloneNode(true).firstElementChild;
	section.id = `${site}-options`;
	$(section, '.site-header').insertAdjacentText('afterbegin', info.label);
	$(section, '.question').href = info.helplink;

	parent.appendChild(section);

	for (let [name, values] of Object.entries(options)) {
		let newoption;
		let optionid = `${site}-${name}`;

		switch (values.type) {
			case 'select':
				newoption = createSelectOption(optionid, values, savedoptions[name]);
				break;
			case 'slider':
				newoption = createSliderOption(optionid, values, savedoptions[name]);
				break;
			case 'checkbox':
				newoption = createCheckboxOption(optionid, values, savedoptions[name]);
				break;
			case 'number':
				newoption = createNumberOption(optionid, values, savedoptions[name]);
				break;
			case 'textarea':
				newoption = createTextareaOption(optionid, values, savedoptions[name]);
				break;
		}

		if (!newoption) {
			continue;
		}

		let optionelem = newoption.firstElementChild;
		if (values.related) {
			for (let r of values.related) {
				let parentoption = $(`#${site}-${r.option}`);
				parentoption.addEventListener('change', () => {
					showRelated(site, values.related, optionelem);
				});
			}
			showRelated(site, values.related, optionelem);
		}

		section.appendChild(newoption);
	}
	$('#global-theme').oninput = () => {
		setTheme();
	};
	setTheme();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getValue(input) {
	if (input.type === 'checkbox') {
		return input.checked;
	}
	else if (input.type === 'number') {
		return input.valueAsNumber;
	}
	else {
		return input.value;
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setValue(input, value) {
	if (input.type === 'checkbox') {
		input.checked = value;
	}
	else {
		input.value = value;
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function showRelated(site, related, option) {
	for (let r of related) {
		if (getValue($(`#${site}-${r.option}`)) !== r.value) {
			option.classList.add('hide');
			return;
		}
	}
	option.classList.remove('hide');
}

//---------------------------------------------------------------------------------------------------------------------
// option type creation
//---------------------------------------------------------------------------------------------------------------------

function createSelectOption(optionid, values, savedvalue) {
	let option = $('#select-template').content.cloneNode(true);

	let labelelem = $(option, 'label');
	labelelem.textContent = values.label;
	labelelem.setAttribute('for', optionid);

	let selectelem = $(option, 'select');
	for (let opt of values.options) {
		$insert(selectelem, 'option', { value: opt.value, text: opt.label });
	}
	selectelem.id = optionid;
	selectelem.value = (typeof savedvalue !== 'undefined') ? savedvalue : values.default;

	return option;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createNumberOption(optionid, values, savedvalue) {
	let option = $('#number-template').content.cloneNode(true);

	let labelelem = $(option, 'label');
	labelelem.setAttribute('for', optionid);
	labelelem.insertAdjacentText('afterbegin', values.label);
	if (values.unit) {
		labelelem.insertAdjacentText('beforeend', values.unit);
	}

	let inputelem = $(option, 'input');
	inputelem.id = optionid;
	inputelem.setAttribute('min', values.min);
	inputelem.value = (typeof savedvalue !== 'undefined') ? savedvalue : values.default;

	$(option, '.increase').onmousedown = function () { numberChange(inputelem, this, 1) };
	$(option, '.decrease').onmousedown = function () { numberChange(inputelem, this, -1) };

	return option;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createSliderOption(optionid, values, savedvalue) {
	let option = $('#slider-template').content.cloneNode(true);

	let labelelem = $(option, 'label');
	labelelem.setAttribute('for', optionid);
	labelelem.insertAdjacentText('afterbegin', values.label);
	labelelem.insertAdjacentText('beforeend', values.unit);

	let number = $(option, 'input[type=number]');
	number.id = optionid;
	let range = $(option, 'input[type=range]');

	for (let inputelem of [number, range]) {
		inputelem.setAttribute('min', values.min);
		inputelem.setAttribute('max', values.max);
		inputelem.value = (typeof savedvalue !== 'undefined') ? savedvalue : values.default;
	}

	$(option, '.increase').onmousedown = function () { numberChange(number, this, 1, range) };
	$(option, '.decrease').onmousedown = function () { numberChange(number, this, -1, range) };

	number.oninput = function () {
		range.value = this.value;
		saveOptions();
	};
	range.oninput = function () {
		number.value = this.value;
		saveOptions();
	};

	return option;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function numberChange(num, elem, n, range) {
	let step = () => {
		num.stepUp(n);
		if (range) {
			range.value = num.value;
		}
	};
	step();

	let intid;
	let timeid = setTimeout(() => {
		intid = setInterval(step, 80);
	}, 400);

	elem.onmouseup = elem.onmouseout = () => {
		clearTimeout(timeid);
		clearInterval(intid);
		saveOptions();
	};
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createCheckboxOption(optionid, values, savedvalue) {
	let option = $('#checkbox-template').content.cloneNode(true);

	let labelelem = $(option, 'label');
	labelelem.setAttribute('for', optionid);
	labelelem.insertAdjacentText('beforeend', values.label);

	let inputelem = $(option, 'input');
	inputelem.id = optionid;
	inputelem.checked = (typeof savedvalue !== 'undefined') ? savedvalue : values.default;

	return option;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createTextareaOption(optionid, values, savedvalue) {
	let option = $('#textarea-template').content.cloneNode(true);

	let labelelem = $(option, 'label');
	labelelem.setAttribute('for', optionid);
	labelelem.textContent = values.label;

	let textareaelem = $(option, 'textarea');
	textareaelem.id = optionid;
	textareaelem.value = (typeof savedvalue !== 'undefined') ? savedvalue : values.default;

	textareaResize(textareaelem);
	let resize = new ResizeObserver(entries => {
		textareaResize(entries.pop().target);
	});
	resize.observe(textareaelem);
	textareaelem.oninput = function () {
		textareaResize(this);
	};

	let table = $(option, 'table');
	for (let tm of values.metas) {
		let metarow = $('#meta-row-template').content.cloneNode(true);
		$(metarow, 'strong').textContent = tm;
		$$(metarow, 'td')[1].textContent = METAS[tm];

		table.appendChild(metarow);
	}

	let helpbutton = $(option, 'button');
	helpbutton.onclick = function () {
		if (table.classList.toggle('hide')) {
			this.textContent = 'Show Help';
		}
		else {
			this.textContent = 'Hide Help';
		}
	};

	return option;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function textareaResize(textarea) {
	if (textarea.style.height) { //don't resize if height is given
		return;
	}
	let rows = 1;
	textarea.rows = rows;
	let maxrows = 8;
	while (textarea.clientHeight < textarea.scrollHeight && textarea.rows < maxrows) {
		rows += 1;
		textarea.rows = Math.min(rows, maxrows);
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createSiteToggle(parent, site, info, optionslist) {
	let showtoggle = $('#site-toggle-template').content.cloneNode(true);
	let toggle = $(showtoggle, '.site-toggle');
	let button = $(showtoggle, '.site-button');
	let radio = $(showtoggle, '.site-radio');
	button.textContent = info.label;
	button.onclick = function () {
		let isactive = toggle.classList.toggle('active');
		classToggle(!isactive, $(`#${site}-options`), 'hide');
		$$(parent, '.site-radio').forEach(t => t.classList.remove('active'));
	}
	radio.onclick = function () {
		$$(parent, '.site-toggle').forEach(t => t.classList.remove('active'));
		$$(parent, '.site-radio').forEach(t => t.classList.remove('active'));
		$$(optionslist, '.site-options').forEach(o => o.classList.add('hide'));

		this.classList.add('active');
		toggle.classList.add('active');
		$(`#${site}-options`).classList.remove('hide');
	}
	parent.appendChild(showtoggle);
}

$('form').onsubmit = s => s.preventDefault();
$('form').oninput = () => saveOptions();

//---------------------------------------------------------------------------------------------------------------------
// form getting and setting
//---------------------------------------------------------------------------------------------------------------------

function saveOptions() {
	let formoptions = getFormOptions();
	let optionstosave = {}
	for (let [key, values] of Object.entries(formoptions)) {
		optionstosave[optionsKey(key)] = values;
	}
	browser.storage.local.set(optionstosave);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getFormOptions() {
	let formoptions = {};

	for (let site of Object.keys(ALLOPTIONS)) {
		formoptions[site] = {};
		for (let key of Object.keys(ALLOPTIONS[site])) {
			formoptions[site][key] = getValue($(`#${site}-${key}`));
		}
	}

	return formoptions
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getDefalutOptions() {
	let defaultoptions = {};

	for (let site of Object.keys(ALLOPTIONS)) {
		defaultoptions[site] = {};
		for (let [key, values] of Object.entries(ALLOPTIONS[site])) {
			defaultoptions[site][key] = values.default;
		}
	}

	return defaultoptions;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setFormOptions(alloptions) {
	let related = [];
	for (let site of Object.keys(ALLOPTIONS)) {
		for (let [key, values] of Object.entries(ALLOPTIONS[site])) {
			let optionelem = $(`#${site}-${key}`);
			let optionblock = getOptionBlock(optionelem, values.type);

			if (values.related) {
				related.push([site, values.related, optionblock]);
			}

			if (!alloptions[site] || typeof alloptions[site][key] === 'undefined') {
				continue;
			}
			let value = alloptions[site][key];
			setValue(optionelem, value);

			if (values.type === 'slider') {
				$(optionblock, 'input[type=range]').value = value;
			}
			else if (values.type === 'textarea') {
				textareaResize(optionelem);
			}
		}
	}
	related.forEach(r => showRelated(...r));
	setTheme();
	saveOptions();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getOptionBlock(input, type) {
	let elem = input;
	while (true) {
		elem = elem.parentElement;
		if (elem.classList.contains(`option-${type}`)) {
			return elem;
		}
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#import-options').oninput = async function () {
	let jsonfile = await getJSON(this.files[0]);
	setFormOptions(jsonfile);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#click-import').onclick = () => {
	$('#import-options').click();
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#export-options').onclick = () => {
	let blob = new Blob([JSON.stringify(getFormOptions(), null, '\u0009')], { type: 'application/json' });

	browser.downloads.download({
		url: URL.createObjectURL(blob),
		filename: 'artsaver_settings.json',
		saveAs: true
	});
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#reset-options').onclick = () => {
	let undo = $('#options-undo');
	if (!undo.classList.contains('hide')) {
		return;
	}

	let oldoptions = getFormOptions();
	setFormOptions(getDefalutOptions());

	undo.classList.remove('hide');
	$(undo, '.undo-button').onclick = () => {
		setFormOptions(oldoptions);
		undo.classList.add('hide');
	}
}

//---------------------------------------------------------------------------------------------------------------------
// saved info table
//---------------------------------------------------------------------------------------------------------------------

async function savedInfoDetails() {
	let res = await browser.storage.local.get(SITESSAVEDKEYS);
	let list = {};
	for (let site of SITES) {
		if (res[savedKey(site)]) {
			list[site] = res[savedKey(site)];
		}
	}

	let savedtable = $('#saved-table');
	let tablestate = getSavedInfoTableState();

	$$(savedtable, 'tr:nth-child(n+2)').forEach(row => $remove(row));
	globalrunningobservers.forEach(ob => ob.disconnect());

	if (!list || Object.keys(list).length <= 0) {
		//savedtable.classList.add('hide');
		return;
	}

	let tbody = $(savedtable, 'tbody');

	for (let site of Object.keys(list)) {
		let row = $('#stats-row-template').content.cloneNode(true);
		let statrow = $(row, '.stat-row')
		let inforow = $(row, '.info-row')
		statrow.setAttribute('data-site', site);

		statrow.onclick = function () {
			classToggle(!inforow.classList.toggle('hide'), this, 'active');
		};

		if (tablestate[site] && tablestate[site].toggle) {
			statrow.classList.add('active');
			inforow.classList.remove('hide');
		}

		$(row, '.stat-site').textContent = SITEINFO[site].label;

		let id_type = SITEINFO[site].idType;

		let all_submissions = Object.values(list[site]).flat();
		if (id_type === 'bigint') {
			all_submissions = all_submissions.map(s => BigInt(s));
		}
		all_submissions = [...new Set(all_submissions)];
		
		switch (id_type) {
			case 'integer':
				all_submissions.sort((a, b) => b - a);
				break;
			
			case 'bigint':
				all_submissions.sort((a, b) => {
					if (a > b) {
						return -1;
					} else if (a < b) {
						return 1;
					} else {
						return 0;
					}
				});
				break;
			
			default:
				all_submissions.sort();
		}

		let stats = [
			[...new Set(Object.keys(list[site]))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })), //users
			all_submissions //submissions
		];

		let badges = $$(row, '.badge');
		let searchboxes = $$(row, '.search-box');
		let searchinputs = $$(row, '.search-box input');
		let listboxes = $$(row, '.list-box');

		let createrows = [
			(u) => createUserRow(site, u),
			(s) => createSubmissionRow(site, s)
		];

		let onresize = [
			() => { listboxes[1].style.height = listboxes[0].style.height },
			() => { listboxes[0].style.height = listboxes[1].style.height }
		];

		for (let i = 0; i < stats.length; i++) {
			badges[i].textContent = stats[i].length;

			if (tablestate[site]) {
				searchinputs[i].value = tablestate[site].searches[i];
			}

			let list = new VirtualList(listboxes[i], searchResult(searchboxes[i], stats[i]), createrows[i]);
			setupSearch(list, searchboxes[i], stats[i]);

			let resize = new ResizeObserver(onresize[i]);
			globalrunningobservers.push(resize);
			resize.observe(listboxes[i]);
		}

		if (tablestate[site]) {
			listboxes.forEach(b => b.style.height = tablestate[site].height);
		}
		else {
			(stats[0].length > stats[1].length) ? onresize[0]() : onresize[1]();
		}

		tbody.appendChild(row);

		if (tablestate[site]) {
			listboxes.forEach((b, i) => b.scrollTo(0, tablestate[site].scrolls[i]));
		}
	}

	savedtable.classList.remove('hide');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getSavedInfoTableState() {
	let savedtable = $('#saved-table');
	let tablestate = {};
	for (let site of SITES) {
		let statrow = $(savedtable, `tr[data-site=${site}]`);
		if (!statrow) {
			continue;
		}
		let inforow = statrow.nextElementSibling;
		tablestate[site] = {
			toggle: statrow.classList.contains('active'),
			searches: $$(inforow, '.search-box input').map(s => s.value),
			scrolls: $$(inforow, '.list-box').map(s => s.scrollTop),
			height: $(inforow, '.list-box').style.height
		}
	}
	return tablestate;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createUserRow(site, reguser) {
	let links = SITEINFO[site].links;

	let row = $('#user-row-template').content.cloneNode(true);
	let spans = $$(row, 'span');
	spans[0].textContent = reguser[1];
	spans[1].textContent = reguser[reguser.length - 1];
	$(row, 'strong').textContent = reguser[2];

	let alinks = $$(row, 'a');
	alinks[0].href = links.user(reguser[0]);
	alinks[1].href = links.gallery(reguser[0]);
	alinks[2].href = links.favorites(reguser[0]);

	$(row, '.row-delete').addEventListener('click', async function () {
		this.classList.add('deleting');
		await browser.runtime.sendMessage({
			function: 'removeuser',
			site: site,
			user: reguser[0]
		});
		savedInfoDetails();
	}, { once: true });
	return row.firstElementChild;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createSubmissionRow(site, regsubmission) {
	let links = SITEINFO[site].links;

	let row = $('#submission-row-template').content.cloneNode(true);
	let spans = $$(row, 'span')
	spans[0].textContent = regsubmission[1];
	spans[1].textContent = regsubmission[regsubmission.length - 1];
	$(row, 'strong').textContent = regsubmission[2];

	$(row, 'a').href = links.submission(regsubmission[0]);

	let submission_id = (SITEINFO[site].idType === 'integer') ? parseInt(regsubmission[0], 10) : regsubmission[0];

	$(row, '.row-delete').addEventListener('click', async function () {
		this.classList.add('deleting');
		await browser.runtime.sendMessage({
			function: 'removesubmission',
			site: site,
			sid: submission_id
		});
		savedInfoDetails();
	}, { once: true });

	return row.firstElementChild;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#table-refresh').onclick = () => savedInfoDetails();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#table-open-all').onclick = () => {
	$$('#saved-table .stat-row').forEach(sr => sr.classList.add('active'));
	$$('#saved-table .info-row').forEach(ir => ir.classList.remove('hide'));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#table-close-all').onclick = () => {
	$$('#saved-table .stat-row').forEach(sr => sr.classList.remove('active'));
	$$('#saved-table .info-row').forEach(ir => ir.classList.add('hide'));
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#export-list').onclick = async () => {
	let savedinfo = await browser.storage.local.get(SITESSAVEDKEYS);
	let informationtosave = {};
	for (let site of SITES) {
		if (savedinfo[savedKey(site)]) {
			informationtosave[site] = savedinfo[savedKey(site)];
		}
	}
	let blob = new Blob([JSON.stringify(informationtosave, null, '\u0009')], { type: 'application/json' });

	browser.downloads.download({
		url: URL.createObjectURL(blob),
		filename: 'artsaver_saved_info.json',
		saveAs: true
	});
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#reset-list').onclick = async () => {
	let undo = $('#saved-info-undo');
	$(undo, 'span').textContent = 'reset';

	await setUndoButton();
	await browser.storage.local.remove(SITESSAVEDKEYS);
	await savedInfoDetails();

	undo.classList.remove('hide');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#saved-info').oninput = async function () {
	$('#filename').textContent = this.files[0].name;

	let undo = $('#saved-info-undo');
	$(undo, 'span').textContent = 'overwritten';
	await setUndoButton();

	try {
		let jsonfile = await getJSON(this.files[0]);
		await browser.storage.local.set(cleanSavedInfo(jsonfile));
		await savedInfoDetails();
	}
	catch (err) { }

	undo.classList.remove('hide');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function cleanSavedInfo(savefile) {
	let informationtosave = {};

	for (let site of SITES) {
		if (![...Object.keys(savefile)].includes(site) || Object.keys(savefile[site]).length <= 0) {
			continue;
		}
		informationtosave[savedKey(site)] = {};

		for (let [user, savedsubmissions] of Object.entries(savefile[site])) {
			if (savedsubmissions.length > 0) {
				let submissions_list = (SITEINFO[site].idType === 'integer') ? savedsubmissions.map(n => parseInt(n, 10)) : savedsubmissions;
				informationtosave[savedKey(site)][user] = [...new Set(submissions_list)].sort((a, b) => b - a);
			}
		}
	}

	return informationtosave;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setUndoButton() {
	let old = await browser.storage.local.get(SITESSAVEDKEYS);

	$('#saved-info-undo .undo-button').onclick = async () => {
		await browser.storage.local.set(old);
		await savedInfoDetails();
		$('#saved-info-undo').classList.add('hide');
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

for (let ub of $$('.close-button')) {
	ub.onclick = function () {
		this.parentElement.classList.add('hide');
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$('#saved-info-edit-switch').oninput = function () {
	classToggle($(this, 'input').checked, $('#saved-table'), 'editable');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setTheme() {
	document.body.className = `artsaver-theme-${$('#global-theme').value}`
}

//---------------------------------------------------------------------------------------------------------------------
// about info
//---------------------------------------------------------------------------------------------------------------------

$('#version').textContent = browser.runtime.getManifest().version;