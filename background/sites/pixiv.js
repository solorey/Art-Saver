"use strict";
//---------------------------------------------------------------------------------------------------------------------
// pixiv
//---------------------------------------------------------------------------------------------------------------------
const pixiv_info = {
    site: 'pixiv',
    label: 'Pixiv',
    links: {
        main: 'https://www.pixiv.net',
        user: (u) => `https://www.pixiv.net/users/${u}`,
        gallery: (u) => `https://www.pixiv.net/users/${u}/artworks`,
        favorites: (u) => `https://www.pixiv.net/users/${u}/bookmarks/artworks`,
        submission: (s) => `https://www.pixiv.net/artworks/${s}`,
    },
    id_type: 'number',
};
class PixivUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class PixivFile extends PixivUserFolder {
    title = '';
    submissionId = '';
    fileName = '';
    ext = '';
    YYYY = '';
    MM = '';
    DD = '';
    hh = '';
    mm = '';
    ss = '';
}
class PixivMultiple extends PixivFile {
    page = '';
}
const pixiv_form = {
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userName}_{userId}/',
        metas: Object.keys(new PixivUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new PixivFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}',
        metas: Object.keys(new PixivMultiple()),
    },
    ugoira: {
        type: 'select',
        label: 'Save uqoira as',
        options: [
            { value: 'multiple', label: 'Multiple files' },
            { value: 'zip', label: 'ZIP' },
            { value: 'apng', label: 'APNG' },
            { value: 'gif', label: 'GIF' },
            { value: 'webm', label: 'WEBM' },
        ],
        default: 'multiple',
    },
};
