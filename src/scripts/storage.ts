const SITES_KEYS = {
    deviantart: '',
    newgrounds: '',
    twitter: '',
    bluesky: '',
    instagram: '',
    itaku: '',
    pixiv: '',
    furaffinity: '',
    inkbunny: '',
};
type Site = keyof typeof SITES_KEYS;

const SITES = Object.keys(SITES_KEYS) as Site[];

type SiteOrGlobal = Site | 'global';

const SITES_AND_GLOBAL: SiteOrGlobal[] = ['global', ...SITES];
const UIS: UI[] = ['popup', 'infobar', 'settings'];

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type StorageOptionsKey = `${SiteOrGlobal}_options`;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const optionsKey = (s: SiteOrGlobal) => `${s}_options` as StorageOptionsKey;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type JsonOptions = Record<SiteOrGlobal, OptionsValues>;
type StorageOptions = Record<StorageOptionsKey, OptionsValues>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function storageOptionsToJson(storage_options: Partial<StorageOptions>) {
    const json_options: Partial<JsonOptions> = {};
    for (const site of SITES_AND_GLOBAL) {
        const storage_values = storage_options[optionsKey(site)];
        if (storage_values) {
            json_options[site] = storage_values;
        }
    }
    return json_options;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function jsonOptionsToStorage(json_options: Partial<JsonOptions>) {
    const storage_options: Partial<StorageOptions> = {};
    for (const site of SITES_AND_GLOBAL) {
        const json_values = json_options[site];
        if (json_values) {
            storage_options[optionsKey(site)] = json_values;
        }
    }
    return storage_options;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getOptionsStorage<T extends OptionsValues>(site: SiteOrGlobal): Promise<T>;
async function getOptionsStorage(site: SiteOrGlobal[]): Promise<Partial<JsonOptions>>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getOptionsStorage(site: SiteOrGlobal | SiteOrGlobal[]) {
    const storage_keys = ([] as SiteOrGlobal[]).concat(site).map((s) => optionsKey(s));
    const storage_options = (await browser.storage.local.get(storage_keys)) as Partial<StorageOptions>;
    const json_options = storageOptionsToJson(storage_options);
    if (typeof site === 'string') {
        return json_options[site] ?? {};
    }
    return json_options;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setOptionsStorage(json_options: Partial<JsonOptions>) {
    const storage_options = jsonOptionsToStorage(json_options);
    return await browser.storage.local.set(storage_options);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type StorageSavedKey = `${Site}_saved`;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const savedKey = (s: Site) => `${s}_saved` as StorageSavedKey;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type JsonSaved = Record<Site, SavedValues>;
type StorageSaved = Record<StorageSavedKey, SavedValues>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function storageSavedToJson(storage_saved: Partial<StorageSaved>) {
    const json_saved: Partial<JsonSaved> = {};
    for (const site of SITES) {
        const storage_values = storage_saved[savedKey(site)];
        if (storage_values) {
            json_saved[site] = storage_values;
        }
    }
    return json_saved;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function jsonSavedToStorage(json_saved: Partial<JsonSaved>) {
    const storage_saved: Partial<StorageSaved> = {};
    for (const site of SITES) {
        const json_values = json_saved[site];
        if (json_values) {
            storage_saved[savedKey(site)] = json_values;
        }
    }
    return storage_saved;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getSavedStorage<T extends SavedValues>(site: Site): Promise<T>;
async function getSavedStorage(site: Site[]): Promise<Partial<JsonSaved>>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getSavedStorage(site: Site | Site[]) {
    const storage_keys = ([] as Site[]).concat(site).map((s) => savedKey(s));
    const storage_saved = (await browser.storage.local.get(storage_keys)) as Partial<StorageSaved>;
    const json_saved = storageSavedToJson(storage_saved);
    if (typeof site === 'string') {
        return json_saved[site] ?? {};
    }
    return json_saved;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setSavedStorage(json_saved: Partial<JsonSaved>) {
    const storage_saved = jsonSavedToStorage(json_saved);
    return await browser.storage.local.set(storage_saved);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function removeSavedStorage(site: Site | Site[]) {
    const storage_keys = ([] as Site[]).concat(site).map((s) => savedKey(s));
    return await browser.storage.local.remove(storage_keys);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type StorageStateKey = `${UI}_state`;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const stateKey = (ui: UI) => `${ui}_state` as StorageStateKey;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type JsonUI = Record<UI, StateValues>;
type StorageUI = Record<StorageStateKey, StateValues>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function storageUIToJson(storage_ui: Partial<StorageUI>) {
    const json_ui: Partial<JsonUI> = {};
    for (const ui of UIS) {
        const storage_values = storage_ui[stateKey(ui)];
        if (storage_values) {
            json_ui[ui] = storage_values;
        }
    }
    return json_ui;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function jsonUIToStorage(json_ui: Partial<JsonUI>) {
    const storage_ui: Partial<StorageUI> = {};
    for (const ui of UIS) {
        const json_values = json_ui[ui];
        if (json_values) {
            storage_ui[stateKey(ui)] = json_values;
        }
    }
    return storage_ui;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUIStorage<T extends StateValues>(ui: UI): Promise<T>;
async function getUIStorage(ui: UI[]): Promise<Partial<JsonUI>>;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getUIStorage(ui: UI | UI[]) {
    const storage_keys = ([] as UI[]).concat(ui).map((ui) => stateKey(ui));
    const storage_ui = (await browser.storage.local.get(storage_keys)) as Partial<StorageUI>;
    const json_ui = storageUIToJson(storage_ui);
    if (typeof ui === 'string') {
        return json_ui[ui] ?? {};
    }
    return json_ui;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function setUIStorage(json_ui: Partial<JsonUI>) {
    const storage_ui = jsonUIToStorage(json_ui);
    return await browser.storage.local.set(storage_ui);
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function updateUIStorage(ui: UI, values: StateValues) {
    const storage_ui = (await getUIStorage(ui)) ?? {};
    const updated_state: StateValues = { ...storage_ui, ...values };
    const new_storage_ui: Partial<JsonUI> = Object.fromEntries([[ui, updated_state]]);
    await setUIStorage(new_storage_ui);
}
