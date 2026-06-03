class FunctionThrottler {
    is_running = false;
    continue_running = false;
    wait_time: number;
    callbackfn: () => Promise<void>;
    constructor(callbackfn: () => Promise<void>, wait_time?: number) {
        this.callbackfn = callbackfn;
        this.wait_time = wait_time ?? 0.1;
    }
    run() {
        if (this.is_running) {
            this.continue_running = true;
            return;
        }
        this.is_running = true;
        this.waitThenRun();
    }
    async waitThenRun() {
        await timer(this.wait_time);
        this.main();
    }
    async main() {
        this.continue_running = false;
        try {
            await this.callbackfn();
        } catch (error) {
            asLog('error', error);
        }
        if (this.continue_running) {
            this.waitThenRun();
        } else {
            this.is_running = false;
        }
    }
}

//---------------------------------------------------------------------------------------------------------------------
// tool tip
//---------------------------------------------------------------------------------------------------------------------

class ToolTip {
    container: HTMLElement;
    tip: HTMLElement | null;
    user_row: HTMLElement | null;
    user: HTMLElement | null;
    link: HTMLAnchorElement | null;
    submission: HTMLElement | null;
    error: HTMLElement | null;
    constructor(root: HTMLElement, nodes: NodeListOf<ChildNode>) {
        const { container, shadow } = createCustomElement('tool-tip');
        shadow.append(G_ui_styles.common.cloneNode(true), G_ui_styles.tool_tip.cloneNode(true), ...nodes);

        const tip = shadow.querySelector<HTMLElement>('#tool-tip');
        tip?.setAttribute('data-theme', G_options.theme);
        tip?.style.setProperty('top', '0');
        tip?.style.setProperty('left', '0');
        G_themed_elements.push(tip);

        this.container = container;
        this.tip = tip;
        this.user_row = shadow.querySelector('#user-row');
        this.user = shadow.querySelector('#user');
        this.link = shadow.querySelector('#user-link');
        this.submission = shadow.querySelector('#submission');
        this.error = shadow.querySelector('#error-tip');

        root.append(container);
    }
    show() {
        this.tip?.classList.add('show');
    }
    fade() {
        this.tip?.classList.remove('show');
    }
    move(x: HTMLElement) {
        const rect = x.getBoundingClientRect();
        const top = rect.top + window.scrollY - (this.tip?.offsetHeight ?? 0) - 1;
        this.tip?.style.setProperty('top', `${Math.round(top)}px`);
        // don't let the tooltip cross the document width
        const left = Math.min(rect.left + window.scrollX, document.body.offsetWidth - (this.tip?.offsetWidth ?? 0));
        this.tip?.style.setProperty('left', `${Math.round(left)}px`);
        this.show();
    }
    showTip(type: string) {
        this.tip?.querySelectorAll<HTMLElement>('[data-tip]').forEach((section) => {
            section.classList.add('hide');
        });
        this.tip?.querySelector(`[data-tip="${type}"]`)?.classList.remove('hide');
    }
    showSubmission(x: HTMLElement, user: User, submission: Submission) {
        if (user) {
            this.user_row?.classList.remove('hide');
            this.user?.replaceChildren(user);
        } else {
            this.user_row?.classList.add('hide');
            this.user?.replaceChildren();
        }
        this.submission?.replaceChildren(`${submission}`);
        this.link?.setAttribute('href', userGalleryLink(user));
        this.showTip('submission');
        this.move(x);
    }
    showError(x: HTMLElement, error: string | Error) {
        this.error?.replaceChildren(`${error}`);
        this.showTip('error');
        this.move(x);
    }
}

//---------------------------------------------------------------------------------------------------------------------
// buttons
//---------------------------------------------------------------------------------------------------------------------

class StateManager {
    submission_map = new Map<Submission, SubmissionManager>();
    is_updating = false;
    continue_updating = false;
    addSubmissionButton(
        info: SubmissionInfo,
        type: 'check',
        parent: HTMLElement,
        options: ContainerOptions,
        state: CheckButtonState,
    ): void;
    addSubmissionButton(info: SubmissionInfo, type: 'download', parent: HTMLElement, options: ContainerOptions): void;
    addSubmissionButton(
        info: SubmissionInfo,
        type: ButtonType,
        parent: HTMLElement,
        options: ContainerOptions,
        state?: ButtonState,
    ) {
        let submission_group = this.submission_map.get(info.submission);
        if (!submission_group) {
            submission_group = new SubmissionManager(info, type, state);
            this.submission_map.set(info.submission, submission_group);
        }
        const button = submission_group.addButton(parent, options);
        return button;
    }
    cleanSubmissions() {
        for (const [submission, submission_group] of this.submission_map.entries()) {
            submission_group.cleanButtons();
            const has_buttons = submission_group.buttons.length > 0;
            const is_check_or_download = ['check', 'download'].includes(submission_group.type);
            if (!has_buttons && is_check_or_download) {
                this.submission_map.delete(submission);
            }
        }
    }
    runUpdateLoop() {
        if (this.is_updating) {
            this.continue_updating = true;
            return;
        }
        this.is_updating = true;
        window.requestAnimationFrame(() => {
            this.updateSubmissions();
        });
    }
    updateSubmissions() {
        this.continue_updating = false;
        this.cleanSubmissions();
        for (const submission_group of this.submission_map.values()) {
            submission_group.updateButtons();
        }
        if (this.continue_updating) {
            window.requestAnimationFrame(() => {
                this.updateSubmissions();
            });
        } else {
            this.is_updating = false;
        }
    }
    setType(submission: Submission, type: 'check', state: CheckButtonState): void;
    setType(submission: Submission, type: 'downloading', state: DownloadingButtonState): void;
    setType(submission: Submission, type: 'download'): void;
    setType(submission: Submission, type: 'waiting'): void;
    setType(submission: Submission, type: 'error', state: ErrorButtonState): void;
    setType(submission: Submission, type: ButtonType, state?: ButtonState) {
        const submission_group = this.submission_map.get(submission);
        if (submission_group) {
            submission_group.type = type;
            if (state) {
                submission_group.state = state;
            }
        }
        this.runUpdateLoop();
    }
    updateState(submission: Submission, type: 'check', state: Partial<CheckButtonState>): void;
    updateState(submission: Submission, type: 'downloading', state: Partial<DownloadingButtonState>): void;
    updateState(submission: Submission, type: 'error', state: Partial<ErrorButtonState>): void;
    updateState(submission: Submission, type: ButtonType, state: Partial<ButtonState>) {
        const submission_group = this.submission_map.get(submission);
        if (submission_group && submission_group.type === type) {
            submission_group.state = {
                ...submission_group.state,
                ...state,
            };
        }
        this.runUpdateLoop();
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class SubmissionManager {
    info: SubmissionInfo;
    type: ButtonType;
    state: ButtonState;
    buttons: SubmissionAction[] = [];
    constructor(info: SubmissionInfo, type: ButtonType, state?: ButtonState) {
        this.info = info;
        this.type = type;
        this.state = state ?? {};
    }
    addButton(parent: HTMLElement, options: ContainerOptions) {
        let button: SubmissionAction;
        switch (this.type) {
            case 'check':
                button = new CheckButton(this.info, parent, options);
                break;
            case 'download':
                button = new DownloadButton(this.info, parent, options);
                break;
            case 'waiting':
                button = new WaitingButton(this.info, parent, options);
                break;
            case 'downloading':
                button = new DownloadingButton(this.info, parent, options);
                break;
            case 'error':
                button = new ErrorButton(this.info, parent, options);
                break;
        }
        button.update?.(this.state);
        this.buttons.push(button);
        return button;
    }
    updateButtons() {
        const current_buttons = this.buttons;
        this.buttons = [];
        for (const button of current_buttons) {
            if (button.type !== this.type) {
                button.remove();
                this.addButton(button.parent, button.options);
            } else {
                button.update?.(this.state);
                this.buttons.push(button);
            }
        }
    }
    cleanButtons() {
        // clean disconnected nodes
        const buttons: SubmissionAction[] = [];
        for (const button of this.buttons) {
            if (!button.container.isConnected) {
                button.remove();
                continue;
            }
            buttons.push(button);
        }
        this.buttons = buttons;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class CheckButton implements SubmissionAction {
    type: ButtonType = 'check';

    info: SubmissionInfo;
    parent: HTMLElement;
    options: ContainerOptions;

    button: HTMLButtonElement;
    container: HTMLElement;
    saved_user: User;

    constructor(info: SubmissionInfo, parent: HTMLElement, options: ContainerOptions) {
        this.info = info;
        this.saved_user = info.user;
        this.options = options;

        const { container, shadow } = initalButtonContainer();

        const button = document.createElement('button');
        button.setAttribute('class', 'action-button icon-check');
        button.addEventListener('mouseover', () => {
            G_tool_tip.showSubmission(button, this.saved_user, this.info.submission);
        });
        button.addEventListener('mouseout', () => {
            G_tool_tip.fade();
        });
        button.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                checkButtonAction(this.info.submission);
            },
            { once: true },
        );

        if (options.screen) {
            const screen = document.createElement('div');
            screen.classList.add('screen');
            shadow.append(screen);
        }

        shadow.append(button);

        parent.append(container);

        this.button = button;
        this.container = container;
        this.parent = parent;
        this.setColor();
    }
    setColor() {
        this.button.setAttribute('data-color', this.info.user === this.saved_user ? 'green' : 'yellow');
    }
    update(state: Partial<CheckButtonState>) {
        if (state.saved_user != null) {
            this.saved_user = state.saved_user;
            this.setColor();
        }
    }
    remove() {
        this.container.parentElement?.removeChild(this.container);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkButtonAction(submission: Submission) {
    G_state_manager.setType(submission, 'waiting');
    browser.runtime.sendMessage({
        action: 'background_remove_submission',
        site: G_site_info.site,
        submission,
    } as BackgroundMessage);
    G_tool_tip.fade();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DownloadButton implements SubmissionAction {
    info: SubmissionInfo;
    parent: HTMLElement;
    options: ContainerOptions;

    button: HTMLButtonElement;
    container: HTMLElement;
    type: ButtonType = 'download';

    constructor(info: SubmissionInfo, parent: HTMLElement, options: ContainerOptions) {
        this.info = info;
        this.options = options;
        const { container, shadow } = initalButtonContainer();

        const button = document.createElement('button');
        button.setAttribute('class', 'action-button icon-download');
        button.classList.toggle('invisible', !parent.matches(':hover'));

        button.addEventListener('mouseover', () => {
            G_tool_tip.showSubmission(button, this.info.user, this.info.submission);
        });
        button.addEventListener('mouseout', () => {
            G_tool_tip.fade();
        });
        button.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                downloadButtonAction(this.info.submission);
            },
            { once: true },
        );

        parent.addEventListener('mouseover', this.mouseoverEvent);
        parent.addEventListener('mouseout', this.mouseoutEvent);

        shadow.append(button);
        parent.append(container);

        this.parent = parent;
        this.button = button;
        this.container = container;
    }
    mouseoverEvent = () => {
        this.button.classList.remove('invisible');
    };
    mouseoutEvent = () => {
        this.button.classList.add('invisible');
    };
    remove() {
        this.parent.removeEventListener('mouseover', this.mouseoverEvent);
        this.parent.removeEventListener('mouseout', this.mouseoutEvent);

        this.container.parentElement?.removeChild(this.container);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadButtonAction(submission: Submission) {
    G_state_manager.setType(submission, 'downloading', { width: 0, message: 'Starting download', is_stoppable: true });
    G_download_queue.addDownload(submission);
    G_tool_tip.fade();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DownloadingButton implements SubmissionAction {
    type: ButtonType = 'downloading';

    info: SubmissionInfo;
    parent: HTMLElement;
    options: ContainerOptions;

    button: HTMLButtonElement;
    container: HTMLElement;
    bar: HTMLElement;
    label: HTMLElement;

    constructor(info: SubmissionInfo, parent: HTMLElement, options: ContainerOptions) {
        this.info = info;
        this.parent = parent;
        this.options = options;
        const { container, shadow } = initalButtonContainer();

        const progress = document.createElement('div');
        progress.classList.add('progress');
        shadow.append(progress);

        const bar = document.createElement('div');
        bar.classList.add('progress-bar');
        progress.append(bar);

        const label = document.createElement('div');
        label.classList.add('progress-label');
        bar.append(label);

        const button = document.createElement('button');
        button.setAttribute('class', 'action-button icon-remove');
        button.classList.toggle('invisible', !parent.matches(':hover'));

        button.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                downloadingButtonAction(this.info.submission);
            },
            { once: true },
        );

        parent.addEventListener('mouseover', this.mouseoverEvent);
        parent.addEventListener('mouseout', this.mouseoutEvent);

        shadow.append(button);
        parent.append(container);

        this.bar = bar;
        this.label = label;
        this.button = button;
        this.container = container;
    }
    mouseoverEvent = () => {
        this.button.classList.remove('invisible');
    };
    mouseoutEvent = () => {
        this.button.classList.add('invisible');
    };
    update(state: Partial<DownloadingButtonState>) {
        if (state.message != null) {
            this.label.textContent = state.message;
        }
        if (state.width != null) {
            this.bar.style.width = `${state.width}%`;
        }
        if (state.is_stoppable != null) {
            this.button.classList.toggle('hide', !state.is_stoppable);
        }
    }
    remove() {
        this.parent.removeEventListener('mouseover', this.mouseoverEvent);
        this.parent.removeEventListener('mouseout', this.mouseoutEvent);

        this.container.parentElement?.removeChild(this.container);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadingButtonAction(submission: Submission) {
    G_state_manager.setType(submission, 'download');
    G_download_queue.removeDownload(submission);
    G_tool_tip.fade();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class ErrorButton implements SubmissionAction {
    type: ButtonType = 'error';
    info: SubmissionInfo;
    parent: HTMLElement;
    options: ContainerOptions;

    container: HTMLElement;
    message: string;

    constructor(info: SubmissionInfo, parent: HTMLElement, options: ContainerOptions) {
        this.info = info;
        this.parent = parent;
        this.options = options;
        this.message = '';
        const { container, shadow } = initalButtonContainer();

        const button = document.createElement('button');
        button.setAttribute('class', 'action-button icon-error');
        button.addEventListener('mouseover', () => {
            G_tool_tip.showError(button, this.message);
        });
        button.addEventListener('mouseout', () => {
            G_tool_tip.fade();
        });
        button.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                errorButtonAction(this.info.submission);
            },
            { once: true },
        );

        shadow.append(button);
        parent.append(container);

        this.container = container;
    }
    update(state: Partial<ErrorButtonState>) {
        if (state.message != null) {
            this.message = state.message;
        }
    }
    remove() {
        this.container.parentElement?.removeChild(this.container);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function errorButtonAction(submission: Submission) {
    G_state_manager.setType(submission, 'download');
    G_info_bar.removeError(submission);
    G_tool_tip.fade();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class WaitingButton implements SubmissionAction {
    type: ButtonType = 'waiting';
    info: SubmissionInfo;
    parent: HTMLElement;
    options: ContainerOptions;

    container: HTMLElement;

    constructor(info: SubmissionInfo, parent: HTMLElement, options: ContainerOptions) {
        this.info = info;
        this.parent = parent;
        this.options = options;

        const { container, shadow } = initalButtonContainer();

        const button = document.createElement('button');
        button.setAttribute('class', 'action-button icon-loading');
        button.toggleAttribute('disabled', true);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        shadow.append(button);
        parent.append(container);

        this.container = container;
    }
    remove() {
        this.container.parentElement?.removeChild(this.container);
    }
}

//---------------------------------------------------------------------------------------------------------------------
// downloading
//---------------------------------------------------------------------------------------------------------------------

class ProgressController {
    submission: Submission;
    constructor(submission: Submission) {
        this.submission = submission;
    }
    message(message: string) {
        G_state_manager.updateState(this.submission, 'downloading', { message });
    }
    width(percent: number) {
        G_state_manager.updateState(this.submission, 'downloading', { width: percent });
    }
    start(message: string) {
        this.width(0);
        this.message(message);
    }
    onOf(message: string, item: number, total: number) {
        const multiple = total > 1 ? ` ${item}/${total}` : '';
        this.message(`${message}${multiple}`);
    }
    blobMessage(index: number, total: number, bytes: number, loaded: number, blob_total: number) {
        const block = (1 / total) * 100;
        const inital_width = (index / total) * 100;
        const on_of = total > 1 ? `${index + 1}/${total} ` : '';
        const size = fileSize(bytes + loaded);
        if (!blob_total) {
            this.width(inital_width + block);
            this.message(`... ${on_of}${size}`);
        } else {
            const percent = inital_width + block * (loaded / blob_total);
            this.width(percent);
            this.message(`${on_of}${size} ${Math.floor(percent)}%`);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DownloadQueue {
    queue: Submission[] = [];
    downloading = 0;
    in_progress = 0;
    threads = 0;
    addDownload(submission: Submission) {
        this.queue.push(submission);
        this.downloading += 1;
        this.updateDownloadInfo();

        if (!G_options.useQueue || this.threads < G_options.queueConcurrent) {
            this.addThread();
        }
    }
    removeDownload(submission: Submission) {
        if (this.queue.includes(submission)) {
            this.downloading -= 1;
        }
        this.queue = this.queue.filter((s) => s !== submission);
        this.updateDownloadInfo();
    }
    async addThread() {
        this.threads += 1;
        while (this.queue.length > 0) {
            await this.downloadNext();
            if (G_options.queueWait > 0) {
                await timer(G_options.queueWait);
            }
        }
        this.threads -= 1;

        if (this.threads <= 0) {
            this.downloading = 0;
        }

        this.updateDownloadInfo();
    }
    async downloadNext() {
        this.in_progress += 1;
        const submission = this.queue.shift();
        if (submission) {
            G_state_manager.updateState(submission, 'downloading', { is_stoppable: false });
            this.updateDownloadInfo();
            let retries = 0;
            while (true) {
                const progress = new ProgressController(submission);
                try {
                    progress.message('Getting submission');
                    const result = await startDownloading(submission, progress);
                    if (result) {
                        G_info_bar.addSubmission(submission, result.files, result.user, result.title);
                    } else {
                        G_state_manager.setType(submission, 'download');
                    }
                    break;
                } catch (error) {
                    asLog('error', error);
                    if (retries < G_options.retryCount) {
                        retries += 1;
                        progress.start(`Retrying: ${retries}`);
                        await timer(G_options.queueWait);
                        continue;
                    }
                    G_state_manager.setType(submission, 'error', { message: `${error}` });
                    G_info_bar.addError(submission, `${error}`);
                    break;
                }
            }
        }

        this.in_progress -= 1;
        this.updateDownloadInfo();
    }
    updateDownloadInfo() {
        this.queue.forEach((submission, i) => {
            G_state_manager.updateState(submission, 'downloading', { message: `Queued: ${i + 1}` });
        });
        G_info_bar.setProgress(this.downloading, this.in_progress, this.queue.length);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createCustomElement(name: string, mode?: ShadowRootMode) {
    mode ??= 'closed';
    const container = document.createElement(`art-saver-${name}`);
    container.setAttribute('data-art-saver', name);
    const shadow = container.attachShadow({ mode });
    return { container, shadow };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function initalButtonContainer() {
    const custom = createCustomElement('submission');
    custom.container.style.display = 'contents';
    custom.shadow.append(G_ui_styles.common.cloneNode(true), G_ui_styles.submission.cloneNode(true));
    return custom;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class OkResponse {
    url: string;
    headers: Headers;
    body: Blob;
    constructor(url: string, headers: Headers, body: Blob) {
        this.url = url;
        this.headers = headers;
        this.body = body;
    }
    async text() {
        return await this.body.text();
    }
    async json() {
        const obj = JSON.parse(await this.text());
        if (typeof obj !== 'object' || !obj) {
            throw new Error('JSON data does not exist');
        }
        return obj;
    }
    async dom() {
        const parser = new DOMParser();
        return parser.parseFromString(await this.text(), 'text/html');
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class BackgroundPort {
    port: Browser.Runtime.Port;
    is_running = false;
    constructor() {
        this.port = browser.runtime.connect();
    }
    async send<T>(message: WorkMessage, progressfn?: (loaded: number, total: number) => void) {
        this.is_running = true;
        // bug the background script to prevent it from unloading
        (async () => {
            while (this.is_running) {
                this.port.postMessage({});
                await timer(10);
            }
        })();
        return await new Promise<T>((resolve, reject) => {
            this.port.onMessage.addListener((message) => {
                const m = message as WorkResponse<T>;
                switch (m.message) {
                    case 'progress':
                        progressfn?.(m.loaded, m.total);
                        break;

                    case 'result':
                        this.is_running = false;
                        resolve(m.result);
                        break;

                    case 'error':
                        reject(m.error);
                        break;
                }
            });
            this.port.onDisconnect.addListener((p) => {
                if (p.error) {
                    reject(p.error.message);
                }
            });
            this.port.postMessage(message);
        });
    }
    disconnect() {
        this.port.disconnect();
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class WorkFetch {
    port: BackgroundPort;
    constructor() {
        this.port = new BackgroundPort();
    }
    async fetchOk(url: RequestInfo, init?: RequestInit, progressfn?: (loaded: number, total: number) => void) {
        const result: WorkFetchResult = await this.port.send({ action: 'work_fetch', url, init }, progressfn);
        return new OkResponse(result.url, new Headers(result.headers), result.body);
    }
    async testOk(url: RequestInfo) {
        try {
            await this.fetchOk(url, { method: 'HEAD' });
            return true;
        } catch (error) {
            return false;
        }
    }
    disconnect() {
        this.port.disconnect();
    }
}

//---------------------------------------------------------------------------------------------------------------------
// info bar
//---------------------------------------------------------------------------------------------------------------------

class InfoBar {
    container: HTMLElement;
    stay_down = false;
    e: Record<string, HTMLElement | null>;
    constructor(root: HTMLElement, nodes: NodeListOf<ChildNode>) {
        const { container, shadow } = createCustomElement('info-bar');
        if (!G_options.infoBar) {
            container.style.display = 'none';
        }
        shadow.append(G_ui_styles.common.cloneNode(true), G_ui_styles.info_bar.cloneNode(true), ...nodes);
        shadow.querySelectorAll<HTMLElement>('#info-bar, #show-area').forEach((element) => {
            element.setAttribute('data-theme', G_options.theme);
            G_themed_elements.push(element);
        });

        this.e = {};
        for (const element of shadow.querySelectorAll<HTMLElement>('[id]')) {
            this.e[element.id.replaceAll('-', '_')] = element;
        }

        this.e.collapse?.addEventListener('click', () => {
            this.stay_down = true;
            this.hide();
        });
        this.e.show_area?.addEventListener('click', () => {
            this.stay_down = false;
            this.show();
        });

        this.e.submissions_stat?.addEventListener('click', () => {
            const toggled = this.e.submissions_stat?.toggleAttribute('data-open');
            this.e.submissions?.classList.toggle('hide', !toggled);
        });
        this.e.files_stat?.addEventListener('click', () => {
            const toggled = this.e.files_stat?.toggleAttribute('data-open');
            this.e.files?.classList.toggle('hide', !toggled);
        });
        this.e.errors_stat?.addEventListener('click', () => {
            const toggled = this.e.errors_stat?.toggleAttribute('data-open');
            this.e.errors?.classList.toggle('hide', !toggled);
        });

        this.e.folder_switch?.addEventListener('input', () => {
            const checked = (this.e.folder_switch as HTMLInputElement | null)?.checked;
            this.e.list_files?.classList.toggle('show-folders', checked);
        });

        this.e.errors_retry?.addEventListener('click', () => {
            for (const submission_manager of G_state_manager.submission_map.values()) {
                if (submission_manager.type === 'error') {
                    const submission = submission_manager.info.submission;
                    this.removeError(submission);
                    downloadButtonAction(submission);
                }
            }
        });

        root.append(container);
        this.container = container;
        // this.test();
    }
    show() {
        this.e.info_bar?.classList.add('show');
    }
    hide() {
        this.e.info_bar?.classList.remove('show');
    }
    toggle() {
        this.e.info_bar?.classList.toggle('show');
    }
    addSubmission(submission: Submission, files: { id: number; path: string }[], user: string, title?: string) {
        const row = tryCloneTemplate(this.e.submission_row_template);
        if (row) {
            let label = `${submission}`;
            if (files.length > 1) {
                label = `${label} (${files.length})`;
            }
            label = `${label} ${user}`;
            if (title) {
                label = `${label} : ${title}`;
            }
            row.querySelector('[data-label]')?.replaceChildren(label);
            row.querySelector('[data-link]')?.setAttribute('href', submissionLink(submission));
            this.e.list_submissions?.append(row);
        }
        this.e.stat_submissions?.replaceChildren(`${this.e.list_submissions?.childElementCount ?? 0}`);
        for (const file of files) {
            this.addFile(file.path, file.id);
        }
    }
    addFile(path: string, id: number) {
        const row = tryCloneTemplate(this.e.file_row_template);
        if (row) {
            const regex_result = /^(.*\/)?(.+)$/.exec(path);
            const folder = document.createElement('span');
            folder.classList.add('folder-path');
            folder.append(regex_result?.[1] ?? '');
            row.querySelector('[data-label]')?.replaceChildren(folder, regex_result?.[2] ?? '');
            row.querySelector('[data-show]')?.addEventListener('click', () => {
                browser.runtime.sendMessage({ action: 'background_show_download', id } as BackgroundMessage);
            });
            this.e.list_files?.append(row);
        }
        this.e.stat_files?.replaceChildren(`${this.e.list_files?.childElementCount ?? 0}`);
    }
    addError(submission: Submission, message: string) {
        this.e.errors_stat?.classList.remove('hide');
        const row = tryCloneTemplate(this.e.error_row_template);
        if (row) {
            row.firstElementChild?.setAttribute('data-submission-id', `${submission}`);
            row.querySelector('[data-message]')?.replaceChildren(message);
            row.querySelector('[data-label]')?.replaceChildren(`${submission}`);
            row.querySelector('[data-link]')?.setAttribute('href', submissionLink(submission));
            row.querySelector('[data-retry]')?.addEventListener('click', () => {
                this.removeError(submission);
                downloadButtonAction(submission);
            });
            this.e.list_errors?.append(row);
        }
        this.e.stat_errors?.replaceChildren(`${this.e.list_errors?.childElementCount ?? 0}`);
    }
    removeError(submission: Submission) {
        for (const error_row of this.e.list_errors?.querySelectorAll(`[data-submission-id="${submission}"]`) ?? []) {
            error_row.parentElement?.removeChild(error_row);
        }
        const total_errors = this.e.list_errors?.childElementCount ?? 0;
        if (total_errors === 0) {
            this.e.errors_stat?.classList.add('hide');
            this.e.errors_stat?.removeAttribute('data-open');
            this.e.errors?.classList.add('hide');
        }
        this.e.stat_errors?.replaceChildren(`${total_errors}`);
    }
    setProgress(downloading: number, in_progress: number, queued: number) {
        this.e.queue?.classList.toggle('hide', downloading === 0);
        if (downloading > 0) {
            if (!this.stay_down) {
                this.show();
            }
            const percent = ((downloading - (queued + in_progress)) / downloading) * 100;
            this.e.progress_bar?.style.setProperty('width', `${percent}%`);
            this.e.progress_label?.replaceChildren(`${Math.floor(percent)}%`);
        }

        this.e.stat_downloading?.replaceChildren(`${downloading}`);
        this.e.stat_progress?.replaceChildren(`${in_progress}`);
        this.e.stat_queued?.replaceChildren(`${queued}`);

        this.e.queued_stat?.classList.toggle('hide', queued === 0);
    }
    // test() {
    //     for (let i = 0; i < 20; i++) {
    //         const n = 12345 + i;
    //         this.addSubmission(
    //             n,
    //             [
    //                 {
    //                     path: `folder/${n}_title_1_by_user.ext`,
    //                     id: 1,
    //                 },
    //                 {
    //                     path: `folder/${n}_title_2_by_user.ext`,
    //                     id: 2,
    //                 },
    //             ],
    //             'user',
    //             'title of the submission',
    //         );
    //     }
    //     for (let i = 0; i < 20; i++) {
    //         const n = 12345 + i;
    //         const error = new Error('Files failed to download');
    //         this.addError(n, `${error}`);
    //     }
    //     this.setProgress(10, 2, 3);
    //     this.show();
    // }
}

function tryCloneTemplate(template: HTMLElement | null) {
    return (template as HTMLTemplateElement | null)?.content?.cloneNode(true) as DocumentFragment | undefined;
}

//---------------------------------------------------------------------------------------------------------------------
// check log cache: to avoid repeating the same console log when checking submissions
//---------------------------------------------------------------------------------------------------------------------

class CheckLogCache {
    cache = new Map<HTMLElement | string, string>();
    log(id: HTMLElement | string, message: string) {
        const cache_message = this.cache.get(id);
        if (cache_message !== message) {
            asLog('debug', id, message);
            this.cache.set(id, message);
        }
    }
}
