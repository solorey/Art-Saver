//---------------------------------------------------------------------------------------------------------------------
// ui states
//---------------------------------------------------------------------------------------------------------------------

const popup_state = {
    tab: 'user',
    downloadLock: true,
};
type PopupStateValues = typeof popup_state;

const infobar_state = {
    showFolders: false,
};
type InfobarStateValues = typeof infobar_state;

const settings_state = {
    tab: 'global',
};
type SettingsStateValues = typeof settings_state;

type StateValues = Partial<Record<string, string | number | boolean>>;
type UI = 'popup' | 'infobar' | 'settings';
const UIS_STATES: Record<UI, StateValues> = {
    popup: popup_state,
    infobar: infobar_state,
    settings: settings_state,
};

type OptionValue = string | number | boolean;
type OptionsValues = Partial<Record<string, OptionValue>>;
type SavedValues = Partial<Record<string, Submission[]>>;

type OptionType = 'select' | 'checkbox' | 'number' | 'textarea' | 'slider' | 'shortcut';

type OptionRelated = { option: string; value: OptionValue };
interface Option {
    type: OptionType;
    label: string;
    related?: OptionRelated[];
}

interface SelectOption extends Option {
    type: 'select';
    options: { value: string; label: string }[];
    default: string;
}

interface CheckboxOption extends Option {
    type: 'checkbox';
    default: boolean;
}

interface NumberOption extends Option {
    type: 'number';
    min: number;
    max?: number;
    unit?: string;
    default: number;
}

interface TextareaOption extends Option {
    type: 'textarea';
    metas: string[];
    default: string;
}

interface SliderOption extends Option {
    type: 'slider';
    min: number;
    max: number;
    unit?: string;
    default: number;
}

interface ShortcutOption extends Option {
    type: 'shortcut';
    default: string;
}

type SupportedOption = SelectOption | CheckboxOption | NumberOption | SliderOption | TextareaOption | ShortcutOption;
type SiteForm = Record<string, SupportedOption>;

type SiteOptions<T extends SiteForm> = {
    [s in keyof T]: T[s]['default'];
};

type User = string;
type Submission = string | number;
type MetaRecord = Record<string, string>;

type SiteInfo = {
    site: Site;
    label: string;
    links: {
        main: string;
        user: (u: User) => string;
        gallery: (u: User) => string;
        favorites: (u: User) => string;
        submission: (s: Submission) => string;
    };
    id_type: 'number' | 'string';
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
    retryCount: {
        type: 'number',
        label: 'Download retry count',
        min: 0,
        default: 0,
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
} satisfies SiteForm;
type GlobalOptionsValues = SiteOptions<typeof global_form>;

//---------------------------------------------------------------------------------------------------------------------
// settings big objects
//---------------------------------------------------------------------------------------------------------------------

const SITES_INFO: Record<Site, SiteInfo> = {
    deviantart: deviantart_info,
    newgrounds: newgrounds_info,
    twitter: twitter_info,
    bluesky: bluesky_info,
    instagram: instagram_info,
    itaku: itaku_info,
    pixiv: pixiv_info,
    furaffinity: furaffinity_info,
    inkbunny: inkbunny_info,
};

const SITES_FORMS: Record<Site, SiteForm> = {
    deviantart: deviantart_form,
    newgrounds: newgrounds_form,
    twitter: twitter_form,
    bluesky: bluesky_form,
    instagram: instagram_form,
    itaku: itaku_form,
    pixiv: pixiv_form,
    furaffinity: furaffinity_form,
    inkbunny: inkbunny_form,
};

const SITES_AND_GLOBAL_FORMS: Record<SiteOrGlobal, SiteForm> = {
    ...SITES_FORMS,
    global: global_form,
};
