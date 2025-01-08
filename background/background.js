"use strict";
//---------------------------------------------------------------------------------------------------------------------
// database functions
//---------------------------------------------------------------------------------------------------------------------
let G_db;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function initializeDB() {
    const request = indexedDB.open('MainDB');
    return new Promise((resolve, reject) => {
        request.onerror = () => {
            reject('IndexedDB could not be initialized');
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore('submissions', { keyPath: ['site', 'user', 'submission'] });
            store.createIndex('site', 'site', { unique: false });
            store.createIndex('user', 'user', { unique: false });
            store.createIndex('submission', 'submission', { unique: false });
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// reconnect when the background script closes
async function getOrReconnectDB() {
    if (!G_db) {
        G_db = await initializeDB();
    }
    return G_db;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function findSubmission(info) {
    const request = (await getOrReconnectDB())
        .transaction('submissions', 'readonly')
        .objectStore('submissions')
        .index('submission')
        .getAll(info.submission);
    return await new Promise((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const submissions = request.result;
            const same_site = submissions.filter((item) => item.site === info.site);
            resolve(same_site.find((item) => item.user === info.user) ?? same_site.shift());
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function addSubmission(info) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            sendDBUpdate(info.site);
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not add to IndexedDB');
        };
        transaction.objectStore('submissions').add(info);
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function removeSubmission(site, submission) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            sendDBUpdate(site);
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not remove from IndexedDB');
        };
        const request = transaction.objectStore('submissions').index('submission').openCursor(submission);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (cursor.value.site === site) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function removeUser(site, user) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            sendDBUpdate(site);
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not remove from IndexedDB');
        };
        const request = transaction.objectStore('submissions').index('user').openCursor(user);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (cursor.value.site === site) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getDBSiteValues(site) {
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    const request = store.index('site').getAll(site);
    return await new Promise((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const values = request.result;
            const users = new Set();
            const submissions = new Set();
            for (const submission of values) {
                users.add(submission.user);
                submissions.add(submission.submission);
            }
            resolve({ users: [...users], submissions: [...submissions] });
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getDBUserValues(site, user) {
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    const request = store.index('user').getAll(user);
    return await new Promise((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const values = request.result;
            const submissions = new Set();
            for (const submission of values) {
                if (submission.site === site) {
                    submissions.add(submission.submission);
                }
            }
            resolve({ submissions: [...submissions] });
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getDBAsJSON(site) {
    const saved_json = {};
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    let request;
    if (site) {
        request = store.index('site').getAll(site);
    }
    else {
        request = store.getAll();
    }
    return await new Promise((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const submissions = request.result;
            for (const info of submissions) {
                const site = saved_json[info.site] ?? {};
                const user = site[info.user] ?? [];
                user.push(info.submission);
                site[info.user] = user;
                saved_json[info.site] = site;
            }
            resolve(saved_json);
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setDBFromJSON(saved_json) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            for (const site of SITES) {
                sendDBUpdate(site);
            }
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not set IndexedDB');
        };
        const store = transaction.objectStore('submissions');
        const request = store.clear();
        request.onsuccess = () => {
            for (const [site, info] of Object.entries(saved_json)) {
                for (const [user, submissions] of Object.entries(info)) {
                    if (submissions) {
                        for (const submission of submissions) {
                            store.add({ site, user, submission }).onerror = (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            };
                        }
                    }
                }
            }
        };
    });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function addDBFromJSON(saved_json) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            for (const site of SITES) {
                if (site in saved_json) {
                    sendDBUpdate(site);
                }
            }
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not add to IndexedDB');
        };
        const store = transaction.objectStore('submissions');
        for (const [site, info] of Object.entries(saved_json)) {
            for (const [user, submissions] of Object.entries(info)) {
                if (submissions) {
                    for (const submission of submissions) {
                        store.add({ site, user, submission }).onerror = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        };
                    }
                }
            }
        }
    });
}
//---------------------------------------------------------------------------------------------------------------------
// startup functions
//---------------------------------------------------------------------------------------------------------------------
browser.runtime.onInstalled.addListener((details) => {
    initialBackgroundSetup(details);
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function initialBackgroundSetup(details) {
    await Promise.all([setupStates(), setupOptionsStorage(), initializeDB()]);
    if (details.previousVersion && Number(details.previousVersion.split('.')[0]) < 2) {
        await upgradeToVersion2();
    }
    // convert old storage to IndexedDB
    const old_saved_storage = await getSavedStorage(SITES);
    if (Object.keys(old_saved_storage).length > 0) {
        await addDBFromJSON(old_saved_storage);
        console.log('Old storage converted to IndexedDB');
        // just in case
        browser.storage.local.set({ old_saved: old_saved_storage });
        removeSavedStorage(SITES);
    }
    if (details.reason === 'install') {
        browser.runtime.openOptionsPage();
    }
}
//---------------------------------------------------------------------------------------------------------------------
// options functions
//---------------------------------------------------------------------------------------------------------------------
async function upgradeToVersion2() {
    // upgrade storage to lowercase user ids
    const current_info = await getSavedStorage(SITES);
    const new_info = {};
    for (const [site, info] of Object.entries(current_info)) {
        const users = {};
        for (const [user, submissions] of Object.entries(info)) {
            if (submissions && submissions.length > 0) {
                users[user.toLowerCase()] = submissions;
            }
        }
        if (Object.keys(users).length > 0) {
            new_info[site] = users;
        }
    }
    await setSavedStorage(new_info);
    // upgrade metas to new syntax
    const stored_options = await getOptionsStorage(SITES);
    const deviantart_keys = [
        'userFolder',
        'file',
        'literatureHTML',
        'literatureText',
        'stashFile',
        'stashLiteratureHTML',
        'stashLiteratureText',
    ];
    const stash_keys = ['stashFile', 'stashLiteratureHTML', 'stashLiteratureText'];
    const deviantart = stored_options.deviantart;
    if (deviantart) {
        for (const key of deviantart_keys) {
            deviantart[key] = `${deviantart[key] ?? ''}`.replaceAll('{submissionId36}', '{submissionId!b36}');
        }
        for (const key of stash_keys) {
            deviantart[key] = `${deviantart[key] ?? ''}`
                .replaceAll('{submissionId!b36}', '{submissionId^!b36}')
                .replaceAll('{urlId}', '{urlId^}')
                .replaceAll('{stashUrlId}', '{urlId}')
                .replaceAll('{userName}', '{userName^}')
                .replaceAll('{stashUserName}', '{userName}')
                .replaceAll('{title}', '{title^}')
                .replaceAll('{stashTitle}', '{title}')
                .replaceAll('{submissionId}', '{submissionId^}')
                .replaceAll('{stashSubmissionId}', '{submissionId}')
                .replaceAll('{fileName}', '{fileName^}')
                .replaceAll('{stashFileName}', '{fileName}')
                .replaceAll('{ext}', '{ext^}')
                .replaceAll('{stashExt}', '{ext}')
                .replaceAll('{YYYY}', '{YYYY^}')
                .replaceAll('{stashYYYY}', '{YYYY}')
                .replaceAll('{MM}', '{MM^}')
                .replaceAll('{stashMM}', '{MM}')
                .replaceAll('{DD}', '{DD^}')
                .replaceAll('{stashDD}', '{DD}')
                .replaceAll('{hh}', '{hh^}')
                .replaceAll('{stashhh}', '{hh}')
                .replaceAll('{mm}', '{mm^}')
                .replaceAll('{stashmm}', '{mm}')
                .replaceAll('{ss}', '{ss^}')
                .replaceAll('{stashss}', '{ss}')
                .replaceAll('{url}', '{url^}')
                .replaceAll('{stashUrl}', '{url}')
                .replaceAll('{stashDescription}', '{description}');
        }
    }
    const furaffinity_keys = ['userFolder', 'file'];
    const furaffinity = stored_options.furaffinity;
    if (furaffinity) {
        for (const key of furaffinity_keys) {
            furaffinity[key] = `${furaffinity[key] ?? ''}`.replaceAll('{userLower}', '{userId}');
        }
    }
    await setOptionsStorage(stored_options);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setupOptionsStorage() {
    const stored_options = await getOptionsStorage(SITES_AND_GLOBAL);
    const inital_options = {};
    for (const site of SITES_AND_GLOBAL) {
        if (!stored_options[site]) {
            console.log('New site', site);
        }
        const options = {};
        for (const [key, option] of Object.entries(SITES_AND_GLOBAL_FORMS[site])) {
            let value = stored_options[site]?.[key];
            if (typeof value === 'undefined') {
                console.log(`New option ${site}.${key}`);
                value = option.default;
            }
            options[key] = value;
        }
        inital_options[site] = options;
    }
    await setOptionsStorage(inital_options);
}
//---------------------------------------------------------------------------------------------------------------------
// state functions
//---------------------------------------------------------------------------------------------------------------------
async function setupStates() {
    const stored_states = await getUIStorage(UIS);
    const inital_states = {};
    for (const ui of UIS) {
        const state = {};
        for (const [key, value] of Object.entries(UIS_STATES[ui])) {
            state[key] = stored_states[ui]?.[key] ?? value;
        }
        inital_states[ui] = state;
    }
    await setUIStorage(inital_states);
}
//---------------------------------------------------------------------------------------------------------------------
// message functions
//---------------------------------------------------------------------------------------------------------------------
browser.runtime.onMessage.addListener((message) => {
    return backgroundMessageActions(message);
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function backgroundMessageActions(message) {
    switch (message.action) {
        case 'background_download_blob':
            return downloadBlob(message.blob, message.path);
        case 'background_create_object_url':
            return Promise.resolve(URL.createObjectURL(message.blob));
        case 'background_revoke_object_url':
            return URL.revokeObjectURL(message.url);
        case 'background_find_submission':
            return findSubmission(message.info);
        case 'background_add_submission':
            return addSubmission(message.info);
        case 'background_remove_user':
            return removeUser(message.site, message.user);
        case 'background_remove_submission':
            return removeSubmission(message.site, message.submission);
        case 'background_get_db_site_values':
            return getDBSiteValues(message.site);
        case 'background_get_db_user_values':
            return getDBUserValues(message.site, message.user);
        case 'background_get_db_json':
            return getDBAsJSON();
        case 'background_set_db_json':
            return setDBFromJSON(message.saved_json);
        case 'background_add_db_json':
            return addDBFromJSON(message.saved_json);
        case 'background_open_user_folder':
            return openFolder(message.path);
        case 'background_show_download':
            return browser.downloads.show(message.id);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function sendDBUpdate(site) {
    sendContentScriptMessage({
        action: 'content_db_update',
        site,
    });
    browser.runtime.sendMessage({ action: 'options_db_update', site });
    browser.runtime.sendMessage({ action: 'popup_db_update', site });
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function sendContentScriptMessage(message) {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
        if (tab.id && tab.url) {
            browser.tabs.sendMessage(tab.id, message).catch(() => { });
        }
    }
}
//---------------------------------------------------------------------------------------------------------------------
// downloading functions
//---------------------------------------------------------------------------------------------------------------------
async function downloadBlob(blob, path) {
    const url = URL.createObjectURL(blob);
    const stored_global = await getOptionsStorage('global');
    try {
        return await browser.downloads.download({
            url,
            filename: path,
            conflictAction: stored_global.conflict,
            saveAs: stored_global.saveAs,
        });
    }
    catch (error) {
        // return undefined if the download was canceled by the user
        if (error.message.includes('canceled')) {
            URL.revokeObjectURL(url);
            return;
        }
        throw error;
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function onDownloadChanged(delta) {
    if (!delta.state || delta.state.current !== 'complete') {
        return;
    }
    const url = delta.url?.current;
    if (url) {
        URL.revokeObjectURL(url);
    }
    const download_id = delta.id;
    if (G_folder_files.has(download_id)) {
        // delete the file used to open the folder and remove from the download history
        browser.downloads.removeFile(download_id);
        browser.downloads.erase({ id: download_id });
        G_folder_files.delete(download_id);
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
browser.downloads.onChanged.addListener(onDownloadChanged);
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const G_folder_files = new Map();
async function openFolder(path) {
    const url = URL.createObjectURL(new Blob(['']));
    const download_id = await browser.downloads.download({ url, filename: path, saveAs: false });
    G_folder_files.set(download_id, url);
    browser.downloads.show(download_id);
}
