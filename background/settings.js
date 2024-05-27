//Make sure to reload extension

//---------------------------------------------------------------------------------------------------------------------
// ui states
//---------------------------------------------------------------------------------------------------------------------

const popup_state = {
	tab: 'user',
	downloadLock: true
};

const infobar_state = {
	showFolders: false
};

const settings_state = {
	tab: 'global'
};

const UISTATES = {
	popup: popup_state,
	infobar: infobar_state,
	settings: settings_state
};

//---------------------------------------------------------------------------------------------------------------------
// global options
//---------------------------------------------------------------------------------------------------------------------

const GLOBALOPTIONS = {
	theme: {
		type: 'select',
		label: 'Theme',
		options: [
			{ value: 'preferred', label: 'Preferred' },
			{ value: 'light', label: 'Light' },
			{ value: 'dark', label: 'Dark' }
		],
		default: 'preferred'
	},
	conflict: {
		type: 'select',
		label: 'File conflict',
		options: [
			{ value: 'overwrite', label: 'Overwrite' },
			{ value: 'uniquify', label: 'Uniquify' }
		],
		default: 'overwrite'
	},
	replace: {
		type: 'checkbox',
		label: 'Replace spaces with underscore',
		default: true
	},
	saveAs: {
		type: 'checkbox',
		label: 'Open Save As prompt when downloading a file',
		default: false
	},
	iconSize: {
		type: 'number',
		label: 'Icons size',
		min: 0,
		unit: 'px',
		default: 16
	},
	addScreen: {
		type: 'checkbox',
		label: 'Add screen over saved thumbnails',
		default: false
	},
	screenOpacity: {
		type: 'slider',
		label: 'Screen opacity',
		min: 0,
		max: 100,
		unit: '%',
		default: 50,
		related: [{ option: 'addScreen', value: true }]
	},
	useQueue: {
		type: 'checkbox',
		label: 'Download submissions using a queue',
		default: false
	},
	queueConcurrent: {
		type: 'number',
		label: 'Concurrent downloads',
		min: 1,
		default: 1,
		related: [{ option: 'useQueue', value: true }]
	},
	queueWait: {
		type: 'number',
		label: 'Wait time between downloads',
		min: 0,
		unit: 'seconds',
		default: 0,
		related: [{ option: 'useQueue', value: true }]
	},
	infoBar: {
		type: 'checkbox',
		label: 'Show page info bar',
		default: false
	}
};

//---------------------------------------------------------------------------------------------------------------------
// deviantart
//---------------------------------------------------------------------------------------------------------------------

const deviantart_info = {
	site: 'deviantart',
	label: 'DeviantArt',
	helplink: 'https://github.com/solorey/Art-Saver/wiki/DeviantArt',
	links: {
		main: 'https://www.deviantart.com',
		user: (userName) => `https://www.deviantart.com/${userName}`,
		gallery: (userName) => `https://www.deviantart.com/${userName}/gallery/all`,
		favorites: (userName) => `https://www.deviantart.com/${userName}/favourites/all`,
		submission: (submissionId) => `https://www.deviantart.com/deviation/${submissionId}`
	},
	idType: 'integer'
};

const deviantart_options = {
	userFolder: {
		type: 'textarea',
		label: 'User folder',
		default: 'Saved/{site}/{userName}/',
		metas: ['site', 'userName']
	},
	file: {
		type: 'textarea',
		label: 'Save file as',
		default: 'Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	},
	larger: {
		type: 'checkbox',
		label: 'Try to download larger images',
		default: false
	},
	literature: {
		type: 'select',
		label: 'Save literature as',
		options: [
			{ value: 'html', label: 'HTML' },
			{ value: 'txt', label: 'Text' }
		],
		default: 'html'
	},
	includeImage: {
		type: 'checkbox',
		label: 'Include the main story image',
		default: true,
		related: [{ option: 'literature', value: 'html' }]
	},
	embedImages: {
		type: 'checkbox',
		label: 'Embed images in the HTML file',
		default: false,
		related: [{ option: 'literature', value: 'html' }]
	},
	literatureHTML: {
		type: 'textarea',
		label: 'Literature HTML template',
		default: "<!DOCTYPE html>\n<html>\n\n<head>\n\t<meta charset=\"utf-8\" />\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n\t<style type=\"text/css\">\n\t\timg {\n\t\t\tmax-width: 100%;\n\t\t\tmax-height: 100vh;\n\t\t}\n\n\t\t#content,\n\t\t#description {\n\t\t\ttext-align: justify;\n\t\t\toverflow: hidden;\n\t\t}\n\n\t\t#image {\n\t\t\ttext-align: center;\n\t\t}\n\t</style>\n</head>\n\n<body>\n\t<h1>{title}</h1>\n\t<h3>by <a href=\"https://www.deviantart.com/{userName}\">{userName}</a></h3>\n\t<dl>\n\t\t<dt>Words:</dt>\n\t\t<dd>{wordCount}</dd>\n\t\t<dt>Published:</dt>\n\t\t<dd>{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}</dd>\n\t\t<dt>Source:</dt>\n\t\t<dd><a href=\"{url}\">{url}</a></dd>\n\t</dl>\n\t<hr>\n\t{story}\n\t<br />\n\t<hr />\n\t<br />\n\t{description}\n</body>\n\n</html>",
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', 'url', 'story', 'wordCount', 'description'],
		related: [{ option: 'literature', value: 'html' }]
	},
	literatureText: {
		type: 'textarea',
		label: 'Literature text template',
		default: "{title}\nby {userName}\n\nWords:     {wordCount}\nPublished: {YYYY}-{MM}-{DD} {hh}:{mm}:{ss}\nSource:    {url}\n\n--------------------------------------------------------------------------------\n\n{story}\n\n--------------------------------------------------------------------------------\n\n{description}",
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', 'url', 'story', 'wordCount', 'description'],
		related: [{ option: 'literature', value: 'txt' }]
	},
	stash: {
		type: 'checkbox',
		label: 'Download stash links in description',
		default: false
	},
	stashFile: {
		type: 'textarea',
		label: 'Save stash file as',
		default: 'Saved/{site}/{userName}/{submissionId}_{title}/{stashTitle}_by_{stashUserName}_{stashUrlId}.{stashExt}',
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', 'stashUrlId', 'stashUserName', 'stashTitle', 'stashSubmissionId', 'stashFileName', 'stashExt', 'stashYYYY', 'stashMM', 'stashDD', 'stashhh', 'stashmm', 'stashss'],
		related: [{ option: 'stash', value: true }]
	},
	moveFile: {
		type: 'checkbox',
		label: 'Save submission file in stash folder',
		default: false,
		related: [{ option: 'stash', value: true }]
	},
	stashLiteratureHTML: {
		type: 'textarea',
		label: 'Stash literature HTML template',
		default: "<!DOCTYPE html>\n<html>\n\n<head>\n\t<meta charset=\"utf-8\" />\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n\t<style type=\"text/css\">\n\t\timg {\n\t\t\tmax-width: 100%;\n\t\t\tmax-height: 100vh;\n\t\t}\n\n\t\t#content,\n\t\t#description {\n\t\t\ttext-align: justify;\n\t\t\toverflow: hidden;\n\t\t}\n\n\t\t#image {\n\t\t\ttext-align: center;\n\t\t}\n\t</style>\n</head>\n\n<body>\n\t<h1>{stashTitle}</h1>\n\t<h3>by <a href=\"https://www.deviantart.com/{stashUserName}\">{stashUserName}</a></h3>\n\t<dl>\n\t\t<dt>Words:</dt>\n\t\t<dd>{wordCount}</dd>\n\t\t<dt>Published:</dt>\n\t\t<dd>{stashYYYY}-{stashMM}-{stashDD} {stashhh}:{stashmm}:{stashss}</dd>\n\t\t<dt>Source:</dt>\n\t\t<dd><a href=\"{stashUrl}\">{stashUrl}</a></dd>\n\t\t<dt>From:</dt>\n\t\t<dd><a href=\"{url}\">{url}</a></dd>\n\t</dl>\n\t<hr>\n\t{story}\n\t<br />\n\t<hr />\n\t<br />\n\t{stashDescription}\n</body>\n\n</html>",
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', 'stashUrlId', 'stashUserName', 'stashTitle', 'stashSubmissionId', 'stashFileName', 'stashExt', 'stashYYYY', 'stashMM', 'stashDD', 'stashhh', 'stashmm', 'stashss', 'url', 'stashUrl', 'story', 'wordCount', 'stashDescription'],
		related: [
			{ option: 'stash', value: true },
			{ option: 'literature', value: 'html' }
		]
	},
	stashLiteratureText: {
		type: 'textarea',
		label: 'Stash literature text template',
		default: "{stashTitle}\nby {stashUserName}\n\nWords:     {wordCount}\nPublished: {stashYYYY}-{stashMM}-{stashDD} {stashhh}:{stashmm}:{stashss}\nSource:    {stashUrl}\nFrom:      {url}\n\n--------------------------------------------------------------------------------\n\n{story}\n\n--------------------------------------------------------------------------------\n\n{stashDescription}",
		metas: ['site', 'userName', 'title', 'submissionId', 'submissionId36', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', 'stashUrlId', 'stashUserName', 'stashTitle', 'stashSubmissionId', 'stashFileName', 'stashExt', 'stashYYYY', 'stashMM', 'stashDD', 'stashhh', 'stashmm', 'stashss', 'url', 'stashUrl', 'story', 'wordCount', 'stashDescription'],
		related: [
			{ option: 'stash', value: true },
			{ option: 'literature', value: 'txt' }
		]
	}
};

//---------------------------------------------------------------------------------------------------------------------
// twitter
//---------------------------------------------------------------------------------------------------------------------

const twitter_info = {
	site: 'twitter',
	label: 'X (Twitter)',
	helplink: 'https://github.com/solorey/Art-Saver/wiki/Twitter',
	links: {
		main: 'https://twitter.com',
		user: (userId) => `https://twitter.com/${userId}`,
		gallery: (userId) => `https://twitter.com/${userId}/media`,
		favorites: (userId) => `https://twitter.com/${userId}/likes`,
		submission: (submissionId) => `https://twitter.com/i/web/status/${submissionId}`
	},
	idType: 'bigint'
};

const twitter_options = {
	userFolder: {
		type: 'textarea',
		label: 'User folder',
		default: 'Saved/{site}/{userId}/',
		metas: ['site', 'userName', 'userId']
	},
	file: {
		type: 'textarea',
		label: 'Save file as',
		default: 'Saved/{site}/{userId}/{submissionId}_by_{userId}.{ext}',
		metas: ['site', 'userName', 'userId', 'submissionId', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	},
	multiple: {
		type: 'textarea',
		label: 'Save multiple files as',
		default: 'Saved/{site}/{userId}/{submissionId}/{submissionId}_{page}_by_{userId}.{ext}',
		metas: ['site', 'userName', 'userId', 'submissionId', 'fileName', 'page', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	}
};

//---------------------------------------------------------------------------------------------------------------------
// pixiv
//---------------------------------------------------------------------------------------------------------------------

const pixiv_info = {
	site: 'pixiv',
	label: 'Pixiv',
	helplink: 'https://github.com/solorey/Art-Saver/wiki/Pixiv',
	links: {
		main: 'https://www.pixiv.net',
		user: (userId) => `https://www.pixiv.net/users/${userId}`,
		gallery: (userId) => `https://www.pixiv.net/users/${userId}/artworks`,
		favorites: (userId) => `https://www.pixiv.net/users/${userId}/bookmarks/artworks`,
		submission: (submissionId) => `https://www.pixiv.net/artworks/${submissionId}`
	},
	idType: 'integer'
};

const pixiv_options = {
	userFolder: {
		type: 'textarea',
		label: 'User folder',
		default: 'Saved/{site}/{userName}_{userId}/',
		metas: ['site', 'userName', 'userId']
	},
	file: {
		type: 'textarea',
		label: 'Save file as',
		default: 'Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'userId', 'title', 'submissionId', 'fileName', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	},
	multiple: {
		type: 'textarea',
		label: 'Save multiple files as',
		default: 'Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'userId', 'title', 'submissionId', 'fileName', 'page', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	},
	ugoira: {
		type: 'select',
		label: 'Save uqoira as',
		options: [
			{ value: 'multiple', label: 'Multiple files' },
			{ value: 'zip', label: 'ZIP' },
			{ value: 'apng', label: 'APNG' },
			{ value: 'gif', label: 'GIF' },
			{ value: 'webm', label: 'WEBM' }
		],
		default: 'multiple'
	}
};

//---------------------------------------------------------------------------------------------------------------------
// furaffinity
//---------------------------------------------------------------------------------------------------------------------

const furaffinity_info = {
	site: 'furaffinity',
	label: 'Fur Affinity',
	helplink: 'https://github.com/solorey/Art-Saver/wiki/Fur-Affinity',
	links: {
		main: 'https://www.furaffinity.net/',
		user: (userLower) => `https://www.furaffinity.net/user/${userLower}`,
		gallery: (userLower) => `https://www.furaffinity.net/gallery/${userLower}`,
		favorites: (userLower) => `https://www.furaffinity.net/favorites/${userLower}`,
		submission: (submissionId) => `https://www.furaffinity.net/view/${submissionId}`
	}
};

const furaffinity_options = {
	userFolder: {
		type: 'textarea',
		label: 'User folder',
		default: 'Saved/{site}/{userLower}/',
		metas: ['site', 'userName', 'userLower']
	},
	file: {
		type: 'textarea',
		label: 'Save file as',
		default: 'Saved/{site}/{userLower}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'userLower', 'title', 'submissionId', 'fileName', 'fileId', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	}
};

//---------------------------------------------------------------------------------------------------------------------
// inkbunny
//---------------------------------------------------------------------------------------------------------------------

const inkbunny_info = {
	site: 'inkbunny',
	label: 'Inkbunny',
	helplink: 'https://github.com/solorey/Art-Saver/wiki/Inkbunny',
	links: {
		main: 'https://inkbunny.net',
		user: (userName) => `https://inkbunny.net/${userName}`,
		gallery: (userName) => `https://inkbunny.net/gallery/${userName}`,
		favorites: (userName) => `https://inkbunny.net/submissionsviewall.php?mode=search&favsby=${userName}`,
		submission: (submissionId) => `https://inkbunny.net/s/${submissionId}`
	},
	idType: 'integer'
};

const inkbunny_options = {
	userFolder: {
		type: 'textarea',
		label: 'User folder',
		default: 'Saved/{site}/{userName}/',
		metas: ['site', 'userName', 'userId']
	},
	file: {
		type: 'textarea',
		label: 'Save file as',
		default: 'Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'userId', 'title', 'submissionId', 'fileName', 'fileId', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	},
	multiple: {
		type: 'textarea',
		label: 'Save multiple files as',
		default: 'Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}',
		metas: ['site', 'userName', 'userId', 'title', 'submissionId', 'fileName', 'fileId', 'page', 'ext', 'YYYY', 'MM', 'DD', 'hh', 'mm', 'ss']
	}
};

//---------------------------------------------------------------------------------------------------------------------
// settings constants
//---------------------------------------------------------------------------------------------------------------------

const SITEOPTIONS = {
	deviantart: deviantart_options,
	twitter: twitter_options,
	pixiv: pixiv_options,
	furaffinity: furaffinity_options,
	inkbunny: inkbunny_options
};

const SITEINFO = {
	deviantart: deviantart_info,
	twitter: twitter_info,
	pixiv: pixiv_info,
	furaffinity: furaffinity_info,
	inkbunny: inkbunny_info
};

const SITES = [...Object.keys(SITEINFO)];
const SITESSAVEDKEYS = SITES.map(savedKey);
const SITESOPTIONSKEYS = SITES.map(optionsKey);

const ALLOPTIONS = {
	global: GLOBALOPTIONS,
	...SITEOPTIONS
}
const ALLOPTIONSKEYS = [optionsKey('global'), ...SITESOPTIONSKEYS];