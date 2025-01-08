"use strict";
const SITES = ['deviantart', 'twitter', 'bluesky', 'pixiv', 'furaffinity', 'inkbunny'];
const SITES_AND_GLOBAL = ['global', ...SITES];
const UIS = ['popup', 'infobar', 'settings'];
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const optionsKey = (s) => `${s}_options`;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function storageOptionsToJson(storage_options) {
    const json_options = {};
    for (const site of SITES_AND_GLOBAL) {
        const storage_values = storage_options[optionsKey(site)];
        if (storage_values) {
            json_options[site] = storage_values;
        }
    }
    return json_options;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function jsonOptionsToStorage(json_options) {
    const storage_options = {};
    for (const site of SITES_AND_GLOBAL) {
        const json_values = json_options[site];
        if (json_values) {
            storage_options[optionsKey(site)] = json_values;
        }
    }
    return storage_options;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getOptionsStorage(site) {
    const storage_keys = [].concat(site).map((s) => optionsKey(s));
    const storage_options = (await browser.storage.local.get(storage_keys));
    const json_options = storageOptionsToJson(storage_options);
    if (typeof site === 'string') {
        return json_options[site] ?? {};
    }
    return json_options;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setOptionsStorage(json_options) {
    const storage_options = jsonOptionsToStorage(json_options);
    return await browser.storage.local.set(storage_options);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const savedKey = (s) => `${s}_saved`;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function storageSavedToJson(storage_saved) {
    const json_saved = {};
    for (const site of SITES) {
        const storage_values = storage_saved[savedKey(site)];
        if (storage_values) {
            json_saved[site] = storage_values;
        }
    }
    return json_saved;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function jsonSavedToStorage(json_saved) {
    const storage_saved = {};
    for (const site of SITES) {
        const json_values = json_saved[site];
        if (json_values) {
            storage_saved[savedKey(site)] = json_values;
        }
    }
    return storage_saved;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getSavedStorage(site) {
    const storage_keys = [].concat(site).map((s) => savedKey(s));
    const storage_saved = (await browser.storage.local.get(storage_keys));
    const json_saved = storageSavedToJson(storage_saved);
    if (typeof site === 'string') {
        return json_saved[site] ?? {};
    }
    return json_saved;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setSavedStorage(json_saved) {
    const storage_saved = jsonSavedToStorage(json_saved);
    return await browser.storage.local.set(storage_saved);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function removeSavedStorage(site) {
    const storage_keys = [].concat(site).map((s) => savedKey(s));
    return await browser.storage.local.remove(storage_keys);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const stateKey = (ui) => `${ui}_state`;
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function storageUIToJson(storage_ui) {
    const json_ui = {};
    for (const ui of UIS) {
        const storage_values = storage_ui[stateKey(ui)];
        if (storage_values) {
            json_ui[ui] = storage_values;
        }
    }
    return json_ui;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function jsonUIToStorage(json_ui) {
    const storage_ui = {};
    for (const ui of UIS) {
        const json_values = json_ui[ui];
        if (json_values) {
            storage_ui[stateKey(ui)] = json_values;
        }
    }
    return storage_ui;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function getUIStorage(ui) {
    const storage_keys = [].concat(ui).map((ui) => stateKey(ui));
    const storage_ui = (await browser.storage.local.get(storage_keys));
    const json_ui = storageUIToJson(storage_ui);
    if (typeof ui === 'string') {
        return json_ui[ui] ?? {};
    }
    return json_ui;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function setUIStorage(json_ui) {
    const storage_ui = jsonUIToStorage(json_ui);
    return await browser.storage.local.set(storage_ui);
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function updateUIStorage(ui, values) {
    const storage_ui = (await getUIStorage(ui)) ?? {};
    const updated_state = { ...storage_ui, ...values };
    const new_storage_ui = Object.fromEntries([[ui, updated_state]]);
    await setUIStorage(new_storage_ui);
}
