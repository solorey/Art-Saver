//---------------------------------------------------------------------------------------------------------------------
// database functions
//---------------------------------------------------------------------------------------------------------------------

let G_db: IDBDatabase | undefined;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function initializeDB() {
    const request = indexedDB.open('MainDB');
    return new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () => {
            reject('IndexedDB could not be initialized');
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore('submissions', {
                keyPath: ['site', 'user', 'submission'],
            });
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

async function findSubmission(info: SubmissionInfo) {
    const request = (await getOrReconnectDB())
        .transaction('submissions', 'readonly')
        .objectStore('submissions')
        .index('submission')
        .getAll(info.submission);
    return await new Promise<SubmissionInfo | undefined>((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const submissions: SubmissionInfo[] = request.result;
            const same_site = submissions.filter((item) => item.site === info.site);
            resolve(same_site.find((item) => item.user === info.user) ?? same_site.shift());
        };
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function addSubmission(info: SubmissionInfo) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise<void>((resolve, reject) => {
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

async function removeSubmission(site: Site, submission: Submission) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise<void>((resolve, reject) => {
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

async function removeUser(site: Site, user: User) {
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise<void>((resolve, reject) => {
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

function sortSiteUsers(site: Site, users: User[]) {
    if (site === 'pixiv') {
        return users
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => i.toString());
    }
    const compare_users = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;
    return users.sort(compare_users);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function sortSiteSubmissions(site: Site, submissions: Submission[]) {
    if (site === 'twitter') {
        return submissions
            .map(BigInt)
            .sort((a, b) => (a > b ? 1 : a === b ? 0 : -1))
            .map((i) => i.toString());
    }
    let compare_submissions: ((a: string, b: string) => number) | ((a: number, b: number) => number) | undefined;
    switch (typeof submissions[0]) {
        case 'string':
            compare_submissions = new Intl.Collator(undefined, { numeric: true }).compare;
            break;
        case 'number':
            compare_submissions = (a: number, b: number) => a - b;
            break;
    }
    return submissions.sort(compare_submissions as any);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getDBSiteValues(site: Site) {
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    const request = store.index('site').getAll(site);
    return await new Promise<{ users: User[]; submissions: Submission[] }>((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const values: SubmissionInfo[] = request.result;
            const users = new Set<User>();
            const submissions = new Set<Submission>();
            for (const submission of values) {
                users.add(submission.user);
                submissions.add(submission.submission);
            }
            resolve({
                users: sortSiteUsers(site, [...users]),
                submissions: sortSiteSubmissions(site, [...submissions]),
            });
        };
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getDBUserValues(site: Site, user: User) {
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    const request = store.index('user').getAll(user);
    return await new Promise<{ submissions: Submission[] }>((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const values: SubmissionInfo[] = request.result;
            const submissions = new Set<Submission>();
            for (const submission of values) {
                if (submission.site === site) {
                    submissions.add(submission.submission);
                }
            }
            resolve({ submissions: sortSiteSubmissions(site, [...submissions]) });
        };
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getDBAsJSON(site?: Site) {
    const saved_json: Partial<JsonSaved> = {};
    const store = (await getOrReconnectDB()).transaction('submissions', 'readonly').objectStore('submissions');
    let request: IDBRequest<any[]>;
    if (site) {
        request = store.index('site').getAll(site);
    } else {
        request = store.getAll();
    }
    return await new Promise<Partial<JsonSaved>>((resolve, reject) => {
        request.onerror = () => {
            reject('Could not get from IndexedDB');
        };
        request.onsuccess = () => {
            const submissions: SubmissionInfo[] = request.result;
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

function cleanJsonInfo(json_info: Partial<JsonSaved>) {
    const cleaned_info: Partial<JsonSaved> = {};

    for (const site of SITES) {
        const saved_users = json_info[site];
        if (!saved_users) {
            continue;
        }
        const users: SavedValues = {};
        for (const [user, submissions] of Object.entries(saved_users)) {
            if (!submissions || submissions.length <= 0) {
                continue;
            }
            let clean_submissions: Submission[];
            if (SITES_INFO[site].id_type === 'number') {
                clean_submissions = [...new Set(submissions.map((n) => parseInt(`${n}`, 10)))].sort((a, b) => b - a);
            } else {
                clean_submissions = [...new Set(submissions.map((n) => `${n}`))].sort((a, b) =>
                    b.localeCompare(a, undefined, { numeric: true }),
                );
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

async function setDBFromJSON(saved_json: Partial<JsonSaved>) {
    saved_json = cleanJsonInfo(saved_json);
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise<void>((resolve, reject) => {
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

async function addDBFromJSON(saved_json: Partial<JsonSaved>) {
    saved_json = cleanJsonInfo(saved_json);
    const transaction = (await getOrReconnectDB()).transaction('submissions', 'readwrite');
    return await new Promise<void>((resolve, reject) => {
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

async function initialBackgroundSetup(details: Browser.Runtime.OnInstalledDetailsType) {
    await Promise.all([setupStates(), setupOptionsStorage(), initializeDB()]);
    if (isVersionLessThan(details.previousVersion, '2.0.0')) {
        await upgradeToVersion2();
    }

    if (isVersionLessThan(details.previousVersion, '2.2.0')) {
        await convertSavedStorage();
    }

    if (isVersionLessThan(details.previousVersion, '2.5.0')) {
        await changeBlueskyId();
    }

    if (isVersionLessThan(details.previousVersion, '2.6.0')) {
        await fixPadMod();
    }

    if (details.reason === 'install') {
        browser.runtime.openOptionsPage();
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function isVersionLessThan(current: string | undefined, compare: string) {
    if (!current) {
        return false;
    }

    const current_parts = current.split('.').map(Number);
    const compare_parts = compare.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const current_num = current_parts[i] ?? 0;
        const compare_num = compare_parts[i] ?? 0;

        if (current_num !== compare_num) {
            return current_num < compare_num;
        }
    }

    return false;
}

//---------------------------------------------------------------------------------------------------------------------
// backend updates
//---------------------------------------------------------------------------------------------------------------------

async function upgradeToVersion2() {
    // upgrade storage to lowercase user ids
    const current_info = await getSavedStorage(SITES);
    const new_info: Partial<JsonSaved> = {};
    for (const [site, info] of Object.entries(current_info)) {
        const users: SavedValues = {};
        for (const [user, submissions] of Object.entries(info)) {
            if (submissions && submissions.length > 0) {
                users[user.toLowerCase()] = submissions;
            }
        }
        if (Object.keys(users).length > 0) {
            new_info[site as Site] = users;
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

// convert old storage to IndexedDB
async function convertSavedStorage() {
    const old_saved_storage = await getSavedStorage(SITES);
    if (Object.keys(old_saved_storage).length > 0) {
        await addDBFromJSON(old_saved_storage);
        console.log('Old storage converted to IndexedDB');
        // just in case
        browser.storage.local.set({ old_saved: old_saved_storage });
        removeSavedStorage(SITES);
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function changeBlueskyId() {
    const db = await getOrReconnectDB();
    const submissions = await new Promise<SubmissionInfo[]>((resolve, reject) => {
        const request: IDBRequest<SubmissionInfo[]> = db
            .transaction('submissions')
            .objectStore('submissions')
            .index('site')
            .getAll('bluesky');
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject('Could not get Bluesky submissions');
        };
    });
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('submissions', 'readwrite');
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not remove old Bluesky submissions');
        };
        const delete_request = transaction.objectStore('submissions').index('site').openCursor('bluesky');
        delete_request.onsuccess = () => {
            const cursor = delete_request.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    });
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('submissions', 'readwrite');
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = () => {
            reject('Could not update Bluesky submissions');
        };
        for (const submission of submissions) {
            submission.submission = `${submission.submission}`.replace('+', ';');
            transaction.objectStore('submissions').add(submission);
        }
    });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// swap the '<' '>' symbols in the pad modifier to match other languages
async function fixPadMod() {
    const stored_options = await getOptionsStorage(SITES);
    for (const site of SITES) {
        const site_options = stored_options[site];
        if (site_options) {
            const text_options = Object.entries(SITES_FORMS[site])
                .filter(([_, value]) => value.type === 'textarea')
                .map(([key]) => key);
            for (const text_option of text_options) {
                const value = site_options[text_option] as string | undefined;
                if (value) {
                    site_options[text_option] = value.replace(
                        /{([a-zA-Z]+\^?)(!.+?)?}/g,
                        (match: string, p1: string, p2: string) => {
                            if (!p2) {
                                return match;
                            }
                            const p2_new = p2.replace(
                                /(!.?)([<>])(\d+)/g,
                                (_: string, p1: string, p2: string, p3: string) => {
                                    if (p2 === '<') {
                                        return `${p1}>${p3}`;
                                    }
                                    return `${p1}<${p3}`;
                                },
                            );
                            return `{${p1}${p2_new}}`;
                        },
                    );
                }
            }
        }
    }
    await setOptionsStorage(stored_options);
}

//---------------------------------------------------------------------------------------------------------------------
// options functions
//---------------------------------------------------------------------------------------------------------------------

async function setupOptionsStorage() {
    const stored_options = await getOptionsStorage(SITES_AND_GLOBAL);
    const inital_options: Partial<JsonOptions> = {};
    for (const site of SITES_AND_GLOBAL) {
        if (!stored_options[site]) {
            console.log('New site', site);
        }
        const options: OptionsValues = {};
        for (const [key, option] of Object.entries(SITES_AND_GLOBAL_FORMS[site])) {
            let value = stored_options[site]?.[key];
            if (value != null) {
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
    const inital_states: Partial<JsonUI> = {};
    for (const ui of UIS) {
        const state: StateValues = {};
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

browser.runtime.onMessage.addListener((message: any) => {
    return backgroundMessageActions(message);
});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function backgroundMessageActions(message: BackgroundMessage) {
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

async function sendDBUpdate(site: Site) {
    sendContentScriptMessage({
        action: 'content_db_update',
        site,
    } as ContentMessage);
    browser.runtime.sendMessage({ action: 'options_db_update', site } as OptionsMessage);
    browser.runtime.sendMessage({ action: 'popup_db_update', site } as PopupMessage);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function sendContentScriptMessage(message: ContentMessage) {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
        if (tab.id && tab.url) {
            browser.tabs.sendMessage(tab.id, message).catch(() => {});
        }
    }
}

//---------------------------------------------------------------------------------------------------------------------
// downloading functions
//---------------------------------------------------------------------------------------------------------------------

async function downloadBlob(blob: Blob, path: string) {
    const url = URL.createObjectURL(blob);
    const stored_global = await getOptionsStorage<GlobalOptionsValues>('global');
    try {
        return await browser.downloads.download({
            url,
            filename: path,
            conflictAction: stored_global.conflict as Browser.Downloads.FilenameConflictAction,
            saveAs: stored_global.saveAs,
        });
    } catch (error) {
        // return undefined if the download was canceled by the user
        if ((error as Error).message.includes('canceled')) {
            URL.revokeObjectURL(url);
            return;
        }
        throw error;
    }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function onDownloadChanged(delta: Browser.Downloads.OnChangedDownloadDeltaType) {
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

const G_folder_files = new Map<number, string>();

async function openFolder(path: string) {
    const url = URL.createObjectURL(new Blob());
    const download_id = await browser.downloads.download({ url, filename: path, saveAs: false });
    G_folder_files.set(download_id, url);
    browser.downloads.show(download_id);
}
