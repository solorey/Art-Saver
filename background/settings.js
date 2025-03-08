"use strict";
//---------------------------------------------------------------------------------------------------------------------
// ui states
//---------------------------------------------------------------------------------------------------------------------
const popup_state = {
    tab: 'user',
    downloadLock: true,
};
const infobar_state = {
    showFolders: false,
};
const settings_state = {
    tab: 'global',
};
const UIS_STATES = {
    popup: popup_state,
    infobar: infobar_state,
    settings: settings_state,
};
//---------------------------------------------------------------------------------------------------------------------
// global options
//---------------------------------------------------------------------------------------------------------------------
const global_form = {
    theme: {
        type: 'select',
        label: 'Theme',
        options: [
            { value: 'preferred', label: 'Preferred' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
        ],
        default: 'preferred',
    },
    saveAs: {
        type: 'checkbox',
        label: 'Prompt when downloading each file',
        default: false,
    },
    conflict: {
        type: 'select',
        label: 'When there is an existing file of the same name',
        options: [
            { value: 'overwrite', label: 'Overwrite' },
            { value: 'uniquify', label: 'Uniquify' },
        ],
        default: 'overwrite',
        related: [{ option: 'saveAs', value: false }],
    },
    replace: {
        type: 'checkbox',
        label: 'Replace spaces with underscore',
        default: true,
    },
    iconSize: {
        type: 'number',
        label: 'Icons size',
        min: 0,
        unit: 'px',
        default: 16,
    },
    addScreen: {
        type: 'checkbox',
        label: 'Add screen over saved thumbnails',
        default: false,
    },
    screenOpacity: {
        type: 'slider',
        label: 'Screen opacity',
        min: 0,
        max: 100,
        unit: '%',
        default: 50,
        related: [{ option: 'addScreen', value: true }],
    },
    useQueue: {
        type: 'checkbox',
        label: 'Download submissions using a queue',
        default: false,
    },
    queueConcurrent: {
        type: 'number',
        label: 'Concurrent downloads',
        min: 1,
        default: 1,
        related: [{ option: 'useQueue', value: true }],
    },
    queueWait: {
        type: 'number',
        label: 'Wait time between downloads',
        min: 0,
        unit: 's',
        default: 0,
        related: [{ option: 'useQueue', value: true }],
    },
    shortcutDownload: {
        type: 'shortcut',
        label: 'Download hovered submission',
        default: 'D',
    },
    shortcutForget: {
        type: 'shortcut',
        label: 'Forget hovered submission',
        default: 'F',
    },
    shortcutDownloadAll: {
        type: 'shortcut',
        label: 'Download all submissions on page',
        default: '',
    },
    infoBar: {
        type: 'checkbox',
        label: 'Show page info bar',
        default: false,
    },
    shortcutInfoBar: {
        type: 'shortcut',
        label: 'Toggle page info bar',
        default: '',
        related: [{ option: 'infoBar', value: true }],
    },
    logLevel: {
        type: 'select',
        label: 'Log level',
        options: [
            { value: '4', label: 'Debug' },
            { value: '3', label: 'Info' },
            { value: '2', label: 'Warn' },
            { value: '1', label: 'Error' },
            { value: '0', label: 'Silent' },
        ],
        default: '3',
    },
};
//---------------------------------------------------------------------------------------------------------------------
// settings big objects
//---------------------------------------------------------------------------------------------------------------------
const SITES_INFO = {
    deviantart: deviantart_info,
    newgrounds: newgrounds_info,
    twitter: twitter_info,
    bluesky: bluesky_info,
    pixiv: pixiv_info,
    furaffinity: furaffinity_info,
    inkbunny: inkbunny_info,
};
const SITES_FORMS = {
    deviantart: deviantart_form,
    newgrounds: newgrounds_form,
    twitter: twitter_form,
    bluesky: bluesky_form,
    pixiv: pixiv_form,
    furaffinity: furaffinity_form,
    inkbunny: inkbunny_form,
};
const SITES_AND_GLOBAL_FORMS = {
    global: global_form,
    ...SITES_FORMS,
};
