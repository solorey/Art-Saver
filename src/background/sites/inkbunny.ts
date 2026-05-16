//---------------------------------------------------------------------------------------------------------------------
// inkbunny
//---------------------------------------------------------------------------------------------------------------------

const inkbunny_info: SiteInfo = {
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

class InkbunnyWriting extends InkbunnyFile {
    url = '';
    wordCount = '';
    story = '';
    description = '';
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
        default:
            'Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_{page}_by_{userName}.{ext}',
        metas: Object.keys(new InkbunnyMultiple()),
    },
    writing: {
        type: 'select',
        label: 'Save writing as',
        options: [
            { value: 'html', label: 'HTML' },
            { value: 'txt', label: 'Text' },
        ],
        default: 'html',
    },
    skipWriting: {
        type: 'checkbox',
        label: 'Skip saving writing if it is already included as its own file',
        default: true,
    },
    includeImage: {
        type: 'checkbox',
        label: 'Include the main story image',
        default: true,
        related: [{ option: 'writing', value: 'html' }],
    },
    embedImages: {
        type: 'checkbox',
        label: 'Embed images in the HTML file',
        default: false,
        related: [{ option: 'writing', value: 'html' }],
    },
    writingHTML: {
        type: 'textarea',
        label: 'Writing HTML template',
        default:
            '<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <style type="text/css">\n      :root {\n        font-family: "Times New Roman", serif;\n      }\n      * {\n        margin: 0;\n        padding: 0;\n      }\n      body {\n        background-color: #ffffff;\n        color: #333333;\n      }\n      .stat,\n      .stats {\n        display: flex;\n      }\n      .source,\n      .stat {\n        text-overflow: ellipsis;\n        overflow: hidden;\n      }\n      .author-link,\n      .source-link {\n        font-weight: bold;\n      }\n      img,\n      picture,\n      svg,\n      video {\n        max-width: 100%;\n        display: block;\n      }\n      .main {\n        max-width: 48rem;\n        margin-inline: auto;\n        padding-inline: 1rem;\n      }\n      .header {\n        font-family: "Trebuchet MS", sans-serif;\n        margin-block: 0.75rem;\n      }\n      .title {\n        font-size: 2rem;\n        margin-block-end: 0.5rem;\n        background-color: #555753;\n        color: #eee;\n        padding-inline: 2rem;\n        padding-block: 0.75rem;\n        text-align: center;\n      }\n      .author {\n        color: #777777;\n      }\n      a {\n        text-decoration: underline dotted #729fcf 1px;\n        color: #3465a4;\n      }\n      a:hover {\n        color: #204a87;\n        text-decoration-color: #3465a4;\n      }\n      .stats {\n        color: #777777;\n        font-size: 0.9rem;\n        font-family: Arial, sans-serif;\n        flex-wrap: wrap;\n        column-gap: 0.75rem;\n        margin-block-end: 1rem;\n      }\n      .stat {\n        gap: 0.25rem;\n        white-space: nowrap;\n      }\n      #image {\n        margin-inline: auto;\n        margin-block: 1rem;\n      }\n      .content {\n        word-wrap: break-word;\n      }\n      .content p {\n        margin-block: 1rem;\n      }\n      #content {\n        line-height: 1.5em;\n      }\n      #description {\n        font-family: Arial, sans-serif;\n        font-size: small;\n      }\n      hr {\n        margin-block: 1.5rem;\n      }\n    </style>\n  </head>\n  <body>\n    <main class="main">\n      <header class="header">\n        <h1 class="title">{title}</h1>\n        <p class="author">\n          by\n          <a class="author-link" href="https://inkbunny.net/{userName}">\n            {userName}\n          </a>\n        </p>\n      </header>\n      <dl class="stats">\n        <div class="stat">\n          <dt>Words:</dt>\n          <dd>{wordCount}</dd>\n        </div>\n        <div class="stat">\n          <dt>Published:</dt>\n          <dd>\n            <time datetime="{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}">\n              {YYYY}-{MM}-{DD}\n            </time>\n          </dd>\n        </div>\n        <div class="stat">\n          <dt>Source:</dt>\n          <dd class="source">\n            <a class="source-link" href="{url}">{url}</a>\n          </dd>\n        </div>\n      </dl>\n      <div class="content">\n        {story}\n        <hr />\n        {description}\n      </div>\n    </main>\n  </body>\n</html>\n',
        metas: Object.keys(new InkbunnyWriting()),
        related: [{ option: 'writing', value: 'html' }],
    },
    writingText: {
        type: 'textarea',
        label: 'Writing text template',
        default:
            '{title}\nby {userName}\n\nWords:     {wordCount}\nPublished: {YYYY}-{MM}-{DD} {hh}:{mm}:{ss}\nSource:    {url}\n\n--------------------------------------------------------------------------------\n\n{story}\n\n--------------------------------------------------------------------------------\n\n{description}',
        metas: Object.keys(new InkbunnyWriting()),
        related: [{ option: 'writing', value: 'txt' }],
    },
} satisfies SiteForm;
type InkbunnyOptionsValues = SiteOptions<typeof inkbunny_form>;

type InkbunnyFileMeta = Pick<InkbunnyFile, 'fileName' | 'fileId' | 'ext'>;
type InkbunnyFileData = FileData<InkbunnyFileMeta>;
type InkbunnySubmissionMeta = Omit<InkbunnyFile, keyof InkbunnyFileMeta>;
type InkbunnySubmissionData = SubmissionData<InkbunnySubmissionMeta>;
