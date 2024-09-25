"use strict";
var G_delete_queue = new Set();
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class UndoBar {
    bar;
    label;
    timer;
    duration = 20_000; // 20 seconds
    handle;
    start;
    old_options;
    old_saved;
    type;
    constructor() {
        this.bar = document.querySelector('#undo-bar');
        this.label = document.querySelector('#undo-label');
        this.timer = document.querySelector('#undo-timer');
        document.querySelector('#undo-button')?.addEventListener('click', () => {
            this.undo();
        });
        document.querySelector('#undo-close')?.addEventListener('click', () => {
            this.hide();
        });
    }
    runCountdownLoop() {
        if (this.handle) {
            window.cancelAnimationFrame(this.handle);
        }
        this.start = undefined;
        this.handle = window.requestAnimationFrame(this.countdown);
    }
    countdown = (time_stamp) => {
        this.start ??= time_stamp;
        const elapsed = Math.min(time_stamp - this.start, this.duration);
        this.timer?.style.setProperty('width', `${(1 - elapsed / this.duration) * 100}%`);
        if (elapsed < this.duration) {
            this.handle = window.requestAnimationFrame(this.countdown);
        }
        else {
            this.hide();
        }
    };
    show() {
        this.bar?.classList.remove('hide');
        this.runCountdownLoop();
    }
    hide() {
        this.bar?.classList.add('hide');
        if (this.handle) {
            window.cancelAnimationFrame(this.handle);
        }
    }
    primeUndoOptions(label) {
        this.type = 'options';
        this.label?.replaceChildren(label);
        this.old_options = G_options_form.getFormValues();
    }
    async primeUndoSaved(label) {
        this.type = 'saved';
        this.label?.replaceChildren(label);
        this.old_saved = await getSavedStorage(SITES);
    }
    undo() {
        if (this.type === 'options' && this.old_options) {
            G_options_form.setFormValues(this.old_options);
        }
        else if (this.type === 'saved' && this.old_saved) {
            setSavedStorage(this.old_saved);
            const sites = keysSet(this.old_saved);
            const blank_sites = SITES.filter((site) => !sites.has(site));
            removeSavedStorage(blank_sites);
        }
        this.hide();
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const METAS = {
    site: "Name of the website. 'deviantart', 'pixiv', etc.",
    userName: 'User name of the artist.',
    userId: 'ID of the artist. Usually as shown in the URL of the user page.',
    title: 'Title of the submission.',
    submissionId: 'ID of the submission. Usually as shown in the URL of the submission page.',
    fileName: 'Original site filename of the submission. Does not include extension.',
    fileId: 'ID of the submission file.',
    ext: "File extension. 'jpg', 'png', 'gif', etc.",
    page: 'Page number of the file in the submission set. Pages start at 1.',
    YYYY: 'Year the submission was posted.',
    MM: 'Month. 01 - 12',
    DD: 'Day. 01 - 31',
    hh: 'Hours. 00 - 23',
    mm: 'Minutes. 00 - 59',
    ss: 'Seconds. 00 - 59',
    story: 'Story content from written submissions.',
    wordCount: 'Number of words from the story.',
    description: 'Description from the submission page.',
    url: 'Source URL.',
    urlId: 'ID in the URL. Available when the submission ID is not the source ID.',
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionSelect {
    id;
    block;
    value_element;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#select-template');
        const label = template.querySelector('label');
        label?.append(values.label);
        label?.setAttribute('for', option_id);
        const select = selectOrError(template, 'select');
        for (const opt of values.options) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.append(option);
        }
        select.id = option_id;
        this.value_element = select;
        this.block = template.firstElementChild;
    }
    getValue() {
        return this.value_element.value;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionNumber {
    id;
    block;
    value_element;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#number-template');
        const label = template.querySelector('label');
        label?.setAttribute('for', option_id);
        label?.prepend(values.label);
        if (values.unit) {
            const unit = template.querySelector('[data-number-unit]');
            unit?.classList.remove('hide');
            unit?.replaceChildren(values.unit);
        }
        const input = selectOrError(template, 'input');
        input.id = option_id;
        input.setAttribute('min', `${values.min}`);
        template.querySelector('.step-increase')?.addEventListener('mousedown', function () {
            numberChange(input, this, 1, undefined);
        });
        template.querySelector('.step-decrease')?.addEventListener('mousedown', function () {
            numberChange(input, this, -1, undefined);
        });
        this.value_element = input;
        this.block = template.firstElementChild;
    }
    getValue() {
        return this.value_element.valueAsNumber;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionSlider {
    id;
    block;
    value_element;
    range_input;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#slider-template');
        const label = template.querySelector('label');
        label?.setAttribute('for', option_id);
        label?.prepend(values.label);
        if (values.unit) {
            const unit = template.querySelector('[data-number-unit]');
            unit?.classList.remove('hide');
            unit?.replaceChildren(values.unit);
        }
        const number_input = selectOrError(template, 'input[type=number]');
        number_input.id = option_id;
        const range_input = selectOrError(template, 'input[type=range]');
        for (const input of [number_input, range_input]) {
            input.setAttribute('min', `${values.min}`);
            input.setAttribute('max', `${values.max}`);
        }
        template.querySelector('.step-increase')?.addEventListener('mousedown', function () {
            numberChange(number_input, this, 1, range_input);
        });
        template.querySelector('.step-decrease')?.addEventListener('mousedown', function () {
            numberChange(number_input, this, -1, range_input);
        });
        number_input.addEventListener('input', function () {
            range_input.value = this.value;
        });
        range_input.addEventListener('input', function () {
            number_input.value = this.value;
            number_input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        this.value_element = number_input;
        this.range_input = range_input;
        this.block = template.firstElementChild;
    }
    getValue() {
        return this.value_element.valueAsNumber;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
        this.range_input.value = `${value}`;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function numberChange(input, button, value, range) {
    const step = () => {
        input.stepUp(value);
        if (range) {
            range.value = input.value;
        }
    };
    step();
    let interval_id = 0;
    const timeout_id = setTimeout(() => {
        interval_id = setInterval(step, 80);
    }, 400);
    const stop = () => {
        clearTimeout(timeout_id);
        clearInterval(interval_id);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    button.addEventListener('mouseup', stop);
    button.addEventListener('mouseout', stop);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionCheckbox {
    id;
    block;
    value_element;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#checkbox-template');
        const label = template.querySelector('label');
        label?.append(values.label);
        label?.setAttribute('for', option_id);
        const input = selectOrError(template, 'input');
        input.id = option_id;
        this.value_element = input;
        this.block = template.firstElementChild;
    }
    getValue() {
        return this.value_element.checked;
    }
    setValue(value) {
        this.value_element.checked = Boolean(value);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionTextarea {
    id;
    block;
    value_element;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#textarea-template');
        const label = template.querySelector('label');
        label?.append(values.label);
        label?.setAttribute('for', option_id);
        const textarea = selectOrError(template, 'textarea');
        textarea.id = option_id;
        textarea.addEventListener('input', function () {
            textareaResize(this);
        });
        textarea.addEventListener('focus', function () {
            textareaResize(this);
        });
        const table = template.querySelector('[data-meta-table]');
        for (const meta of values.metas) {
            const row_template = cloneTemplate('#meta-row-template');
            const expression = `{${meta}}`;
            row_template.querySelector('[data-copy-button]')?.addEventListener('click', () => {
                window.navigator.clipboard.writeText(expression);
            });
            row_template.querySelector('[data-meta-name]')?.append(expression);
            row_template.querySelector('[data-meta-description]')?.append(METAS[meta]);
            table?.appendChild(row_template);
        }
        this.value_element = textarea;
        this.block = template.firstElementChild;
    }
    getValue() {
        return this.value_element.value;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
        textareaResize(this.value_element);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function textareaResize(textarea) {
    // don't resize if height is given
    if (textarea.style.height) {
        return;
    }
    let rows = 1;
    textarea.rows = rows;
    const max_rows = 8;
    while (textarea.clientHeight < textarea.scrollHeight && textarea.rows < max_rows) {
        rows += 1;
        textarea.rows = Math.min(rows, max_rows);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionShortcut {
    id;
    block;
    value_element;
    constructor(option_id, values) {
        this.id = option_id;
        const template = cloneTemplate('#shortcut-template');
        const label = template.querySelector('label');
        label?.append(values.label);
        label?.setAttribute('for', option_id);
        const input = selectOrError(template, 'input');
        input.id = option_id;
        input.addEventListener('keyup', this.keyEvent);
        input.addEventListener('keydown', this.keyEvent);
        const button = template.querySelector('button');
        button?.addEventListener('click', function () {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        this.value_element = input;
        this.block = template.firstElementChild;
    }
    keyEvent = (event) => {
        if (onShortcutKeyboardEvent(event)) {
            this.value_element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    getValue() {
        return this.value_element.value;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function onShortcutKeyboardEvent(event) {
    const input = event.target;
    if (event.key == 'Escape') {
        input.blur();
        return;
    }
    if (event.key == 'Tab') {
        return;
    }
    event.preventDefault();
    if (!event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
        if (event.key == 'Delete' || event.key == 'Backspace') {
            input.value = '';
            return true;
        }
    }
    const shortcut = getShortcutFromEvent(event);
    input.value = shortcut;
    if (shortcut && shortcut.at(-1) !== '+') {
        input.blur();
        return true;
    }
    else if (!shortcut) {
        return true;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class OptionsForm {
    form;
    constructor() {
        const options_form = {};
        for (const site of SITES_AND_GLOBAL) {
            const site_options = {};
            const site_form = SITES_AND_GLOBAL_FORMS[site];
            for (const [key, option] of Object.entries(site_form)) {
                const option_id = `${site}-${key}`;
                let new_option;
                switch (option.type) {
                    case 'select':
                        new_option = new OptionSelect(option_id, option);
                        break;
                    case 'slider':
                        new_option = new OptionSlider(option_id, option);
                        break;
                    case 'checkbox':
                        new_option = new OptionCheckbox(option_id, option);
                        break;
                    case 'number':
                        new_option = new OptionNumber(option_id, option);
                        break;
                    case 'textarea':
                        new_option = new OptionTextarea(option_id, option);
                        break;
                    case 'shortcut':
                        new_option = new OptionShortcut(option_id, option);
                        break;
                }
                site_options[key] = new_option;
            }
            options_form[site] = site_options;
        }
        this.form = options_form;
        for (const site of SITES_AND_GLOBAL) {
            const site_form = SITES_AND_GLOBAL_FORMS[site];
            for (const key in site_form) {
                const option_class = options_form[site]?.[key];
                const related = site_form[key].related;
                if (!related || !option_class) {
                    continue;
                }
                for (const r of related) {
                    options_form[site]?.[r.option]?.value_element?.addEventListener('change', () => {
                        this.showRelated(site, related, option_class);
                    });
                }
                this.showRelated(site, related, option_class);
            }
        }
    }
    getFormValues() {
        const form_options = {};
        for (const site of SITES_AND_GLOBAL) {
            const values = {};
            for (const [key, option] of Object.entries(this.form[site])) {
                values[key] = option.getValue();
            }
            form_options[site] = values;
        }
        return form_options;
    }
    setFormValues(all_options, initialize_default = false) {
        const related = [];
        for (const site of SITES_AND_GLOBAL) {
            const site_form = SITES_AND_GLOBAL_FORMS[site];
            for (const [key, option] of Object.entries(site_form)) {
                let value = all_options[site]?.[key];
                if (initialize_default) {
                    value ??= option.default;
                }
                else if (typeof value === 'undefined') {
                    continue;
                }
                const option_class = this.form[site][key];
                if (option.related) {
                    related.push([site, option.related, option_class]);
                }
                option_class.setValue(value);
            }
        }
        related.forEach((r) => this.showRelated(...r));
        saveOptions();
    }
    setFormDefault() {
        this.setFormValues({}, true);
    }
    showRelated(site, related, option) {
        for (const r of related) {
            const related_value = this.form[site][r.option]?.getValue();
            if (related_value !== r.value) {
                option.block.classList.add('hide');
                return;
            }
        }
        option.block.classList.remove('hide');
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class TableDetails {
    site;
    row;
    saved_details;
    users_stat;
    submissions_stat;
    users_list;
    submissions_list;
    constructor(site) {
        this.site = site;
        const row = cloneTemplate('#stats-row-template');
        row.querySelector('[data-site-label]')?.append(SITES_INFO[site].label);
        this.saved_details = row.querySelector('[data-saved-details]');
        this.users_stat = row.querySelector('[data-total-users]');
        this.submissions_stat = row.querySelector('[data-total-submissions]');
        const users_info = row.querySelector('[data-users-info]');
        if (users_info) {
            this.users_list = new SearchList(users_info, (sf) => createOptionsUserRow(site, sf));
        }
        const submissions_info = row.querySelector('[data-submissions-info]');
        if (submissions_info) {
            this.submissions_list = new SearchList(submissions_info, (sf) => createOptionsSubmissionRow(site, sf));
        }
        const lists = row.querySelectorAll('[data-list]');
        const resize = new ResizeObserver((entries) => {
            const target = entries.pop()?.target;
            if (target) {
                lists.forEach((l) => {
                    l.style.height = target.style.height;
                });
            }
        });
        lists.forEach((l) => resize.observe(l));
        this.row = row;
    }
    setValues(values) {
        const compare_users = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;
        const users = Object.keys(values).sort(compare_users);
        this.users_list?.updateValues(users);
        this.users_stat?.replaceChildren(`${users.length}`);
        const submissions = Object.values(values).flat();
        const compare_submissions = typeof submissions[0] === 'string'
            ? new Intl.Collator(undefined, { numeric: true }).compare
            : typeof submissions[0] === 'number'
                ? (a, b) => a - b
                : undefined;
        submissions.sort(compare_submissions);
        this.submissions_list?.updateValues(submissions);
        this.submissions_stat?.replaceChildren(`${submissions.length}`);
        this.saved_details?.classList.toggle('hide', submissions.length === 0);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class SavedTable {
    table_details;
    constructor() {
        const table_details = {};
        const saved_table = document.querySelector('#saved-table');
        for (const site of SITES) {
            const site_details = new TableDetails(site);
            saved_table?.append(site_details.row);
            table_details[site] = site_details;
        }
        this.table_details = table_details;
    }
    async setTableValues() {
        const stored = await getSavedStorage(SITES);
        for (const site of SITES) {
            this.table_details[site].setValues(stored[site] ?? {});
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const G_options_form = new OptionsForm();
const G_saved_table = new SavedTable();
const G_undo_bar = new UndoBar();
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(async function () {
    const settings_state = await getUIStorage('settings');
    openOptionsTab(settings_state.tab);
    await setupOptionsSections();
    await setupCommandsSection();
    await G_saved_table.setTableValues();
    const edit_enabled = document.querySelector('#saved-info-edit-switch input')?.checked ?? false;
    const saved_table = document.querySelector('#saved-table');
    saved_table?.classList.toggle('editable', edit_enabled);
})();
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
getOptionsStorage('global').then((global_options) => {
    document.body.setAttribute('data-theme', global_options.theme);
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
browser.storage.local.onChanged.addListener((changes) => {
    const global_options_values = changes[optionsKey('global')]?.newValue;
    if (global_options_values) {
        document.body.setAttribute('data-theme', global_options_values.theme);
    }
    for (const site of SITES) {
        const changed = changes[savedKey(site)];
        if (!changed) {
            continue;
        }
        G_saved_table.table_details[site].setValues(changed.newValue ?? {});
    }
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function selectOrError(parent, selectors) {
    const element = parent.querySelector(selectors);
    if (!element) {
        throw new Error(`'${selectors}' does not exist`);
    }
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getJSON(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', (loaded) => {
            const target = loaded.target;
            if (target) {
                resolve(JSON.parse(`${target.result}`));
            }
            resolve({});
        });
        reader.readAsText(file);
    });
}
//---------------------------------------------------------------------------------------------------------------------
// tabs setup
//---------------------------------------------------------------------------------------------------------------------
function openOptionsTab(content) {
    document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('[data-tab-content]').forEach((content) => content.classList.add('hide'));
    document.querySelector(`[data-tab=${content}]`)?.classList.add('active');
    document.querySelector(`#${content}-content`)?.classList.remove('hide');
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', function () {
        const content = this.getAttribute('data-tab');
        if (content) {
            openOptionsTab(content);
            updateUIStorage('settings', { tab: content });
        }
    });
});
//---------------------------------------------------------------------------------------------------------------------
// option setup
//---------------------------------------------------------------------------------------------------------------------
async function setupOptionsSections() {
    const stored_options = await getOptionsStorage(SITES_AND_GLOBAL);
    G_options_form.setFormValues(stored_options, true);
    const global_section = document.querySelector('#globals-list');
    const sites_section = document.querySelector('#sites-list');
    const sites_toggles = document.querySelector('#sites-toggles');
    const wiki_url = 'https://github.com/solorey/Art-Saver/wiki/';
    for (const site of SITES_AND_GLOBAL) {
        const template = cloneTemplate('#options-section-template');
        const section = template.querySelector('section');
        section?.setAttribute('id', `${site}-options`);
        for (const option of Object.values(G_options_form.form[site])) {
            section?.append(option.block);
        }
        const header = section?.querySelector('[data-site-header]');
        const help_link = section?.querySelector('[data-help-link]');
        if (site === 'global') {
            header?.prepend('Global');
            help_link?.setAttribute('href', `${wiki_url}Options`);
            global_section?.prepend(template);
        }
        else {
            const info = SITES_INFO[site];
            header?.prepend(info.label);
            help_link?.setAttribute('href', `${wiki_url}${info.label.replaceAll(' ', '-')}`);
            sites_section?.append(template);
            createSiteToggle(sites_toggles, site, info, sites_section);
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class CommandInput {
    command;
    block;
    value_element;
    error_message;
    constructor(command) {
        this.command = command;
        const template = cloneTemplate('#command-template');
        const id = `command-${command.name}`;
        const label = template.querySelector('label');
        label?.append(command.description ?? '');
        label?.setAttribute('for', id);
        const input = selectOrError(template, 'input');
        input.id = id;
        input.value = command.shortcut ?? '';
        input.addEventListener('keyup', this.keyEvent);
        input.addEventListener('keydown', this.keyEvent);
        input.addEventListener('input', () => this.updateCommand());
        const button = template.querySelector('button');
        button?.addEventListener('click', function () {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        this.value_element = input;
        this.error_message = template.querySelector('p');
        this.block = template.firstElementChild;
    }
    keyEvent = (event) => {
        if (onShortcutKeyboardEvent(event)) {
            this.value_element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    getValue() {
        return this.value_element.value;
    }
    setValue(value) {
        this.value_element.value = `${value}`;
        this.updateCommand();
    }
    async updateCommand() {
        try {
            await browser.commands.update({ name: this.command.name ?? '', shortcut: this.value_element.value });
            this.error_message?.classList.add('hide');
        }
        catch (error) {
            console.log(error);
            this.error_message?.classList.remove('hide');
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setupCommandsSection() {
    const section = document.querySelector('#commands-list');
    const commands = await browser.commands.getAll();
    for (const command of commands) {
        const input = new CommandInput(command);
        section?.append(input.block);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#sites-open-all')?.addEventListener('click', () => {
    document.querySelectorAll('#sites-toggles .site-radio').forEach((sr) => sr.classList.add('active'));
    document.querySelectorAll('#sites-list .site-options').forEach((so) => so.classList.remove('hide'));
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#sites-close-all')?.addEventListener('click', () => {
    document.querySelectorAll('#sites-toggles .site-radio').forEach((sr) => sr.classList.remove('active'));
    document.querySelectorAll('#sites-list .site-options').forEach((so) => so.classList.add('hide'));
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createSiteToggle(parent, site, info, options_section) {
    const template = cloneTemplate('#site-toggle-template');
    const section = document.querySelector(`#${site}-options`);
    const button = template.querySelector('.site-button');
    const radio = template.querySelector('.site-radio');
    button?.append(info.label);
    button?.addEventListener('click', function () {
        const is_active = !section?.classList.toggle('hide');
        radio?.classList.toggle('active', is_active);
    });
    radio?.addEventListener('click', function () {
        parent?.querySelectorAll('.site-radio').forEach((radio) => radio.classList.remove('active'));
        options_section?.querySelectorAll('.site-options').forEach((section) => section.classList.add('hide'));
        this.classList.add('active');
        section?.classList.remove('hide');
    });
    parent?.append(template);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const form = document.querySelector('form');
form?.addEventListener('submit', (s) => s.preventDefault());
form?.addEventListener('input', () => saveOptions());
//---------------------------------------------------------------------------------------------------------------------
// form getting and setting
//---------------------------------------------------------------------------------------------------------------------
function saveOptions() {
    setOptionsStorage(G_options_form.getFormValues());
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const input_file = document.querySelector('#import-options');
input_file?.addEventListener('input', async function () {
    const file = this.files?.item(0);
    if (file) {
        const json_file = await getJSON(file);
        G_options_form.setFormValues(json_file);
    }
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#click-import')?.addEventListener('click', () => {
    input_file?.click();
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#export-options')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(G_options_form.getFormValues(), null, '\t')], {
        type: 'application/json',
    });
    browser.downloads.download({
        url: URL.createObjectURL(blob),
        filename: 'artsaver_settings.json',
        saveAs: true,
    });
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#reset-options')?.addEventListener('click', () => {
    G_undo_bar.primeUndoOptions('Options have been reset to default');
    G_options_form.setFormDefault();
    G_undo_bar.show();
});
//---------------------------------------------------------------------------------------------------------------------
// saved info table
//---------------------------------------------------------------------------------------------------------------------
function createOptionsUserRow(site, search) {
    const links = SITES_INFO[site].links;
    const template = cloneTemplate('#user-row-template');
    const label = template.querySelector('[data-label]');
    const strong = document.createElement('strong');
    strong.append(search.value.substring(search.start, search.end));
    label?.append(search.value.substring(0, search.start), strong, search.value.substring(search.end));
    template.querySelector('[data-user-link]')?.setAttribute('href', links.user(search.value));
    template.querySelector('[data-gallery-link]')?.setAttribute('href', links.gallery(search.value));
    template.querySelector('[data-favorites-link]')?.setAttribute('href', links.favorites(search.value));
    const row_id = `${site}u${search.value}`;
    const delete_button = template.querySelector('[data-delete-button]');
    if (G_delete_queue.has(row_id)) {
        delete_button?.classList.add('deleting');
    }
    else {
        delete_button?.addEventListener('click', async function () {
            G_delete_queue.add(row_id);
            this.classList.add('deleting');
            await browser.runtime.sendMessage({
                action: 'background_remove_user',
                site: site,
                user: search.value,
            });
            G_delete_queue.delete(row_id);
        }, { once: true });
    }
    return template.firstElementChild;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createOptionsSubmissionRow(site, search) {
    const links = SITES_INFO[site].links;
    const template = cloneTemplate('#submission-row-template');
    const label = template.querySelector('[data-label]');
    const strong = document.createElement('strong');
    strong.append(search.value.substring(search.start, search.end));
    label?.append(search.value.substring(0, search.start), strong, search.value.substring(search.end));
    template.querySelector('[data-submission-link]')?.setAttribute('href', links.submission(search.value));
    const submission_id = search.value;
    const row_id = `${site}s${search.value}`;
    const delete_button = template.querySelector('[data-delete-button]');
    if (G_delete_queue.has(row_id)) {
        delete_button?.classList.add('deleting');
    }
    else {
        delete_button?.addEventListener('click', async function () {
            G_delete_queue.add(row_id);
            this.classList.add('deleting');
            await browser.runtime.sendMessage({
                action: 'background_remove_submission',
                site: site,
                submission: submission_id,
            });
            G_delete_queue.delete(row_id);
        }, { once: true });
    }
    return template.firstElementChild;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#table-refresh')?.addEventListener('click', () => G_saved_table.setTableValues());
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#table-open-all')?.addEventListener('click', () => {
    document.querySelectorAll('[data-saved-details]').forEach((details) => details.toggleAttribute('open', true));
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#table-close-all')?.addEventListener('click', () => {
    document.querySelectorAll('[data-saved-details]').forEach((details) => details.removeAttribute('open'));
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#export-list')?.addEventListener('click', async () => {
    const json_info = await getSavedStorage(SITES);
    const blob = new Blob([JSON.stringify(json_info, null, '\t')], { type: 'application/json' });
    browser.downloads.download({
        url: URL.createObjectURL(blob),
        filename: 'artsaver_saved_info.json',
        saveAs: true,
    });
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#reset-list')?.addEventListener('click', async () => {
    await G_undo_bar.primeUndoSaved('Saved data has been reset');
    await removeSavedStorage(SITES);
    G_undo_bar.show();
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#saved-info')?.addEventListener('input', async function () {
    const file = this.files?.[0];
    if (!file) {
        return;
    }
    const file_label = document.querySelector('#saved-filename');
    file_label?.replaceChildren(file.name);
    await G_undo_bar.primeUndoSaved('Saved data has been overwritten');
    const json_file = await getJSON(file);
    await removeSavedStorage(SITES);
    await setSavedStorage(cleanSavedInfo(json_file));
    G_undo_bar.show();
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function union(setA, setB) {
    const un = new Set(setA);
    for (const elem of setB) {
        un.add(elem);
    }
    return un;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function keysSet(obj) {
    return new Set(Object.keys(obj));
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cleanSavedInfo(saved_info) {
    const cleaned_info = {};
    for (const site of SITES) {
        const saved_users = saved_info[site];
        if (!saved_users) {
            continue;
        }
        const users = {};
        for (const [user, submissions] of Object.entries(saved_users)) {
            if (!submissions || submissions.length <= 0) {
                continue;
            }
            let clean_submissions;
            if (SITES_INFO[site].id_type === 'number') {
                clean_submissions = [...new Set(submissions.map((n) => parseInt(`${n}`, 10)))].sort((a, b) => b - a);
            }
            else {
                clean_submissions = [...new Set(submissions.map((n) => `${n}`))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            }
            users[user.toLowerCase()] = clean_submissions;
        }
        if (Object.keys(users).length > 0) {
            cleaned_info[site] = users;
        }
    }
    return cleaned_info;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#add-info')?.addEventListener('input', async function () {
    const file = this.files?.[0];
    if (!file) {
        return;
    }
    const file_label = document.querySelector('#add-filename');
    file_label?.replaceChildren(file.name);
    await G_undo_bar.primeUndoSaved('Saved data has been appended');
    const json_file = await getJSON(file);
    const current_info = await getSavedStorage(SITES);
    await setSavedStorage(combineInfo(current_info, cleanSavedInfo(json_file)));
    G_undo_bar.show();
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function combineInfo(info1, info2) {
    const combined_info = {};
    for (const site of SITES) {
        const users = {};
        const users1 = info1[site] ?? {};
        const users2 = info2[site] ?? {};
        const all_users = union(keysSet(users1), keysSet(users2));
        for (const user of all_users) {
            const submissions = union(new Set(users1[user]), new Set(users2[user]));
            if (submissions.size > 0) {
                users[user] = [...submissions];
            }
        }
        if (Object.keys(users).length > 0) {
            combined_info[site] = users;
        }
    }
    return combined_info;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
document.querySelector('#saved-info-edit-switch')?.addEventListener('input', function () {
    const saved_table = document.querySelector('#saved-table');
    saved_table?.classList.toggle('editable', this.querySelector('input')?.checked);
});
//---------------------------------------------------------------------------------------------------------------------
// about info
//---------------------------------------------------------------------------------------------------------------------
document.querySelector('#version-number')?.append(`v${browser.runtime.getManifest().version}`);
