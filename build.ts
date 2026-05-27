import * as fs from 'node:fs/promises';
import { argv } from 'node:process';
import Handlebars from 'handlebars';
import pkg from './package.json' with { type: 'json' };

const args = argv.slice(2);
if (args.includes('--clean')) {
    await fs.rm('dist/', { recursive: true, force: true });
}

type ContentSite = {
    pattern: string;
    extra_js?: string[];
};
const sites: Record<string, ContentSite> = {
    deviantart: {
        pattern: '*://*.deviantart.com/*',
        extra_js: ['libs/purify.min.js', 'scripts/writing.js'],
    },
    newgrounds: {
        pattern: '*://*.newgrounds.com/*',
    },
    twitter: {
        pattern: '*://*.x.com/*',
    },
    bluesky: {
        pattern: '*://*.bsky.app/*',
    },
    itaku: {
        pattern: '*://*.itaku.ee/*',
    },
    pixiv: {
        pattern: '*://*.pixiv.net/*',
    },
    furaffinity: {
        pattern: '*://*.furaffinity.net/*',
    },
    inkbunny: {
        pattern: '*://*.inkbunny.net/*',
        extra_js: ['libs/purify.min.js', 'scripts/writing.js'],
    },
};

function siteBackground(site: string) {
    return `background/sites/${site}.js`;
}
function siteContent(site: string) {
    return `content/scripts/sites/${site}.js`;
}

const site_background_scripts = Object.keys(sites).map(siteBackground);
const site_patterns = Object.values(sites).map((s) => s.pattern);

const manfiest = {
    manifest_version: 3,
    name: 'Art Saver',
    version: pkg.version,
    description: 'Easily download and track downloads in supported art gallery websites.',
    homepage_url: pkg.homepage,
    browser_specific_settings: {
        gecko: {
            id: '{d1af7113-37c0-495e-8396-ee18861346c7}',
            strict_min_version: '131.0',
            data_collection_permissions: {
                required: ['none'],
            },
        },
    },
    options_ui: {
        page: 'options/options.html',
        open_in_tab: true,
    },
    background: {
        scripts: [
            'libs/gif.js',
            'libs/gif.worker.js',
            'libs/UPNG.js',
            'libs/UZIP.js',
            'libs/whammy.js',
            'scripts/storage.js',
            ...site_background_scripts,
            'background/settings.js',
            'background/background.js',
            'background/worker.js',
        ],
    },
    icons: {
        '16': 'icons/icon_16.svg',
        '48': 'icons/icon.svg',
    },
    action: {
        default_popup: 'popup/popup.html',
    },
    commands: {
        _execute_action: {
            suggested_key: {},
            description: 'Activate toolbar button',
        },
    },
    permissions: ['downloads', 'storage'],
    host_permissions: ['*://*/*'],
    web_accessible_resources: [
        {
            matches: site_patterns,
            resources: ['icons/*', 'content/ui/*', 'content/styles/*', 'styles/*'],
        },
    ],
    content_scripts: [
        ...Object.entries(sites).map(([site, s]) => ({
            matches: [s.pattern],
            js: [...(s.extra_js ?? []), siteBackground(site), siteContent(site)],
        })),
        {
            matches: site_patterns,
            js: ['scripts/storage.js', 'scripts/shortcuts.js', 'content/scripts/classes.js', 'content/scripts/main.js'],
        },
    ],
};

async function getTemplate(path: string) {
    const contents = await fs.readFile(path, { encoding: 'utf8' });
    return Handlebars.compile(contents);
}

const [page_template, options_template, popup_template, info_bar_template, tool_tip_template] = await Promise.all([
    getTemplate('src/page.handlebars'),
    getTemplate('src/options/options.handlebars'),
    getTemplate('src/popup/popup.handlebars'),
    getTemplate('src/content/ui/info_bar.handlebars'),
    getTemplate('src/content/ui/tool_tip.handlebars'),
    fs.mkdir('dist/options/', { recursive: true }),
    fs.mkdir('dist/popup/', { recursive: true }),
    fs.mkdir('dist/content/ui/', { recursive: true }),
]);
await Promise.all([
    fs.writeFile('dist/manifest.json', JSON.stringify(manfiest, undefined, 4)),
    fs.cp('icons/', 'dist/icons/', { recursive: true }),
    fs.cp('libs/', 'dist/libs/', { recursive: true }),
    fs.writeFile(
        'dist/options/options.html',
        page_template({
            page: 'options',
            title: 'Art Saver Settings',
            scripts: ['scripts/shortcuts.js', ...site_background_scripts],
            body: options_template({}),
        }),
    ),
    fs.writeFile(
        'dist/popup/popup.html',
        page_template({
            page: 'popup',
            title: 'Art Saver Popup',
            scripts: ['libs/purify.min.js', ...site_background_scripts],
            body: popup_template({}),
        }),
    ),
    fs.writeFile('dist/content/ui/info_bar.html', info_bar_template({})),
    fs.writeFile('dist/content/ui/tool_tip.html', tool_tip_template({})),
]);
