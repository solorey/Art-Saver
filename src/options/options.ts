class FunctionDebouncer {
    delay: number;
    handle?: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | number;
    callbackfn: () => void;
    constructor(callbackfn: () => void, delay?: number) {
        this.callbackfn = callbackfn;
        this.delay = delay ?? 500;
    }
    run() {
        if (this.handle) {
            clearTimeout(this.handle);
        }
        this.handle = setTimeout(() => {
            this.callbackfn();
            this.handle = undefined;
        }, this.delay);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class UndoBar {
    bar: HTMLElement | null;
    label: HTMLElement | null;
    timer: HTMLElement | null;
    duration = 20_000; // 20 seconds
    handle?: number;
    start?: number;
    old_options?: Partial<JsonOptions>;
    old_saved?: Partial<JsonSaved>;
    type?: 'options' | 'saved';

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
    countdown = (time_stamp: number) => {
        this.start ??= time_stamp;
        const elapsed = Math.min(time_stamp - this.start, this.duration);

        this.timer?.style.setProperty('width', `${(1 - elapsed / this.duration) * 100}%`);
        if (elapsed < this.duration) {
            this.handle = window.requestAnimationFrame(this.countdown);
        } else {
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
    primeUndoOptions(label: string) {
        this.type = 'options';
        this.label?.replaceChildren(label);
        this.old_options = G_options_form.getValues();
    }
    async primeUndoSaved(label: string) {
        this.type = 'saved';
        this.label?.replaceChildren(label);
        this.old_saved = await browser.runtime.sendMessage({ action: 'background_get_db_json' } as BackgroundMessage);
    }
    undo() {
        if (this.type === 'options' && this.old_options) {
            G_options_form.setValues(this.old_options);
        } else if (this.type === 'saved' && this.old_saved) {
            browser.runtime.sendMessage({
                action: 'background_set_db_json',
                saved_json: this.old_saved,
            } as BackgroundMessage);
        }
        this.hide();
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const METAS: Record<string, string> = {
    site: "Name of the website. 'deviantart', 'pixiv', etc.",
    userName: 'User name of the artist.',
    userId: 'ID of the artist. Usually as shown in the URL of the user page.',
    userDid: 'Decentralized Identifier of the artist.',
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
    slug: 'URL slug.',
};

//---------------------------------------------------------------------------------------------------------------------
// option type creation
//---------------------------------------------------------------------------------------------------------------------

class OptionSelect implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLSelectElement;
    constructor(option_id: string, values: SelectOption) {
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
        this.block = template.firstElementChild as HTMLElement;
    }
    getValue() {
        return this.value_element.value;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class OptionNumber implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLInputElement;
    constructor(option_id: string, values: NumberOption) {
        this.id = option_id;
        const template = cloneTemplate('#number-template');

        const label = template.querySelector('label');
        label?.setAttribute('for', option_id);
        label?.append(values.label);
        if (values.unit) {
            const unit = template.querySelector('[data-number-unit]');
            unit?.classList.remove('hide');
            unit?.replaceChildren(values.unit);
        }

        const input = selectOrError(template, 'input');

        input.id = option_id;
        input.setAttribute('min', `${values.min}`);

        template.querySelector<HTMLButtonElement>('.step-increase')?.addEventListener('mousedown', function () {
            numberChange(input, this, 1, undefined);
        });
        template.querySelector<HTMLButtonElement>('.step-decrease')?.addEventListener('mousedown', function () {
            numberChange(input, this, -1, undefined);
        });

        this.value_element = input;
        this.block = template.firstElementChild as HTMLElement;
    }
    getValue() {
        return this.value_element.valueAsNumber;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class OptionSlider implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLInputElement;
    range_input: HTMLInputElement;
    constructor(option_id: string, values: SliderOption) {
        this.id = option_id;
        const template = cloneTemplate('#slider-template');

        const label = template.querySelector('label');
        label?.setAttribute('for', option_id);
        label?.append(values.label);
        if (values.unit) {
            const unit = template.querySelector('[data-number-unit]');
            unit?.classList.remove('hide');
            unit?.replaceChildren(values.unit);
        }

        const number_input = selectOrError<HTMLInputElement>(template, 'input[type=number]');
        number_input.id = option_id;

        const range_input = selectOrError<HTMLInputElement>(template, 'input[type=range]');

        for (const input of [number_input, range_input]) {
            input.setAttribute('min', `${values.min}`);
            input.setAttribute('max', `${values.max}`);
        }
        template.querySelector<HTMLButtonElement>('.step-increase')?.addEventListener('mousedown', function () {
            numberChange(number_input, this, 1, range_input);
        });
        template.querySelector<HTMLButtonElement>('.step-decrease')?.addEventListener('mousedown', function () {
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
        this.block = template.firstElementChild as HTMLElement;
    }
    getValue() {
        return this.value_element.valueAsNumber;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        this.range_input.value = `${value}`;
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function numberChange(input: HTMLInputElement, button: HTMLButtonElement, value: number, range?: HTMLInputElement) {
    const step = () => {
        input.stepUp(value);
        if (range) {
            range.value = input.value;
        }
    };
    step();

    let interval_id: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | number = 0;
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

class OptionCheckbox implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLInputElement;
    constructor(option_id: string, values: CheckboxOption) {
        this.id = option_id;
        const template = cloneTemplate('#checkbox-template');

        const label = template.querySelector('label');
        label?.append(values.label);
        label?.setAttribute('for', option_id);

        const input = selectOrError(template, 'input');
        input.id = option_id;

        this.value_element = input;
        this.block = template.firstElementChild as HTMLElement;
    }
    getValue() {
        return this.value_element.checked;
    }
    setValue(value: OptionValue) {
        this.value_element.checked = Boolean(value);
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class OptionTextarea implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLTextAreaElement;
    constructor(option_id: string, values: TextareaOption) {
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
        this.block = template.firstElementChild as HTMLElement;
    }
    getValue() {
        return this.value_element.value;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        textareaResize(this.value_element);
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function textareaResize(textarea: HTMLTextAreaElement) {
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

class OptionShortcut implements OptionClass {
    id: string;
    block: HTMLElement;
    value_element: HTMLInputElement;
    constructor(option_id: string, values: ShortcutOption) {
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
        button?.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        this.value_element = input;
        this.block = template.firstElementChild as HTMLElement;
    }
    keyEvent = (event: KeyboardEvent) => {
        if (onShortcutKeyboardEvent(event)) {
            this.value_element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    getValue() {
        return this.value_element.value;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        this.value_element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function onShortcutKeyboardEvent(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Escape') {
        input.blur();
        return;
    }

    if (event.key === 'Tab') {
        return;
    }

    event.preventDefault();
    if (!event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            input.value = '';
            return true;
        }
    }

    const shortcut = getShortcutFromEvent(event);
    input.value = shortcut;

    if (shortcut && shortcut.at(-1) !== '+') {
        input.blur();
        return true;
    } else if (!shortcut) {
        return true;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class OptionsForm {
    form: Record<SiteOrGlobal, Record<string, OptionClass>>;
    constructor() {
        const options_form: Partial<typeof this.form> = {};
        for (const site of SITES_AND_GLOBAL) {
            const site_options: Record<string, OptionClass> = {};
            const site_form: SiteForm = SITES_AND_GLOBAL_FORMS[site];
            for (const [key, option] of Object.entries(site_form)) {
                const option_id = `${site}-${key}`;
                let new_option: OptionClass;
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

        this.form = options_form as typeof this.form;

        for (const site of SITES_AND_GLOBAL) {
            const site_form: SiteForm = SITES_AND_GLOBAL_FORMS[site];
            for (const key in site_form) {
                const option_class = options_form[site]?.[key];
                if (!option_class) {
                    continue;
                }
                const related = site_form[key].related ?? [];
                if ((SITES as string[]).includes(site) && key !== 'enabled') {
                    related.push({ option: 'enabled', value: true });
                }
                if (related.length > 0) {
                    for (const r of related) {
                        options_form[site]?.[r.option]?.value_element?.addEventListener('change', () => {
                            this.showRelated(site, related, option_class);
                        });
                    }
                    this.showRelated(site, related, option_class);
                }
            }
        }
    }
    getValues() {
        const form_options: Partial<JsonOptions> = {};
        for (const site of SITES_AND_GLOBAL) {
            const values: OptionsValues = {};
            for (const [key, option] of Object.entries(this.form[site])) {
                values[key] = option.getValue();
            }
            form_options[site] = values;
        }
        return form_options;
    }
    setValues(all_options: Partial<JsonOptions>, initialize_default = false) {
        for (const site of SITES_AND_GLOBAL) {
            const site_form: SiteForm = SITES_AND_GLOBAL_FORMS[site];
            for (const [key, option] of Object.entries(site_form)) {
                let value = all_options[site]?.[key];
                if (initialize_default) {
                    value ??= option.default;
                } else if (value == null) {
                    continue;
                }
                this.form[site][key].setValue(value);
            }
        }
        G_save_options.run();
    }
    setDefault() {
        this.setValues({}, true);
    }
    showRelated(site: SiteOrGlobal, related: OptionRelated[], option: OptionClass) {
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

class CommandInput {
    command: Browser.Commands.Command;
    block: HTMLElement;
    value_element: HTMLInputElement;
    error_message: HTMLParagraphElement | null;
    constructor(command: Browser.Commands.Command) {
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
        button?.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        this.value_element = input;
        this.error_message = template.querySelector('p');
        this.block = template.firstElementChild as HTMLElement;
    }
    keyEvent = (event: KeyboardEvent) => {
        if (onShortcutKeyboardEvent(event)) {
            this.value_element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    getValue(): OptionValue {
        return this.value_element.value;
    }
    setValue(value: OptionValue) {
        this.value_element.value = `${value}`;
        this.updateCommand();
    }
    async updateCommand() {
        try {
            await browser.commands.update({ name: this.command.name ?? '', shortcut: this.value_element.value });
            this.error_message?.classList.add('hide');
        } catch (error) {
            console.log(error);
            this.error_message?.classList.remove('hide');
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class CommandsForm {
    form: Record<string, CommandInput> = {};
    getValues() {
        const values: Record<string, OptionValue> = {};
        for (const [name, command] of Object.entries(this.form)) {
            values[name] = command.getValue();
        }
        return values;
    }
    setValues(values: Record<string, OptionValue>) {
        for (const [name, value] of Object.entries(values)) {
            this.form[name]?.setValue(value);
        }
    }
    setDefault() {
        const commands = browser.runtime.getManifest().commands ?? {};
        for (const [name, command] of Object.entries(commands)) {
            this.form[name]?.setValue(command.suggested_key?.default ?? '');
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class TableSiteData {
    site: Site;
    row: DocumentFragment;
    details_element: HTMLDetailsElement | null;
    users_stat: HTMLElement | null;
    submissions_stat: HTMLElement | null;
    users_list?: SearchList;
    submissions_list?: SearchList;
    loading = false;

    constructor(site: Site) {
        this.site = site;
        const row = cloneTemplate('#stats-row-template');

        row.querySelector('[data-site-label]')?.append(SITES_INFO[site].label);

        this.details_element = row.querySelector<HTMLDetailsElement>('[data-saved-details]');

        this.users_stat = row.querySelector<HTMLElement>('[data-total-users]');
        this.submissions_stat = row.querySelector<HTMLElement>('[data-total-submissions]');

        const users_info = row.querySelector<HTMLElement>('[data-users-info]');
        if (users_info) {
            this.users_list = new SearchList(users_info, (sf) => createOptionsUserRow(site, sf));
        }

        const submissions_info = row.querySelector<HTMLElement>('[data-submissions-info]');
        if (submissions_info) {
            this.submissions_list = new SearchList(submissions_info, (sf) => createOptionsSubmissionRow(site, sf));
        }

        const lists = row.querySelectorAll<HTMLElement>('[data-list]');
        const resize = new ResizeObserver((entries) => {
            const target = entries.pop()?.target as HTMLElement | null;
            if (target) {
                lists.forEach((l) => {
                    l.style.blockSize = target.style.blockSize;
                    l.style.height = target.style.height;
                    l.style.width = target.style.width;
                });
            }
        });
        for (const l of lists) {
            resize.observe(l);
        }

        this.row = row;
    }
    setValues(users: User[], submissions: Submission[]) {
        this.users_list?.updateValues(users);
        this.users_stat?.replaceChildren(`${users.length}`);

        this.submissions_list?.updateValues(submissions);
        this.submissions_stat?.replaceChildren(`${submissions.length}`);

        this.details_element?.classList.toggle('hide', submissions.length === 0);
        this.loading = false;
        G_saved_table.checkLoading();
    }
    async getValues() {
        this.loading = true;
        const values: Awaited<ReturnType<typeof getDBSiteValues>> = await browser.runtime.sendMessage({
            action: 'background_get_db_site_values',
            site: this.site,
        } as BackgroundMessage);
        this.setValues(values.users, values.submissions);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class SavedTable {
    table_data: Record<Site, TableSiteData>;
    table_element?: HTMLElement | null;
    category_select?: HTMLSelectElement | null;
    search_input?: HTMLInputElement | null;
    clear_button?: HTMLButtonElement | null;
    case_flag?: HTMLInputElement | null;
    whole_flag?: HTMLInputElement | null;
    regex_flag?: HTMLInputElement | null;
    sort_button?: HTMLButtonElement | null;

    constructor() {
        const table_data: Partial<Record<Site, TableSiteData>> = {};
        const saved_table = document.querySelector<HTMLElement>('#saved-table');
        for (const site of SITES) {
            const site_data = new TableSiteData(site);
            saved_table?.append(site_data.row);

            table_data[site] = site_data;
        }
        this.table_data = table_data as Record<Site, TableSiteData>;

        const search_box = document.querySelector<HTMLElement>('#search-table');

        const category_select = search_box?.querySelector<HTMLSelectElement>('[data-category]');
        category_select?.addEventListener('input', () => {
            if (this.hasSearch()) {
                this.setSearch();
            }
        });
        this.category_select = category_select;

        const search_input = search_box?.querySelector<HTMLInputElement>('[data-search]');
        search_input?.addEventListener('input', () => {
            this.showSearchActive();
            this.setSearch();
        });
        this.search_input = search_input;

        const clear_button = search_box?.querySelector<HTMLButtonElement>('[data-clear]');
        clear_button?.addEventListener('click', () => {
            if (this.search_input) {
                this.search_input.value = '';
            }
            this.showSearchActive();
            this.setSearch();
            for (const site_data of Object.values(this.table_data)) {
                site_data.users_list?.setVirtualList();
                site_data.submissions_list?.setVirtualList();
            }
        });
        this.clear_button = clear_button;

        const case_flag = search_box?.querySelector<HTMLInputElement>('[data-match-case]');
        case_flag?.addEventListener('input', () => {
            if (this.hasSearch()) {
                this.setSearch();
            }
        });
        this.case_flag = case_flag;

        const whole_flag = search_box?.querySelector<HTMLInputElement>('[data-match-whole]');
        whole_flag?.addEventListener('input', () => {
            if (this.hasSearch()) {
                this.setSearch();
            }
        });
        this.whole_flag = whole_flag;

        const regex_flag = search_box?.querySelector<HTMLInputElement>('[data-use-regex]');
        regex_flag?.addEventListener('input', () => {
            if (this.hasSearch()) {
                this.setSearch();
            }
        });
        this.regex_flag = regex_flag;

        const sort_button = search_box?.querySelector<HTMLButtonElement>('[data-sort]');
        sort_button?.addEventListener('click', () => {
            toggleListSort(sort_button);
            if (this.hasSearch()) {
                this.setSearch();
            }
        });
        this.sort_button = sort_button;
        this.table_element = saved_table;
        this.showSearchActive();
    }
    hasSearch() {
        return Boolean(this.search_input?.value);
    }
    showSearchActive() {
        const has_value = this.hasSearch();
        this.clear_button?.classList.toggle('hide', !has_value);
        for (const site_data of Object.values(this.table_data)) {
            for (const search_box of site_data.details_element?.querySelectorAll('[data-controls]') ?? []) {
                search_box.classList.toggle('hide', has_value);
            }
        }
    }
    setSiteSearch(site: Site) {
        const category = this.category_select?.value ?? 'all';
        const search = this.search_input?.value ?? '';
        const sort = this.sort_button?.getAttribute('data-sort') ?? undefined;
        const match_case = this.case_flag?.checked ?? false;
        const match_whole = this.whole_flag?.checked ?? false;
        const use_regex = this.regex_flag?.checked ?? false;

        const site_data = this.table_data[site];
        let max_results = 0;
        let row_height = 0;
        let default_height = 0;

        const searchList = (list?: SearchList) => {
            if (list) {
                const result_values = searchValues(search, list.values, match_case, match_whole, use_regex, sort);
                max_results = Math.max(max_results, result_values.length);
                const vlist = list.virtual_list;
                row_height = Math.max(vlist.row_height, row_height);
                default_height = Math.max(vlist.default_height, default_height);
                vlist.updateList(result_values);
            }
        };
        const has_search = Boolean(search);
        if (has_search && category === 'users') {
            searchList(site_data.users_list);
            site_data.submissions_list?.virtual_list.updateList([]);
        } else if (has_search && category === 'submissions') {
            searchList(site_data.submissions_list);
            site_data.users_list?.virtual_list.updateList([]);
        } else {
            searchList(site_data.users_list);
            searchList(site_data.submissions_list);
        }

        const has_results = max_results > 0;
        const details = site_data.details_element;
        if (details) {
            details.toggleAttribute('open', has_search && has_results);
            details.classList.toggle('hide', !has_results);
            if (has_results) {
                for (const list_box of details.querySelectorAll<HTMLElement>('[data-list]')) {
                    list_box.style.blockSize = `${Math.min((max_results + 1) * row_height, default_height)}px`;
                }
            }
        }
    }
    setSearch() {
        for (const site of SITES) {
            this.setSiteSearch(site);
        }
    }
    async getSiteValues(site: Site) {
        await this.table_data[site].getValues();
    }
    async getValues() {
        this.showLoading();
        await Promise.all(SITES.map((s) => this.getSiteValues(s)));
    }
    showLoading() {
        this.table_element?.classList.add('loading-screen');
    }
    checkLoading() {
        if (Object.values(this.table_data).every((w) => !w.loading)) {
            this.table_element?.classList.remove('loading-screen');
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const G_delete_queue = new Set();
const G_options_form = new OptionsForm();
const G_commands_form = new CommandsForm();
const G_saved_table = new SavedTable();
const G_undo_bar = new UndoBar();
const G_save_options = new FunctionDebouncer(saveOptions);

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

(async () => {
    const settings_state = await getUIStorage<SettingsStateValues>('settings');
    openOptionsTab(settings_state.tab);

    await setupOptionsSections();
    await setupCommandsSection();
    G_saved_table.getValues();

    const edit_enabled = document.querySelector<HTMLInputElement>('#saved-info-edit-switch input')?.checked ?? false;
    const saved_table = document.querySelector<HTMLElement>('#saved-table');
    saved_table?.classList.toggle('editable', edit_enabled);
})();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

browser.runtime.onMessage.addListener((message: any) => {
    return optionsMessageActions(message);
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function optionsMessageActions(message: OptionsMessage) {
    switch (message.action) {
        case 'options_db_update': {
            const site = message.site as Site;
            G_saved_table.getSiteValues(site).then(() => {
                if (G_saved_table.hasSearch()) {
                    G_saved_table.setSiteSearch(site);
                }
            });
            break;
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

getOptionsStorage<GlobalOptionsValues>('global').then((global_options) => {
    document.body.setAttribute('data-theme', global_options.theme);
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

browser.storage.local.onChanged.addListener((changes) => {
    const global_options_values = changes[optionsKey('global')]?.newValue as GlobalOptionsValues | undefined;
    if (global_options_values) {
        document.body.setAttribute('data-theme', global_options_values.theme);
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function selectOrError<K extends keyof HTMLElementTagNameMap>(
    parent: ParentNode,
    selectors: K,
): HTMLElementTagNameMap[K];
function selectOrError<E extends Element = Element>(parent: ParentNode, selectors: string): E;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function selectOrError<E extends Element = Element>(parent: ParentNode, selectors: string): E {
    const element = parent.querySelector<E>(selectors);
    if (!element) {
        throw new Error(`'${selectors}' does not exist`);
    }
    return element;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getJSON<T>(file: File) {
    return new Promise<Partial<T>>((resolve) => {
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

function openOptionsTab(content: string) {
    for (const tab of document.querySelectorAll('[data-tab]')) {
        tab.classList.remove('active');
    }
    for (const content of document.querySelectorAll('[data-tab-content]')) {
        content.classList.add('hide');
    }

    document.querySelector(`[data-tab=${content}]`)?.classList.add('active');

    document.querySelector(`#${content}-content`)?.classList.remove('hide');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => {
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
    G_options_form.setValues(stored_options, true);

    const global_section = document.querySelector<HTMLElement>('#globals-list');
    const sites_section = document.querySelector<HTMLElement>('#sites-list');
    const sites_toggles = document.querySelector<HTMLElement>('#sites-toggles');

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
        } else {
            const info = SITES_INFO[site];

            header?.prepend(info.label);
            help_link?.setAttribute('href', `${wiki_url}${info.label.replaceAll(' ', '-')}`);

            sites_section?.append(template);

            createSiteToggle(sites_toggles, site, info, sites_section);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setupCommandsSection() {
    const section = document.querySelector<HTMLElement>('#commands-list');
    const commands = await browser.commands.getAll();
    for (const command of commands) {
        const input = new CommandInput(command);
        G_commands_form.form[`${command.name}`] = input;
        section?.append(input.block);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#sites-open-all')?.addEventListener('click', () => {
    for (const sr of document.querySelectorAll('#sites-toggles .site-radio')) {
        sr.classList.add('active');
    }
    for (const so of document.querySelectorAll('#sites-list .site-options')) {
        so.classList.remove('hide');
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#sites-close-all')?.addEventListener('click', () => {
    for (const sr of document.querySelectorAll('#sites-toggles .site-radio')) {
        sr.classList.remove('active');
    }
    for (const so of document.querySelectorAll('#sites-list .site-options')) {
        so.classList.add('hide');
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createSiteToggle(parent: HTMLElement | null, site: Site, info: SiteInfo, options_section: HTMLElement | null) {
    const template = cloneTemplate('#site-toggle-template');

    const section = document.querySelector<HTMLElement>(`#${site}-options`);

    const button = template.querySelector('.site-button');
    const radio = template.querySelector<HTMLElement>('.site-radio');

    button?.append(info.label);
    button?.addEventListener('click', () => {
        const is_active = !section?.classList.toggle('hide');
        radio?.classList.toggle('active', is_active);
    });

    radio?.addEventListener('click', function () {
        parent?.querySelectorAll('.site-radio').forEach((radio) => {
            radio.classList.remove('active');
        });
        options_section?.querySelectorAll('.site-options').forEach((section) => {
            section.classList.add('hide');
        });

        this.classList.add('active');
        section?.classList.remove('hide');
    });

    parent?.append(template);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#sites-enable-all')?.addEventListener('click', () => {
    for (const site of SITES) {
        G_options_form.form[site].enabled.setValue(true);
    }
    G_save_options.run();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#sites-disable-all')?.addEventListener('click', () => {
    for (const site of SITES) {
        G_options_form.form[site].enabled.setValue(false);
    }
    G_save_options.run();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const form = document.querySelector('form');
form?.addEventListener('submit', (s) => s.preventDefault());
form?.addEventListener('input', () => G_save_options.run());

//---------------------------------------------------------------------------------------------------------------------
// form getting and setting
//---------------------------------------------------------------------------------------------------------------------

function saveOptions() {
    setOptionsStorage(G_options_form.getValues());
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const input_file = document.querySelector<HTMLInputElement>('#import-options');
input_file?.addEventListener('input', async function () {
    const file = this.files?.item(0);
    if (file) {
        const json_file = await getJSON<JsonOptions & { commands: Record<string, OptionValue> }>(file);
        G_options_form.setValues(json_file);
        G_commands_form.setValues(json_file.commands ?? {});
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#click-import')?.addEventListener('click', () => {
    input_file?.click();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#export-options')?.addEventListener('click', () => {
    const options = G_options_form.getValues();
    const commands = G_commands_form.getValues();
    const values = {
        commands,
        ...options,
    };
    const blob = new Blob([JSON.stringify(values, null, '\t')], {
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
    G_options_form.setDefault();
    G_commands_form.setDefault();
    G_undo_bar.show();
});

//---------------------------------------------------------------------------------------------------------------------
// saved info table
//---------------------------------------------------------------------------------------------------------------------

function createOptionsUserRow(site: Site, search: VirtualSearchResult) {
    const links = SITES_INFO[site].links;

    const template = cloneTemplate('#user-row-template');

    const match = document.createElement('span');
    match.classList.add('row-match');
    match.append(search.value.substring(search.start, search.end));
    template
        .querySelector('[data-label]')
        ?.append(search.value.substring(0, search.start), match, search.value.substring(search.end));

    template.querySelector('[data-user-link]')?.setAttribute('href', links.user(search.value));
    template.querySelector('[data-gallery-link]')?.setAttribute('href', links.gallery(search.value));
    template.querySelector('[data-favorites-link]')?.setAttribute('href', links.favorites(search.value));

    const row_id = `${site}u${search.value}`;

    const delete_button = template.querySelector<HTMLButtonElement>('[data-delete-button]');
    if (G_delete_queue.has(row_id)) {
        delete_button?.classList.add('deleting');
    } else {
        delete_button?.addEventListener(
            'click',
            async function () {
                G_delete_queue.add(row_id);
                this.classList.add('deleting');
                await browser.runtime.sendMessage({
                    action: 'background_remove_user',
                    site: site,
                    user: search.value,
                } as BackgroundMessage);
                G_delete_queue.delete(row_id);
            },
            { once: true },
        );
    }
    return template.firstElementChild as HTMLElement;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createOptionsSubmissionRow(site: Site, search: VirtualSearchResult) {
    const links = SITES_INFO[site].links;

    const template = cloneTemplate('#submission-row-template');

    const match = document.createElement('span');
    match.classList.add('row-match');
    match.append(search.value.substring(search.start, search.end));
    template
        .querySelector('[data-label]')
        ?.append(search.value.substring(0, search.start), match, search.value.substring(search.end));

    template.querySelector('[data-submission-link]')?.setAttribute('href', links.submission(search.value));

    const row_id = `${site}s${search.value}`;

    const delete_button = template.querySelector<HTMLButtonElement>('[data-delete-button]');
    if (G_delete_queue.has(row_id)) {
        delete_button?.classList.add('deleting');
    } else {
        delete_button?.addEventListener(
            'click',
            async function () {
                let submission: Submission = search.value;
                if (SITES_INFO[site].id_type === 'number') {
                    submission = parseInt(submission, 10);
                }

                G_delete_queue.add(row_id);
                this.classList.add('deleting');
                await browser.runtime.sendMessage({
                    action: 'background_remove_submission',
                    site,
                    submission,
                } as BackgroundMessage);
                G_delete_queue.delete(row_id);
            },
            { once: true },
        );
    }
    return template.firstElementChild as HTMLElement;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#table-refresh')?.addEventListener('click', () => G_saved_table.getValues());

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#table-open-all')?.addEventListener('click', () => {
    for (const details of document.querySelectorAll('[data-saved-details]')) {
        details.toggleAttribute('open', true);
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#table-close-all')?.addEventListener('click', () => {
    for (const details of document.querySelectorAll('[data-saved-details]')) {
        details.removeAttribute('open');
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#export-list')?.addEventListener('click', async () => {
    const json_info = await browser.runtime.sendMessage({ action: 'background_get_db_json' } as BackgroundMessage);
    const blob = new Blob([JSON.stringify(json_info, null, '\t')], { type: 'application/json' });

    browser.downloads.download({
        url: URL.createObjectURL(blob),
        filename: 'artsaver_saved_info.json',
        saveAs: true,
    });
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector('#reset-list')?.addEventListener('click', async () => {
    G_saved_table.showLoading();
    await G_undo_bar.primeUndoSaved('Saved data has been reset');
    await browser.runtime.sendMessage({ action: 'background_set_db_json', saved_json: {} } as BackgroundMessage);
    G_undo_bar.show();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector<HTMLInputElement>('#saved-info')?.addEventListener('input', async function () {
    const file = this.files?.[0];
    if (!file) {
        return;
    }
    const file_label = document.querySelector('#saved-filename');
    file_label?.replaceChildren(file.name);

    G_saved_table.showLoading();

    await G_undo_bar.primeUndoSaved('Saved data has been overwritten');

    const saved_json = await getJSON<JsonSaved>(file);
    await browser.runtime.sendMessage({
        action: 'background_set_db_json',
        saved_json,
    } as BackgroundMessage);
    G_undo_bar.show();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector<HTMLInputElement>('#add-info')?.addEventListener('input', async function () {
    const file = this.files?.[0];
    if (!file) {
        return;
    }

    const file_label = document.querySelector('#add-filename');
    file_label?.replaceChildren(file.name);

    G_saved_table.showLoading();
    await G_undo_bar.primeUndoSaved('Saved data has been appended');

    const saved_json = await getJSON<JsonSaved>(file);
    await browser.runtime.sendMessage({
        action: 'background_add_db_json',
        saved_json,
    } as BackgroundMessage);
    G_undo_bar.show();
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

document.querySelector<HTMLElement>('#saved-info-edit-switch')?.addEventListener('input', function () {
    const saved_table = document.querySelector<HTMLElement>('#saved-table');
    saved_table?.classList.toggle('editable', this.querySelector('input')?.checked);
});

//---------------------------------------------------------------------------------------------------------------------
// about info
//---------------------------------------------------------------------------------------------------------------------

document.querySelector('#version-number')?.append(`v${browser.runtime.getManifest().version}`);
