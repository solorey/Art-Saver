"use strict";
//---------------------------------------------------------------------------------------------------------------------
// inkbunny
//---------------------------------------------------------------------------------------------------------------------
const inkbunny_info = {
    site: 'inkbunny',
    label: 'Inkbunny',
    links: {
        main: 'https://inkbunny.net',
        user: (u) => `https://inkbunny.net/${u}`,
        gallery: (u) => `https://inkbunny.net/gallery/${u}`,
        favorites: (u) => `https://inkbunny.net/submissionsviewall.php?mode=search&favsby=${u}`,
        submission: (s) => `https://inkbunny.net/s/${s}`,
    },
    id_type: 'number',
};
class InkbunnyUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class InkbunnyFile extends InkbunnyUserFolder {
    title = '';
    submissionId = '';
    fileName = '';
    fileId = '';
    ext = '';
    YYYY = '';
    MM = '';
    DD = '';
    hh = '';
    mm = '';
    ss = '';
}
class InkbunnyMultiple extends InkbunnyFile {
    page = '';
}
const inkbunny_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userName}/',
        metas: Object.keys(new InkbunnyUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new InkbunnyFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new InkbunnyMultiple()),
    },
};
