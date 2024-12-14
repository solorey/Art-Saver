"use strict";
let G_options;
let G_saved;
let G_styles;
let G_tool_tip;
let G_state_manager;
let G_download_queue;
let G_info_bar;
const G_themed_elements = [];
const G_ui = document.createElement('art-saver-ui');
const G_style = document.createElement('style');
const G_check_log = new CheckLogCache();
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function main() {
    G_options = await getOptionsStorage('global');
    G_saved = await getSavedStorage(G_site_info.site);
    G_ui.setAttribute('data-art-saver', 'ui');
    document.body.after(G_ui);
    G_style.setAttribute('data-art-saver', 'style');
    updateGlobalStyle();
    document.head.append(G_style);
    document.body.style.isolation = 'isolate';
    G_styles = await createUIStyles();
    G_tool_tip = new ToolTip(await getUI('tool_tip'));
    G_state_manager = new StateManager();
    G_download_queue = new DownloadQueue();
    if (G_options.infoBar) {
        G_info_bar = new InfoBar(await getUI('info_bar'));
    }
    document.addEventListener('keydown', onDocumentKeyEvent);
    asLog('info', `Checking ${G_site_info.label}`);
    await startChecking();
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function reloadCleanUp() {
    for (const frame of document.querySelectorAll('[data-art-saver="frame"]')) {
        frame.after(...frame.childNodes);
    }
    document.querySelectorAll('[data-art-saver]').forEach((e) => e.parentElement?.removeChild(e));
    document.removeEventListener('keydown', onDocumentKeyEvent);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(async function () {
    try {
        reloadCleanUp();
        // wake up background script ?
        browser.runtime.sendMessage({ action: '' });
        await main();
    }
    catch (error) {
        asLog('error', error);
    }
})();
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function userHomeLink(user) {
    return G_site_info.links.user(user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function userGalleryLink(user) {
    return G_site_info.links.gallery(user);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function submissionLink(submission) {
    return G_site_info.links.submission(submission);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function onDocumentKeyEvent(event) {
    const event_shortcut = getShortcutFromEvent(event);
    if (G_options.infoBar && shortcutsMatch(event_shortcut, G_options.shortcutInfoBar)) {
        G_info_bar?.toggle();
    }
    else if (shortcutsMatch(event_shortcut, G_options.shortcutDownloadAll)) {
        downloadAll();
    }
    else if (shortcutsMatch(event_shortcut, G_options.shortcutDownload)) {
        for (const [submission, submission_manager] of G_state_manager.submission_map) {
            const has_hovered = submission_manager.buttons.some((b) => b.parent.matches(':hover'));
            if (has_hovered && submission_manager.type === 'download') {
                downloadButtonAction(submission);
            }
        }
    }
    else if (shortcutsMatch(event_shortcut, G_options.shortcutForget)) {
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
function asLog(type, ...obj) {
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
    }
    else if (type === 'warn' && level >= 2) {
        console.warn(...message_items);
    }
    else if (type === 'info' && level >= 3) {
        console.info(...message_items);
    }
    else if (type === 'debug' && level >= 4) {
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
async function createUIStyleElement(ui) {
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
    const rules = await Promise.all(['shadow', 'colors', 'common'].map(async (sheet) => {
        const response = await fetchOk(browser.runtime.getURL(`/styles/${sheet}.css`));
        return await response.text();
    }));
    style.textContent = `${createIconsStyle()}${rules.join('')}`;
    return style;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function updateGlobalStyle() {
    const icons_size = `--as-icon-size: ${G_options.iconSize}px;`;
    const screen_display = `--as-screen-display: ${G_options.addScreen ? 'flex' : 'none'};`;
    const screen_opaticy = `--as-screen-opacity: ${G_options.screenOpacity}%;`;
    G_style.textContent = `:root {${icons_size} ${screen_display} ${screen_opaticy}}`;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createFlatIconVars(size, icons) {
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
function pathComponents(url) {
    return (url ? new URL(url) : window.location).pathname.split('/').slice(1);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function wrapElement(element) {
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
function navigateUpSmaller(element) {
    if (element.offsetParent === null) {
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
async function fetchOk(info, init) {
    const response = await fetch(info, init);
    if (!response.ok) {
        throw new Error(`Received ${response.status}: ${response.url}`);
    }
    return response;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function fetchWorkerOk(info, init) {
    const fetch_worker = new FetchWorker();
    const blob = await fetch_worker.fetchOk(info, init);
    fetch_worker.terminate();
    return blob;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function parseDOM(response) {
    const html = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function parseJSON(response) {
    const obj = await response.json();
    if (typeof obj !== 'object' || !obj) {
        throw new Error('JSON data does not exist');
    }
    return obj;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function checkUserForSubmission(user, submission) {
    if (G_saved[user]?.includes(submission)) {
        return user;
    }
    else {
        for (const [other_user, submissions] of Object.entries(G_saved)) {
            if (other_user !== user && submissions?.includes(submission)) {
                return other_user;
            }
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function hasButton(parent, submission) {
    const action_container = parent.querySelector('art-saver-submission');
    if (!action_container) {
        return;
    }
    // ensure container is last child
    const last_child = action_container.parentElement?.lastElementChild;
    if (last_child && action_container !== last_child) {
        last_child.after(action_container);
    }
    for (const group of G_state_manager.submission_map.values()) {
        for (const button of group.buttons) {
            if (button.container === action_container) {
                if (button.submission === submission) {
                    return button;
                }
                button.remove();
                group.cleanButtons();
                return;
            }
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function createButton(site, user, submission, parent, screen) {
    const existing_button = hasButton(parent, submission);
    if (existing_button) {
        return existing_button;
    }
    const saved_user = checkUserForSubmission(user, submission);
    const options = { screen };
    const type = saved_user ? 'check' : 'download';
    const state = {};
    if (saved_user) {
        state.saved_user = saved_user;
    }
    parent.style.position = 'relative';
    parent.style.isolation = 'isolate';
    return G_state_manager.addSubmissionButton(site, user, submission, type, parent, options, state);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function sendAddSubmission(site, user, submission) {
    return browser.runtime.sendMessage({
        action: 'background_add_submission',
        site,
        user,
        submission,
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function sendRemoveSubmission(site, submission) {
    return browser.runtime.sendMessage({
        action: 'background_remove_submission',
        site,
        submission,
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function updateButtons() {
    for (const [submission, submission_manager] of G_state_manager.submission_map) {
        const user = submission_manager.user;
        const saved_user = checkUserForSubmission(user, submission);
        const type = submission_manager.type;
        if (saved_user && type !== 'check') {
            G_state_manager.setType(submission, 'check', {
                saved_user,
            });
        }
        else if (!saved_user && ['waiting', 'check'].includes(type)) {
            G_state_manager.setType(submission, 'download');
        }
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
browser.storage.local.onChanged.addListener((changes) => {
    const saved_changed = changes[savedKey(G_site_info.site)];
    if (saved_changed) {
        G_saved = saved_changed.newValue ?? {};
        updateButtons();
    }
    const global_changed_values = changes[optionsKey('global')]?.newValue;
    if (global_changed_values) {
        G_options = global_changed_values;
        updateGlobalStyle();
        for (const element of G_themed_elements) {
            element?.setAttribute('data-theme', global_changed_values.theme);
        }
    }
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getUI(ui) {
    const ui_url = browser.runtime.getURL(`/content/ui/${ui}.html`);
    const response = await fetchOk(ui_url);
    const dom = await parseDOM(response);
    return dom.body.childNodes;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function fileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    while (bytes > 1024 && index < units.length - 1) {
        bytes /= 1024;
        index += 1;
    }
    return `${bytes.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function pollElement(parent, selectors) {
    let element = parent.querySelector(selectors);
    while (!element) {
        await timer(0.2);
        element = parent.querySelector(selectors);
    }
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function timer(seconds) {
    return await new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function timeParse(value) {
    const time = new Date(value);
    const pad = (n) => `${n}`.padStart(2, '0');
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
function enumerate(array) {
    return array.map((e, i) => [i, e]);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function sendDownloadBlob(blob, path) {
    return await browser.runtime.sendMessage({
        action: 'background_download_blob',
        blob,
        path,
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function handleDownloads(downloads, init, progress) {
    progress?.start('Starting download');
    let bytes = 0;
    const total = downloads.length;
    const results = [];
    const fetch_worker = new FetchWorker();
    for (const [i, info] of enumerate(downloads)) {
        const download = info.download;
        let blob;
        if (typeof download === 'string') {
            blob = await fetch_worker.fetchOk(download, init, (loaded, blob_total) => {
                progress?.blobProgress(i, total, bytes, loaded, blob_total);
            });
        }
        else {
            blob = download;
            progress?.blobProgress(i, total, bytes, blob.size, blob.size);
        }
        bytes += blob.size;
        const result = await sendDownloadBlob(blob, info.path);
        results.push(result);
    }
    fetch_worker.terminate();
    return results;
}
//---------------------------------------------------------------------------------------------------------------------
// filename creation
//---------------------------------------------------------------------------------------------------------------------
// replace illegal filename characters
function sanitize(text) {
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
function renderTemplate(template, type, ...metas) {
    const mods = [
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
            re: /[+\-]\d+/,
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
                if (direction === '<') {
                    return value.padStart(length, fill);
                }
                else if (direction === '>') {
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
    ];
    const mod_regex = new RegExp(`!(${mods.map((mod) => mod.re.source).join('|')})`, 'g');
    let text = template.replace(/{([a-zA-Z]+)(\^)?(?:!.+?)?}/g, (match, p1, p2) => {
        const meta_value = p2 ? metas[1][p1] : metas[0][p1];
        if (typeof meta_value === 'undefined') {
            return match;
        }
        let value = meta_value;
        if (type === 'path') {
            value = sanitize(value);
            if (G_options.replace) {
                value = value.replace(/\s/g, '_');
            }
        }
        for (const result of match.matchAll(mod_regex)) {
            for (const { re, fn } of mods) {
                const re_result = re.exec(result[1]);
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
function renderPath(template, ...metas) {
    return renderTemplate(template, 'path', ...metas);
}
//---------------------------------------------------------------------------------------------------------------------
// message listener functions
//---------------------------------------------------------------------------------------------------------------------
browser.runtime.onMessage.addListener((message) => {
    return mainMessageActions(message);
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function mainMessageActions(message) {
    switch (message.action) {
        case 'main_page_info':
            return getPageData();
        case 'main_user_info':
            return getUserInfo(message.user);
        case 'main_download_all':
            downloadAll();
            break;
        case 'main_refresh':
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
function documentPositionComparator(a, b) {
    if (a === b) {
        return 0;
    }
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
        return -1;
    }
    else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
        return 1;
    }
    return 0;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function downloadAll() {
    G_state_manager.cleanSubmissions();
    // download in document listed order
    const download_list = [];
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
        .forEach(({ submission }) => downloadButtonAction(submission));
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
    const stats = {
        checks: 0,
        downloads: 0,
    };
    G_state_manager.cleanSubmissions();
    for (const submission_manager of G_state_manager.submission_map.values()) {
        if (submission_manager.type === 'check') {
            stats.checks += 1;
        }
        else if (submission_manager.type === 'download') {
            stats.downloads += 1;
        }
    }
    return stats;
}
