let G_options: GlobalOptionsValues;
let G_ui_styles: Awaited<ReturnType<typeof createUIStyles>>;
let G_tool_tip: ToolTip;
let G_info_bar: InfoBar;
const G_state_manager = new StateManager();
const G_download_queue = new DownloadQueue();
const G_themed_elements: (HTMLElement | null)[] = [];
const G_head_style = document.createElement('style');
const G_check_log = new CheckLogCache();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function main() {
    let tool_tip_nodes: NodeListOf<ChildNode>;
    let info_bar_nodes: NodeListOf<ChildNode>;
    [G_options, G_ui_styles, tool_tip_nodes, info_bar_nodes] = await Promise.all([
        getOptionsStorage<GlobalOptionsValues>('global'),
        createUIStyles(),
        getUI('tool_tip'),
        getUI('info_bar'),
    ]);

    G_head_style.setAttribute('data-art-saver', 'style');
    updateGlobalStyle();
    document.head.append(G_head_style);

    const ui_root = document.createElement('art-saver-ui');
    ui_root.setAttribute('data-art-saver', 'ui');
    document.body.style.isolation = 'isolate';
    document.body.after(ui_root);

    G_tool_tip = new ToolTip(ui_root, tool_tip_nodes);
    G_info_bar = new InfoBar(ui_root, info_bar_nodes);

    document.addEventListener('keydown', onDocumentKeyEvent);

    asLog('info', `Checking ${G_site_info.label}`);
    startChecking();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function reloadCleanUp() {
    for (const frame of document.querySelectorAll('[data-art-saver="frame"]')) {
        frame.after(...frame.childNodes);
    }
    for (const old_elem of document.querySelectorAll<HTMLElement>('[data-art-saver]')) {
        old_elem.parentElement?.removeChild(old_elem);
    }
    document.removeEventListener('keydown', onDocumentKeyEvent);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

(async () => {
    while (true) {
        try {
            // G_site_info is defined in site script
            // site script should load before main script but not always
            G_site_info;
            break;
        } catch (e) {
            await timer(0.1);
        }
    }

    try {
        reloadCleanUp();
        if (!(await getOptionsStorage(G_site_info.site)).enabled) {
            return;
        }
        // wake up background script ?
        browser.runtime.sendMessage({ action: '' });
        await main();
    } catch (error) {
        asLog('error', error);
    }
})();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userHomeLink(user: User) {
    return G_site_info.links.user(user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userGalleryLink(user: User) {
    return G_site_info.links.gallery(user);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function submissionLink(submission: Submission) {
    return G_site_info.links.submission(submission);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function onDocumentKeyEvent(event: KeyboardEvent) {
    const event_shortcut = getShortcutFromEvent(event);
    if (G_options.infoBar && shortcutsMatch(event_shortcut, G_options.shortcutInfoBar)) {
        G_info_bar.toggle();
    } else if (shortcutsMatch(event_shortcut, G_options.shortcutDownloadAll)) {
        downloadAll();
    } else if (shortcutsMatch(event_shortcut, G_options.shortcutDownload)) {
        for (const [submission, submission_manager] of G_state_manager.submission_map) {
            const has_hovered = submission_manager.buttons.some((b) => b.parent.matches(':hover'));
            if (has_hovered && submission_manager.type === 'download') {
                downloadButtonAction(submission);
            }
        }
    } else if (shortcutsMatch(event_shortcut, G_options.shortcutForget)) {
        for (const [submission, submission_manager] of G_state_manager.submission_map) {
            const has_hovered = submission_manager.buttons.some((b) => b.parent.matches(':hover'));
            if (has_hovered) {
                switch (submission_manager.type) {
                    case 'check':
                        checkButtonAction(submission);
                        break;
                    case 'downloading':
                        downloadingButtonAction(submission);
                        break;
                    case 'error':
                        errorButtonAction(submission);
                        break;
                }
            }
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function asLog(type: LogType, ...obj: any[]) {
    const level = Number(G_options.logLevel);
    if (level === 0) {
        return;
    }
    let message_items = ['%c[Art Saver]%c', '', ''];
    if (typeof obj[0] === 'string') {
        message_items[0] += ` ${obj.shift()}`;
    }
    message_items = message_items.concat(obj);

    if (type === 'error' && level >= 1) {
        console.error(...message_items);
    } else if (type === 'warn' && level >= 2) {
        console.warn(...message_items);
    } else if (type === 'info' && level >= 3) {
        console.info(...message_items);
    } else if (type === 'debug' && level >= 4) {
        console.debug(...message_items);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createUIStyles() {
    const css = ['submission', 'tool_tip', 'info_bar'];
    const styles = await Promise.all(css.map((s) => createUIStyleElement(s)));
    return {
        submission: styles[0],
        tool_tip: styles[1],
        info_bar: styles[2],
        common: await createCommonStyleElement(),
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createUIStyleElement(ui: string) {
    const response = await fetchOk(browser.runtime.getURL(`/content/styles/${ui}.css`));
    const style = document.createElement('style');
    style.setAttribute('data-sheet', ui);
    style.textContent = await response.text();
    return style;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createCommonStyleElement() {
    const style = document.createElement('style');
    style.setAttribute('data-sheet', 'common');
    const rules = await Promise.all(
        ['shadow', 'colors', 'common'].map(async (sheet) => {
            const response = await fetchOk(browser.runtime.getURL(`/styles/${sheet}.css`));
            return await response.text();
        }),
    );
    style.textContent = `${createIconsStyle()}${rules.join('')}`;
    return style;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function updateGlobalStyle() {
    const icons_size = `--as-icon-size: ${G_options.iconSize}px;`;
    const screen_display = `--as-screen-display: ${G_options.addScreen ? 'flex' : 'none'};`;
    const screen_opacity = `--as-screen-opacity: ${G_options.screenOpacity}%;`;

    G_head_style.textContent = `:root {${icons_size} ${screen_display} ${screen_opacity}}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createFlatIconVars(size: number, icons: string[]) {
    const source = browser.runtime.getURL(`icons/flat/flat_${size}.svg`);
    return icons.map((icon, i) => `--icon-${size}-${icon}: url("${source}#icon${i + 1}");`).join('');
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createIconsStyle() {
    const icons = ['check_green', 'check_yellow', 'download', 'error', 'loading', 'remove']
        .map((icon) => `--icon-${icon}: url("${browser.runtime.getURL(`icons/${icon}.svg`)}");`)
        .join('');

    const flat_16 = createFlatIconVars(16, [
        'addon',
        'stats',
        'user',
        'gear',
        'check',
        'collapse',
        'descend',
        'ascend',
        'match_case',
        'match_whole',
        'regex',
    ]);
    const flat_12 = createFlatIconVars(12, [
        'file',
        'folder',
        'copy',
        'download',
        'upload',
        'link',
        'reset',
        'user',
        'home',
        'gallery',
        'image',
        'star',
        'x',
        'selection',
    ]);
    return `:host {${icons} ${flat_16} ${flat_12}}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function pathComponents(url: string) {
    return new URL(url).pathname.split('/').slice(1);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function wrapElement(element: HTMLElement) {
    const parent = element.parentElement;
    if (parent && parent.getAttribute('data-art-saver') === 'frame') {
        return parent;
    }
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-art-saver', 'frame');
    wrapper.style.margin = 'auto';
    wrapper.style.width = 'fit-content';
    element.after(wrapper);
    wrapper.append(element);
    return wrapper;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function navigateUpSmaller(element: HTMLElement) {
    if (!element.offsetParent) {
        return element;
    }
    let current = element;

    while (true) {
        const parent = current.parentElement;
        if (!parent) {
            return current;
        }
        const current_rect = current.getBoundingClientRect();
        if (current_rect.width === 0 || current_rect.height === 0) {
            current = parent;
            continue;
        }
        const parent_rect = parent.getBoundingClientRect();
        if (parent_rect.width === 0 || parent_rect.height === 0) {
            current = parent;
            continue;
        }
        if (parent_rect.width > current_rect.width || parent_rect.height > current_rect.height) {
            return current;
        }
        current = parent;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fetchOk(info: RequestInfo, init?: RequestInit) {
    const response = await fetch(info, init);
    if (!response.ok) {
        throw new Error(`Received ${response.status}: ${response.url}`);
    }
    return new OkResponse(response.url, response.headers, await response.blob());
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function fetchWorkerOk(info: RequestInfo, init?: RequestInit) {
    const fetch_worker = new FetchWorker();
    const response = await fetch_worker.fetchOk(info, init);
    fetch_worker.terminate();
    return response;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function checkUserForSubmission(info: SubmissionInfo) {
    const found: Awaited<ReturnType<typeof findSubmission>> = await browser.runtime.sendMessage({
        action: 'background_find_submission',
        info,
    } as BackgroundMessage);
    return found?.user;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function hasButton(parent: HTMLElement, submission: Submission) {
    const action_container = parent.querySelector<HTMLElement>('art-saver-submission');
    if (!action_container) {
        return false;
    }
    // ensure container is last child
    const last_child = action_container.parentElement?.lastElementChild;
    if (last_child && action_container !== last_child) {
        last_child.after(action_container);
    }
    for (const group of G_state_manager.submission_map.values()) {
        for (const button of group.buttons) {
            if (button.container === action_container) {
                if (button.info.submission === submission) {
                    return true;
                }
                button.remove();
                group.cleanButtons();
                return false;
            }
        }
    }
    return false;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function createButton(info: SubmissionInfo, parent: HTMLElement, options?: ContainerOptions) {
    if (hasButton(parent, info.submission)) {
        return;
    }
    parent.style.position = 'relative';
    parent.style.isolation = 'isolate';
    options ??= { screen: true };
    const saved_user = await checkUserForSubmission(info);
    if (saved_user) {
        G_state_manager.addSubmissionButton(info, 'check', parent, options, { saved_user });
    } else {
        G_state_manager.addSubmissionButton(info, 'download', parent, options);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function recheckSubmission(submission_manager: SubmissionManager) {
    const submission = submission_manager.info.submission;
    const saved_user = await checkUserForSubmission(submission_manager.info);
    const type = submission_manager.type;
    if (saved_user && type !== 'check') {
        G_state_manager.setType(submission, 'check', {
            saved_user,
        });
        if (type === 'error') {
            G_info_bar.removeError(submission);
        }
    } else if (!saved_user && ['waiting', 'check'].includes(type)) {
        G_state_manager.setType(submission, 'download');
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function updateButtons() {
    for (const submission_manager of G_state_manager.submission_map.values()) {
        recheckSubmission(submission_manager);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

browser.storage.local.onChanged.addListener((changes) => {
    const global_changed_values = changes[optionsKey('global')]?.newValue as GlobalOptionsValues | undefined;
    if (global_changed_values) {
        G_options = global_changed_values;
        updateGlobalStyle();
        for (const element of G_themed_elements) {
            element?.setAttribute('data-theme', G_options.theme);
        }
        G_info_bar.container.style.display = G_options.infoBar ? '' : 'none';
    }
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUI(ui: string) {
    const ui_url = browser.runtime.getURL(`/content/ui/${ui}.html`);
    const response = await fetchOk(ui_url);
    const dom = await response.dom();
    return dom.body.childNodes;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function fileSize(bytes: number) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    while (bytes > 1024 && index < units.length - 1) {
        bytes /= 1024;
        index += 1;
    }
    return `${bytes.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function pollElement<K extends keyof HTMLElementTagNameMap>(
    parent: ParentNode,
    selectors: K,
): Promise<HTMLElementTagNameMap[K]>;
async function pollElement<E extends Element = Element>(parent: ParentNode, selectors: string): Promise<E>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function pollElement<E extends Element = Element>(parent: ParentNode, selectors: string): Promise<E> {
    let element = parent.querySelector<E>(selectors);
    while (!element) {
        await timer(0.2);
        element = parent.querySelector(selectors);
    }
    return element;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function observeThrottle(callbackfn: () => Promise<void>, wait_time?: number) {
    const throttler = new FunctionThrottler(callbackfn, wait_time);

    const observer = new MutationObserver(() => {
        throttler.run();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    throttler.run();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function timer(seconds: number) {
    if (seconds <= 0) {
        return;
    }
    return await new Promise<void>((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function timeParse(value: string | number | Date) {
    const time = new Date(value);
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return {
        YYYY: pad(time.getUTCFullYear()),
        MM: pad(time.getUTCMonth() + 1),
        DD: pad(time.getUTCDate()),
        hh: pad(time.getUTCHours()),
        mm: pad(time.getUTCMinutes()),
        ss: pad(time.getUTCSeconds()),
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function enumerate<T>(array: Array<T>) {
    return array.map<[number, T]>((e, i) => [i, e]);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function downloadSubmission(
    info: SubmissionInfo,
    downloads: DownloadInfo[],
    init?: RequestInit,
    progress?: ProgressController,
    title?: string,
) {
    const download_ids = await handleDownloads(downloads, init, progress);

    const files = [];
    for (const [i, id] of enumerate(download_ids)) {
        if (id != null) {
            files.push({ path: downloads[i].path, id });
        }
    }
    if (files.length === 0) {
        return;
    }

    progress?.message('Updating');
    await browser.runtime.sendMessage({
        action: 'background_add_submission',
        info,
    } as BackgroundMessage);

    const result: DownloadReturn = {
        user: info.user,
        title,
        files,
    };
    return result;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function handleDownloads(downloads: DownloadInfo[], init?: RequestInit, progress?: ProgressController) {
    progress?.start('Starting download');

    let bytes = 0;
    const total = downloads.length;
    const download_ids = [];

    const fetch_worker = new FetchWorker();
    for (const [i, info] of enumerate(downloads)) {
        const download = info.download;
        let blob: Blob;
        if (typeof download === 'string') {
            const response = await fetch_worker.fetchOk(download, init, (loaded, blob_total) => {
                progress?.blobMessage(i, total, bytes, loaded, blob_total);
            });
            blob = response.body;
        } else {
            blob = download;
            progress?.blobMessage(i, total, bytes, blob.size, blob.size);
        }
        bytes += blob.size;

        const download_id: Awaited<ReturnType<typeof downloadBlob>> = await browser.runtime.sendMessage({
            action: 'background_download_blob',
            blob,
            path: info.path,
        } as BackgroundMessage);
        download_ids.push(download_id);
    }
    fetch_worker.terminate();

    return download_ids;
}

//---------------------------------------------------------------------------------------------------------------------
// filename creation
//---------------------------------------------------------------------------------------------------------------------

// replace illegal filename characters
function sanitizePathComponent(text: string) {
    return text
        .replaceAll('\\', '＼') // \uff3c
        .replaceAll('/', '／') // \uff0f
        .replaceAll(':', '：') // \uff1a
        .replaceAll('*', '＊') // \uff0a
        .replaceAll('?', '？') // \uff1f
        .replaceAll('"', '″') // \u2033
        .replaceAll('<', '＜') // \uff1c
        .replaceAll('>', '＞') // \uff1e
        .replaceAll('|', '｜') // \uff5c
        .replace(/[\u200e\u200f\u202a-\u202e]/g, ''); // remove bidirectional formatting characters.
    // not illegal in windows but firefox errors when trying to download a filename with them.
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function renderTemplate(template: string, type: string, ...metas: MetaRecord[]) {
    type MetaMod = {
        re: RegExp;
        fn: (value: string, re: RegExpExecArray) => string;
    };
    const mods: MetaMod[] = [
        // upper
        {
            re: /u/,
            fn: (value, re) => {
                return value.toUpperCase();
            },
        },
        // lower
        {
            re: /l/,
            fn: (value, re) => {
                return value.toLowerCase();
            },
        },
        // add
        {
            re: /[+-]\d+/,
            fn: (value, re) => {
                return `${BigInt(value) + BigInt(re[0])}`;
            },
        },
        // base
        {
            re: /b(\d\d?)/,
            fn: (value, re) => {
                const radix = Number(re[1]);
                if (radix >= 2 && radix <= 36) {
                    return BigInt(value).toString(radix);
                }
                return value;
            },
        },
        // pad
        {
            re: /(.?)([<>])(\d+)/,
            fn: (value, re) => {
                const fill = re[1] || ' ';
                const direction = re[2];
                const length = Number(re[3]);
                if (direction === '>') {
                    return value.padStart(length, fill);
                } else if (direction === '<') {
                    return value.padEnd(length, fill);
                }
                return value;
            },
        },
        // slice
        {
            re: /\[(-?\d+)?:(-?\d+)?\]/,
            fn: (value, re) => {
                const start = re[1] ? Number(re[1]) : undefined;
                const end = re[2] ? Number(re[2]) : undefined;
                return value.slice(start, end);
            },
        },
        // substitute
        {
            re: /s\/((?:\\\/|[^/])*)\/((?:\\\/|[^/])*)\/([gimsuv]*)/,
            fn: (value, re) => {
                // unescape forward slashes
                const search = re[1].replaceAll('\\/', '/');
                const replacement = re[2].replaceAll('\\/', '/');
                const flags = re[3];
                try {
                    return value.replace(new RegExp(search, flags), replacement);
                } catch (error) {
                    asLog('error', `Invalid RegExp in substitute modifier: ${re[0]}`);
                    return value;
                }
            },
        },
    ];

    const mod_regex = new RegExp(`!(${mods.map((mod) => mod.re.source).join('|')})`, 'g');

    let text = template.replace(/{([a-zA-Z]+)(\^)?(?:!.+?)?}/g, (match: string, p1: string, p2: string) => {
        const meta_value = p2 ? metas[1][p1] : metas[0][p1];
        if (meta_value == null) {
            return match;
        }
        let value = meta_value;
        if (type === 'path') {
            value = sanitizePathComponent(value);
            if (G_options.replace) {
                value = value.replace(/\s/g, '_');
            }
        }

        for (const result of match.matchAll(mod_regex)) {
            for (const { re, fn } of mods) {
                const re_result = new RegExp(`^${re.source}$`).exec(result[1]);
                if (re_result) {
                    value = fn(value, re_result);
                    break;
                }
            }
        }
        return value;
    });
    if (type === 'path') {
        text = text
            .split('/')
            .map((p) => p.trim())
            .join('/')
            .replace(/\s+/g, ' ')
            .replaceAll('./', '．/'); // \uff0e
    }
    return text;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function renderPath(template: string, ...metas: MetaRecord[]) {
    return renderTemplate(template, 'path', ...metas);
}

//---------------------------------------------------------------------------------------------------------------------
// message listener functions
//---------------------------------------------------------------------------------------------------------------------

browser.runtime.onMessage.addListener((message: any) => {
    return contentMessageActions(message);
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function contentMessageActions(message: ContentMessage) {
    switch (message.action) {
        case 'content_db_update':
            if (message.site === G_site_info.site) {
                updateButtons();
            }
            break;

        case 'content_page_info':
            return getPageData();

        case 'content_user_info':
            return getUserInfo(message.user);

        case 'content_download_all':
            downloadAll();
            break;

        case 'content_refresh':
            refreshButtons();
            break;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getPageData() {
    return {
        info: await getPageInfo(),
        stats: getPageStats(),
    };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function documentPositionComparator(a: HTMLElement, b: HTMLElement) {
    if (a === b) {
        return 0;
    }

    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
        return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
        return 1;
    }
    return 0;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadAll() {
    G_state_manager.cleanSubmissions();
    // download in document listed order
    const download_list: { submission: Submission; element: HTMLElement }[] = [];
    for (const [submission, submission_manager] of G_state_manager.submission_map) {
        if (submission_manager.type !== 'download') {
            continue;
        }
        submission_manager.buttons.sort((a, b) => documentPositionComparator(a.parent, b.parent));
        const element = submission_manager.buttons.at(0)?.parent;
        if (element) {
            download_list.push({ submission, element });
        }
    }
    download_list
        .sort((a, b) => documentPositionComparator(a.element, b.element))
        .forEach(({ submission }) => {
            downloadButtonAction(submission);
        });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function refreshButtons() {
    G_state_manager.cleanSubmissions();
    for (const [submission, submission_manager] of G_state_manager.submission_map) {
        if (submission_manager.type === 'error') {
            errorButtonAction(submission);
        }
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getPageStats() {
    const stats: PageStats = {
        checks: 0,
        downloads: 0,
    };
    G_state_manager.cleanSubmissions();
    for (const submission_manager of G_state_manager.submission_map.values()) {
        if (submission_manager.type === 'check') {
            stats.checks += 1;
        } else if (submission_manager.type === 'download') {
            stats.downloads += 1;
        }
    }

    return stats;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function urlToDataUrl(url: string) {
    const response = await fetchWorkerOk(url);
    return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', (data) => {
            resolve(data.target?.result as string);
        });
        reader.readAsDataURL(response.body);
    });
}
