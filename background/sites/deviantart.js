"use strict";
//---------------------------------------------------------------------------------------------------------------------
// deviantart
//---------------------------------------------------------------------------------------------------------------------
const deviantart_info = {
    site: 'deviantart',
    label: 'DeviantArt',
    links: {
        main: 'https://www.deviantart.com',
        user: (u) => `https://www.deviantart.com/${u}`,
        gallery: (u) => `https://www.deviantart.com/${u}/gallery/all`,
        favorites: (u) => `https://www.deviantart.com/${u}/favourites/all`,
        submission: (s) => `https://www.deviantart.com/deviation/${s}`,
    },
    id_type: 'number',
};
class DeviantartUserFolder {
    site = '';
    userName = '';
    userId = '';
}
class DeviantartFile extends DeviantartUserFolder {
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
class DeviantartMultiple extends DeviantartFile {
    page = '';
}
class DeviantartLiterature extends DeviantartFile {
    url = '';
    wordCount = '';
    story = '';
    description = '';
}
class StashFile extends DeviantartFile {
    urlId = '';
}
class StashLiterature extends DeviantartLiterature {
    urlId = '';
}
const deviantart_form = {
    enabled: {
        type: 'checkbox',
        label: 'Enabled',
        default: true,
    },
    userFolder: {
        type: 'textarea',
        label: 'User folder',
        default: 'Saved/{site}/{userName}/',
        metas: Object.keys(new DeviantartUserFolder()),
    },
    file: {
        type: 'textarea',
        label: 'Save file as',
        default: 'Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}',
        metas: Object.keys(new DeviantartFile()),
    },
    multiple: {
        type: 'textarea',
        label: 'Save multiple files as',
        default: 'Saved/{site}/{userName}/{submissionId}/{submissionId}_{title}_{page}_by_{userName}.{ext}',
        metas: Object.keys(new DeviantartMultiple()),
    },
    larger: {
        type: 'checkbox',
        label: 'Try to download larger images',
        default: false,
    },
    literature: {
        type: 'select',
        label: 'Save literature as',
        options: [
            { value: 'html', label: 'HTML' },
            { value: 'txt', label: 'Text' },
        ],
        default: 'html',
    },
    includeImage: {
        type: 'checkbox',
        label: 'Include the main story image',
        default: true,
        related: [{ option: 'literature', value: 'html' }],
    },
    embedImages: {
        type: 'checkbox',
        label: 'Embed images in the HTML file',
        default: false,
        related: [{ option: 'literature', value: 'html' }],
    },
    literatureHTML: {
        type: 'textarea',
        label: 'Literature HTML template',
        default: '<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <style type="text/css">\n      .stat,\n      .stats {\n        display: flex;\n      }\n      .source,\n      .stat {\n        text-overflow: ellipsis;\n        overflow: hidden;\n      }\n      .author-link,\n      .source-link,\n      .title,\n      b,\n      strong {\n        font-weight: 700;\n      }\n      .source,\n      .stat {\n        overflow: hidden;\n      }\n      :root {\n        font-family: Verdana, Geneva, Tahoma, sans-serif;\n      }\n      * {\n        margin: 0;\n        padding: 0;\n        font: inherit;\n      }\n      *,\n      ::after,\n      ::before {\n        box-sizing: border-box;\n      }\n      body {\n        min-height: 100vh;\n        background-color: #e7ede4;\n        color: #0c0c0c;\n      }\n      img,\n      picture,\n      svg,\n      video {\n        max-width: 100%;\n        display: block;\n      }\n      em,\n      i {\n        font-style: italic;\n      }\n      .main {\n        width: 100%;\n        max-width: 48rem;\n        margin-inline: auto;\n        padding-inline: 1rem;\n      }\n      .header {\n        margin-block: 0.75rem;\n      }\n      .title {\n        font-size: 2.5rem;\n        margin-block-end: 0.5rem;\n      }\n      .author {\n        color: #314537;\n      }\n      .author-link {\n        text-decoration: none;\n        color: #0c0c0c;\n      }\n      .author-link:hover,\n      .source-link:hover {\n        color: #2c87a5;\n      }\n      .stats {\n        color: #314537;\n        font-size: 0.9rem;\n        flex-wrap: wrap;\n        column-gap: 0.75rem;\n        margin-block-end: 1rem;\n      }\n      .stat {\n        gap: 0.25rem;\n        white-space: nowrap;\n        max-width: 100%;\n      }\n      .source-link {\n        color: #0c0c0c;\n      }\n      .content section {\n        overflow: hidden;\n        white-space: pre-wrap;\n      }\n      #image,\n      .content section p {\n        margin-block: 1rem;\n      }\n      .separator {\n        margin-block: 1.5rem;\n      }\n    </style>\n  </head>\n  <body>\n    <main class="main">\n      <header class="header">\n        <h1 class="title">{title}</h1>\n        <p class="author">\n          by\n          <a class="author-link" href="https://www.deviantart.com/{userName}">\n            {userName}\n          </a>\n        </p>\n      </header>\n      <dl class="stats">\n        <div class="stat">\n          <dt>Words:</dt>\n          <dd>{wordCount}</dd>\n        </div>\n        <div class="stat">\n          <dt>Published:</dt>\n          <dd>\n            <time datetime="{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}">\n              {YYYY}-{MM}-{DD}\n            </time>\n          </dd>\n        </div>\n        <div class="stat">\n          <dt>Source:</dt>\n          <dd class="source">\n            <a class="source-link" href="{url}">{url}</a>\n          </dd>\n        </div>\n      </dl>\n      <div class="content">\n        {story}\n        <hr />\n        {description}\n      </div>\n    </main>\n  </body>\n</html>\n',
        metas: Object.keys(new DeviantartLiterature()),
        related: [{ option: 'literature', value: 'html' }],
    },
    literatureText: {
        type: 'textarea',
        label: 'Literature text template',
        default: '{title}\nby {userName}\n\nWords:     {wordCount}\nPublished: {YYYY}-{MM}-{DD} {hh}:{mm}:{ss}\nSource:    {url}\n\n--------------------------------------------------------------------------------\n\n{story}\n\n--------------------------------------------------------------------------------\n\n{description}',
        metas: Object.keys(new DeviantartLiterature()),
        related: [{ option: 'literature', value: 'txt' }],
    },
    stash: {
        type: 'checkbox',
        label: 'Download stash links in description',
        default: false,
    },
    stashFile: {
        type: 'textarea',
        label: 'Save stash file as',
        default: 'Saved/{site}/{userName}/{submissionId^}_{title^}/{title}_by_{userName}_{urlId}.{ext}',
        metas: Object.keys(new StashFile()),
        related: [{ option: 'stash', value: true }],
    },
    moveFile: {
        type: 'checkbox',
        label: 'Save submission file in stash folder',
        default: false,
        related: [{ option: 'stash', value: true }],
    },
    stashLiteratureHTML: {
        type: 'textarea',
        label: 'Stash literature HTML template',
        default: '<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <style type="text/css">\n      .stat,\n      .stats {\n        display: flex;\n      }\n      .source,\n      .stat {\n        text-overflow: ellipsis;\n        overflow: hidden;\n      }\n      .author-link,\n      .source-link,\n      .title,\n      b,\n      strong {\n        font-weight: 700;\n      }\n      .source,\n      .stat {\n        overflow: hidden;\n      }\n      :root {\n        font-family: Verdana, Geneva, Tahoma, sans-serif;\n      }\n      * {\n        margin: 0;\n        padding: 0;\n        font: inherit;\n      }\n      *,\n      ::after,\n      ::before {\n        box-sizing: border-box;\n      }\n      body {\n        min-height: 100vh;\n        background-color: #e7ede4;\n        color: #0c0c0c;\n      }\n      img,\n      picture,\n      svg,\n      video {\n        max-width: 100%;\n        display: block;\n      }\n      em,\n      i {\n        font-style: italic;\n      }\n      .main {\n        width: 100%;\n        max-width: 48rem;\n        margin-inline: auto;\n        padding-inline: 1rem;\n      }\n      .header {\n        margin-block: 0.75rem;\n      }\n      .title {\n        font-size: 2.5rem;\n        margin-block-end: 0.5rem;\n      }\n      .author {\n        color: #314537;\n      }\n      .author-link {\n        text-decoration: none;\n        color: #0c0c0c;\n      }\n      .author-link:hover,\n      .source-link:hover {\n        color: #2c87a5;\n      }\n      .stats {\n        color: #314537;\n        font-size: 0.9rem;\n        flex-wrap: wrap;\n        column-gap: 0.75rem;\n        margin-block-end: 1rem;\n      }\n      .stat {\n        gap: 0.25rem;\n        white-space: nowrap;\n        max-width: 100%;\n      }\n      .source-link {\n        color: #0c0c0c;\n      }\n      .content section {\n        overflow: hidden;\n        white-space: pre-wrap;\n      }\n      #image,\n      .content section p {\n        margin-block: 1rem;\n      }\n      .separator {\n        margin-block: 1.5rem;\n      }\n    </style>\n  </head>\n  <body>\n    <main class="main">\n      <header class="header">\n        <h1 class="title">{title}</h1>\n        <p class="author">\n          by\n          <a class="author-link" href="https://www.deviantart.com/{userName}">\n            {userName}\n          </a>\n        </p>\n      </header>\n      <dl class="stats">\n        <div class="stat">\n          <dt>Words:</dt>\n          <dd>{wordCount}</dd>\n        </div>\n        <div class="stat">\n          <dt>Published:</dt>\n          <dd>\n            <time datetime="{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}">\n              {YYYY}-{MM}-{DD}\n            </time>\n          </dd>\n        </div>\n        <div class="stat">\n          <dt>Source:</dt>\n          <dd class="source">\n            <a class="source-link" href="{url}">{url}</a>\n          </dd>\n        </div>\n      </dl>\n      <div class="content">\n        {story}\n        <hr />\n        {description}\n      </div>\n    </main>\n  </body>\n</html>\n',
        metas: Object.keys(new StashLiterature()),
        related: [
            { option: 'stash', value: true },
            { option: 'literature', value: 'html' },
        ],
    },
    stashLiteratureText: {
        type: 'textarea',
        label: 'Stash literature text template',
        default: '{title}\nby {userName}\n\nWords:     {wordCount}\nPublished: {YYYY}-{MM}-{DD} {hh}:{mm}:{ss}\nSource:    {url}\n\n--------------------------------------------------------------------------------\n\n{story}\n\n--------------------------------------------------------------------------------\n\n{description}',
        metas: Object.keys(new StashLiterature()),
        related: [
            { option: 'stash', value: true },
            { option: 'literature', value: 'txt' },
        ],
    },
};
