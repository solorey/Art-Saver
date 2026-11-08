//---------------------------------------------------------------------------------------------------------------------
// baraag
//---------------------------------------------------------------------------------------------------------------------

const baraag_info: SiteInfo = {
    site: 'baraag',
    label: 'Baraag',
    links: {
        main: 'https://baraag.net',
        user: (u) => `https://baraag.net/@${u}`,
        gallery: (u) => `https://baraag.net/@${u}/media`,
        favorites: (u) => `https://baraag.net/@${u}/featured`,
        submission: (s) => `https://baraag.net/statuses/${s}`,
    },
    id_type: 'string',
};

class BaraagUserFolder {
    site = '';
    userName = '';
    userId = '';
}

class BaraagFile extends BaraagUserFolder {
    description = '';
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

class BaraagMultiple extends BaraagFile {
    page = '';
}

const baraag_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: false,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userId}/',
        metas: Object.keys(new BaraagUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userId}/{submissionId}_by_{userId}.{ext}',
        metas: Object.keys(new BaraagFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userId}/{submissionId}/{submissionId}_{page}_by_{userId}.{ext}',
        metas: Object.keys(new BaraagMultiple()),
    },
} satisfies SiteForm;
type BaraagOptionsValues = SiteOptions<typeof baraag_form>;

type BaraagFileMeta = Pick<BaraagFile, 'fileName' | 'fileId' | 'ext'>;
type BaraagFileData = FileData<BaraagFileMeta>;
type BaraagSubmissionMeta = Omit<BaraagFile, keyof BaraagFileMeta>;
type BaraagSubmissionData = SubmissionData<BaraagSubmissionMeta>;
