"use strict";
//---------------------------------------------------------------------------------------------------------------------
// furaffinity
//---------------------------------------------------------------------------------------------------------------------
const furaffinity_info = {
    site: 'furaffinity',
    label: 'Fur Affinity',
    links: {
        main: 'https://www.furaffinity.net',
        user: (u) => `https://www.furaffinity.net/user/${u}`,
        gallery: (u) => `https://www.furaffinity.net/gallery/${u}`,
        favorites: (u) => `https://www.furaffinity.net/favorites/${u}`,
        submission: (s) => `https://www.furaffinity.net/view/${s}`,
    },
    id_type: 'number',
};
class FuraffinityUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class FuraffinityFile extends FuraffinityUserFolder {
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
const furaffinity_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new FuraffinityUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new FuraffinityFile()),
    },
};
