"use strict";
browser.runtime.onInstalled.addListener((details) => {
    initialBackgroundSetup(details);
});
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function initialBackgroundSetup(details) {
    await Promise.all([setupStates(), setupOptionsStorage()]);
    if (details.previousVersion && Number(details.previousVersion.split('.')[0]) < 2) {
        await upgradeToVersion2();
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
            return Promise.resolve(URL.createObjectURL(message.object));
        case 'background_revoke_object_url':
            return URL.revokeObjectURL(message.url);
        case 'background_add_submission':
            return waitAddSubmission(message.site, message.user, message.submission);
        case 'background_remove_user':
            return waitRemoveUser(message.site, message.user);
        case 'background_remove_submission':
            return waitRemoveSubmission(message.site, message.submission);
        case 'background_open_user_folder':
            return openFolder(message.path);
        case 'background_show_download':
            return browser.downloads.show(message.id);
        case 'background_open_popup':
            return browser.action.openPopup();
    }
}
//---------------------------------------------------------------------------------------------------------------------
// update saved info
//---------------------------------------------------------------------------------------------------------------------
var G_updating = false;
// function to prevent the saved info from updating multiple times at once
// it could cause some downloaded files to not be added to the list
async function isUpdating() {
    while (true) {
        if (!G_updating) {
            return true;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 25);
        });
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function waitRemoveUser(site, user) {
    G_updating = await isUpdating();
    const site_saved = await removeUserStorage(site, user);
    G_updating = false;
    return site_saved;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function waitAddSubmission(site, user, submission) {
    G_updating = await isUpdating();
    const site_saved = await addSubmissionStorage(site, user, submission);
    G_updating = false;
    return site_saved;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function waitRemoveSubmission(site, submission) {
    G_updating = await isUpdating();
    const site_saved = await removeSubmissionStorage(site, submission);
    G_updating = false;
    return site_saved;
}
//---------------------------------------------------------------------------------------------------------------------
// downloading functions
//---------------------------------------------------------------------------------------------------------------------
var G_current_downloads = new Map();
async function downloadBlob(blob, path) {
    const url = URL.createObjectURL(blob);
    const stored_global = await getOptionsStorage('global');
    const download_id = await browser.downloads.download({
        url,
        filename: path,
        conflictAction: stored_global.conflict,
        saveAs: stored_global.saveAs,
    });
    G_current_downloads.set(download_id, url);
    return download_id;
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
    else if (G_current_downloads.has(download_id)) {
        G_current_downloads.delete(download_id);
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
