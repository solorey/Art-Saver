//---------------------------------------------------------------------------------------------------------------------
// twitter
//---------------------------------------------------------------------------------------------------------------------

const twitter_info: SiteInfo = {
    site: 'twitter',
    label: 'X (Twitter)',
    links: {
        main: 'https://x.com',
        user: (u) => `https://x.com/${u}`,
        gallery: (u) => `https://x.com/${u}/media`,
        favorites: (u) => `https://x.com/${u}/likes`,
        submission: (s) => `https://x.com/i/web/status/${s}`,
    },
    id_type: 'string',
};

class TwitterUserFolder {
    site = '';
    userName = '';
    userId = '';
}

class TwitterFile extends TwitterUserFolder {
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

class TwitterMultiple extends TwitterFile {
    page = '';
}

const twitter_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new TwitterUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{submissionId}_by_{userId}.{ext}',
        metas: Object.keys(new TwitterFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userId}/{submissionId}/{submissionId}_{page}_by_{userId}.{ext}',
        metas: Object.keys(new TwitterMultiple()),
    },
} satisfies SiteForm;
type TwitterOptionsValues = SiteOptions<typeof twitter_form>;

type TwitterFileMeta = Pick<TwitterFile, 'fileName' | 'ext'>;
type TwitterFileData = FileData<TwitterFileMeta>;
type TwitterSubmissionMeta = Omit<TwitterFile, keyof TwitterFileMeta>;
type TwitterSubmissionData = SubmissionData<TwitterSubmissionMeta>;
