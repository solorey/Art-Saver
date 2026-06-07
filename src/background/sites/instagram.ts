//---------------------------------------------------------------------------------------------------------------------
// instagram
//---------------------------------------------------------------------------------------------------------------------

const instagram_info: SiteInfo = {
    site: 'instagram',
    label: 'Instagram',
    links: {
        main: 'https://www.instagram.com/',
        user: (u) => `https://www.instagram.com/${u}`,
        gallery: (u) => `https://www.instagram.com/${u}`,
        favorites: (u) => `https://www.instagram.com/${u}/tagged/`,
        submission: (s) => `https://www.instagram.com/p/${s}/`,
    },
    id_type: 'string',
};

class InstagramUserFolder {
    site = '';
    userName = '';
    userId = '';
}

class InstagramFile extends InstagramUserFolder {
    description = '';
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

class InstagramMultiple extends InstagramFile {
    page = '';
}

const instagram_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new InstagramUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{submissionId}_by_{userName}.{ext}',
        metas: Object.keys(new InstagramFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userId}/{submissionId}/{submissionId}_{page}_by_{userName}.{ext}',
        metas: Object.keys(new InstagramMultiple()),
    },
} satisfies SiteForm;
type InstagramOptionsValues = SiteOptions<typeof instagram_form>;

type InstagramFileMeta = Pick<InstagramFile, 'fileName' | 'ext'>;
type InstagramFileData = FileData<InstagramFileMeta>;
type InstagramSubmissionMeta = Omit<InstagramFile, keyof InstagramFileMeta>;
type InstagramSubmissionData = SubmissionData<InstagramSubmissionMeta>;
