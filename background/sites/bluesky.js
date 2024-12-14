"use strict";
//---------------------------------------------------------------------------------------------------------------------
// bluesky
//---------------------------------------------------------------------------------------------------------------------
const bluesky_info = {
    site: 'bluesky',
    label: 'Bluesky',
    links: {
        main: 'https://bsky.app',
        user: (u) => `https://bsky.app/profile/${u}`,
        gallery: (u) => `https://bsky.app/profile/${u}`,
        favorites: (u) => `https://bsky.app/profile/${u}`,
        // s = '<submissionId>+<userDid>'
        submission: (s) => {
            const split = `${s}`.split('+');
            return `https://bsky.app/profile/${split[1]}/post/${split[0]}`;
        },
    },
    id_type: 'string',
};
class BlueskyUserFolder {
    site = '';
    userName = '';
    userId = '';
    // https://atproto.com/specs/did
    userDid = '';
}
class BlueskyFile extends BlueskyUserFolder {
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
class BlueskyMultiple extends BlueskyFile {
    page = '';
}
const bluesky_form = {
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new BlueskyUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{submissionId}+{userDid}_by_{userId}.{ext}',
        metas: Object.keys(new BlueskyFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userId}/{submissionId}+{userDid}/{submissionId}+{userDid}_{page}_by_{userId}.{ext}',
        metas: Object.keys(new BlueskyMultiple()),
    },
};
