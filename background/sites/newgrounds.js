"use strict";
//---------------------------------------------------------------------------------------------------------------------
// newgrounds
//---------------------------------------------------------------------------------------------------------------------
const newgrounds_info = {
    site: 'newgrounds',
    label: 'Newgrounds',
    links: {
        main: 'https://www.newgrounds.com/',
        user: (u) => `https://${u}.newgrounds.com`,
        gallery: (u) => `https://${u}.newgrounds.com/art`,
        favorites: (u) => `https://${u}.newgrounds.com/favorites`,
        // s = 'portal;<submissionId>' | 'audio;<submissionId>' | 'art;<userId>;<slug>'
        submission: (s) => {
            const split = `${s}`.split(';');
            switch (split[0]) {
                case 'portal':
                    return `https://www.newgrounds.com/portal/view/${split[1]}`;
                case 'audio':
                    return `https://www.newgrounds.com/audio/listen/${split[1]}`;
                case 'art':
                    return `https://www.newgrounds.com/art/view/${split[1]}/${split[2]}`;
            }
            return '';
        },
    },
    id_type: 'string',
};
class NewgroundsUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class NewgroundsFile extends NewgroundsUserFolder {
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
class NewgroundsArtFile extends NewgroundsFile {
    slug = '';
}
class NewgroundsMultiple extends NewgroundsArtFile {
    page = '';
}
class NewgroundsGameFolder extends NewgroundsUserFolder {
    title = '';
    submissionId = '';
    YYYY = '';
    MM = '';
    DD = '';
    hh = '';
    mm = '';
    ss = '';
}
const newgrounds_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new NewgroundsUserFolder()),
    },
    fileArt: {
        type: 'textarea',
        label: 'Save art file as',
        default: 'Saved/{site}/{userId}/art/art;{userId};{slug}_{submissionId}.{ext}',
        metas: Object.keys(new NewgroundsArtFile()),
    },
    fileArtMultiple: {
        type: 'textarea',
        label: 'Save multiple art files as',
        default: 'Saved/{site}/{userId}/art/art;{userId};{slug}_{submissionId}/art;{userId};{slug}_{submissionId}_{page}.{ext}',
        metas: Object.keys(new NewgroundsMultiple()),
    },
    fileAudio: {
        type: 'textarea',
        label: 'Save audio file as',
        default: 'Saved/{site}/{userId}/audio/audio;{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new NewgroundsFile()),
    },
    fileMovie: {
        type: 'textarea',
        label: 'Save movie file as',
        default: 'Saved/{site}/{userId}/movies/portal;{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new NewgroundsFile()),
    },
    gameFolder: {
        type: 'textarea',
        label: 'Save game in folder',
        default: 'Saved/{site}/{userId}/games/portal;{submissionId}_{title}_by_{userName}/',
        metas: Object.keys(new NewgroundsGameFolder()),
    },
};
