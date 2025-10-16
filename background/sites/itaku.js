"use strict";
//---------------------------------------------------------------------------------------------------------------------
// itaku
//---------------------------------------------------------------------------------------------------------------------
const itaku_info = {
    site: 'itaku',
    label: 'Itaku',
    links: {
        main: 'https://itaku.ee',
        user: (u) => `https://itaku.ee/profile/${u}`,
        gallery: (u) => `https://itaku.ee/profile/${u}/gallery`,
        favorites: (u) => `https://itaku.ee/profile/${u}/stars`,
        submission: (s) => `https://itaku.ee/images/${s}`,
    },
    id_type: 'number',
};
class ItakuUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class ItakuFile extends ItakuUserFolder {
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
const itaku_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new ItakuUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new ItakuFile()),
    },
};
