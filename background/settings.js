//Make sure to reload extension
const popup_state = {
	tab: "user",
	downloadLock: true
};

const infobar_state = {
	showFolders: false
};

const settings_state = {
	tab: "global"
};

const UISTATES = {
	popup: popup_state,
	infobar: infobar_state,
	settings: settings_state
};

const stateKey = (s) => `${s}_state`;

const GLOBALOPTIONS = {
	conflict: {
		type: "select",
		label: "File conflict",
		options: [
			{value: "overwrite", label: "Overwrite"},
			{value: "uniquify", label: "Uniquify"}
		],
		default: "overwrite"
	},
	replace: {
		type: "checkbox",
		label: "Replace spaces with underscore",
		default: true
	},
	saveAs: {
		type: "checkbox",
		label: "Open Save As prompt when downloading a file",
		default: false
	},
	iconSize: {
		type: "number",
		label: "Icons size",
		min: 0,
		unit: "px",
		default: 16
	},
	addScreen: {
		type: "checkbox",
		label: "Add screen over saved thumbnails",
		default: false
	},
	screenOpacity: {
		type: "slider",
		label: "Screen opacity",
		min: 0,
		max: 100,
		unit: "%",
		default: 50,
		related: [{option: "addScreen", value: true}]
	},
	useQueue: {
		type: "checkbox",
		label: "Download submissions using a queue",
		default: false
	},
	queueConcurrent: {
		type: "number",
		label: "Concurrent downloads",
		min: 1,
		default: 1,
		related: [{option: "useQueue", value: true}]
	},
	queueWait: {
		type: "number",
		label: "Wait time between downloads",
		min: 0,
		unit: "seconds",
		default: 0,
		related: [{option: "useQueue", value: true}]
	},
	infoBar: {
		type: "checkbox",
		label: "Show page info bar",
		default: false
	}
};

const deviantart_options = {
	userFolder: {
		type: "textarea",
		label: "User folder",
		default: "Saved/{site}/{userName}/",
		metas: ["site", "userName"]
	},
	file: {
		type: "textarea",
		label: "Save file as",
		default: "Saved/{site}/{userName}/{submissionId}_{title}_by_{userName}.{ext}",
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	},
	larger: {
		type: "checkbox",
		label: "Try to download larger images",
		default: false
	},
	literature: {
		type: "select",
		label: "Save literature as",
		options: [
			{value: "html", label: "HTML"},
			{value: "txt", label: "Text"}
		],
		default: "html"
	},
	includeImage: {
		type: "checkbox",
		label: "Include the main story image",
		default: true,
		related: [{option: "literature", value: "html"}]
	},
	embedImages: {
		type: "checkbox",
		label: "Embed images in the html file",
		default: false,
		related: [{option: "literature", value: "html"}]
	},
	literatureHTML: {
		type: "textarea",
		label: "Literature HTML template",
		default: `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
		<style type="text/css">
			img {max-width: 100%; max-height: 100vh;}
			#content, #description {text-align: justify; overflow: hidden;}
			#image {text-align: center;}
		</style>
	</head>
	<body>
		<h1>{title}</h1>
		<h3>by <a href="https://www.deviantart.com/{userName}">{userName}</a></h3>
		<dl>
			<dt>Words:</dt>
			<dd>{wordCount}</dd>
			<dt>Published:</dt>
			<dd>{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}</dd>
			<dt>Source:</dt>
			<dd><a href="{url}">{url}</a></dd>
		</dl>
		<hr>
		{story}
		<br/>
		<hr/>
		<br/>
		{description}
	</body>
</html>`,
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "url", "story", "wordCount", "description"],
		related: [{option: "literature", value: "html"}]
	},
	literatureText: {
		type: "textarea",
		label: "Literature text template",
		default: `{title}
by {userName}

Words:     {wordCount}
Published: {YYYY}-{MM}-{DD} {hh}:{mm}:{ss}
Source:    {url}

--------------------------------------------------------------------------------

{story}

--------------------------------------------------------------------------------

{description}`,
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "url", "story", "wordCount", "description"],
		related: [{option: "literature", value: "txt"}]
	},
	stash: {
		type: "checkbox",
		label: "Download stash links in description",
		default: false
	},
	stashFile: {
		type: "textarea",
		label: "Save stash file as",
		default: "Saved/{site}/{userName}/{submissionId}_{title}/{stashTitle}_by_{stashUserName}_{stashUrlId}.{stashExt}",
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "stashUrlId", "stashUserName", "stashTitle", "stashSubmissionId", "stashFileName", "stashExt", "stashYYYY", "stashMM", "stashDD", "stashhh", "stashmm", "stashss"],
		related: [{option: "stash", value: true}]
	},
	moveFile: {
		type: "checkbox",
		label: "Save submission file in stash folder",
		default: false,
		related: [{option: "stash", value: true}]
	},
	stashLiteratureHTML: {
		type: "textarea",
		label: "Stash literature HTML template",
		default: `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
		<style type="text/css">
			img {max-width: 100%; max-height: 100vh;}
			#content, #description {text-align: justify; overflow: hidden;}
			#image {text-align: center;}
		</style>
	</head>
	<body>
		<h1>{stashTitle}</h1>
		<h3>by <a href="https://www.deviantart.com/{stashUserName}">{stashUserName}</a></h3>
		<dl>
			<dt>Words:</dt>
			<dd>{wordCount}</dd>
			<dt>Published:</dt>
			<dd>{stashYYYY}-{stashMM}-{stashDD} {stashhh}:{stashmm}:{stashss}</dd>
			<dt>Source:</dt>
			<dd><a href="{stashUrl}">{stashUrl}</a></dd>
			<dt>From:</dt>
			<dd><a href="{url}">{url}</a></dd>
		</dl>
		<hr>
		{story}
		<br/>
		<hr/>
		<br/>
		{stashDescription}
	</body>
</html>`,
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "stashUrlId", "stashUserName", "stashTitle", "stashSubmissionId", "stashFileName", "stashExt", "stashYYYY", "stashMM", "stashDD", "stashhh", "stashmm", "stashss", "url", "stashUrl", "story", "wordCount", "stashDescription"],
		related: [
			{option: "stash", value: true},
			{option: "literature", value: "html"}
		]
	},
	stashLiteratureText: {
		type: "textarea",
		label: "Stash literature text template",
		default: `{stashTitle}
by {stashUserName}

Words:     {wordCount}
Published: {stashYYYY}-{stashMM}-{stashDD} {stashhh}:{stashmm}:{stashss}
Source:    {stashUrl}
From:      {url}

--------------------------------------------------------------------------------

{story}

--------------------------------------------------------------------------------

{stashDescription}`,
		metas: ["site", "userName", "title", "submissionId", "submissionId36", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss", "stashUrlId", "stashUserName", "stashTitle", "stashSubmissionId", "stashFileName", "stashExt", "stashYYYY", "stashMM", "stashDD", "stashhh", "stashmm", "stashss", "url", "stashUrl", "story", "wordCount", "stashDescription"],
		related: [
			{option: "stash", value: true},
			{option: "literature", value: "txt"}
		]
	}
};

const deviantart_info = {
	label: "DeviantArt",
	helplink: "https://github.com/solorey/Art-Saver/wiki/DeviantArt",
	links: {
		main: "https://www.deviantart.com",
		user: (userName) => `https://www.deviantart.com/${userName}`,
		gallery: (userName) => `https://www.deviantart.com/${userName}/gallery/all`,
		favorites: (userName) => `https://www.deviantart.com/${userName}/favourites/all`,
		submission: (submissionId) => `https://www.deviantart.com/deviation/${submissionId}`
	}
};

const pixiv_options = {
	userFolder: {
		type: "textarea",
		label: "User folder",
		default: "Saved/{site}/{userName}_{userId}/",
		metas: ["site", "userName", "userId"]
	},
	file: {
		type: "textarea",
		label: "Save file as",
		default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}_by_{userName}.{ext}",
		metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	},
	multiple: {
		type: "textarea",
		label: "Save multiple files as",
		default: "Saved/{site}/{userName}_{userId}/{submissionId}_{title}/{submissionId}_{title}_{page}_by_{userName}.{ext}",
		metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "page", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	},
	ugoira: {
		type: "select",
		label: "Save uqoira as",
		options: [
			{value: "multiple", label: "Multiple files"},
			{value: "zip", label: "ZIP"},
			{value: "apng", label: "APNG"},
			{value: "gif", label: "GIF"},
			{value: "webm", label: "WEBM"}
		],
		default: "multiple"
	}
};

const pixiv_info = {
	label: "Pixiv",
	helplink: "https://github.com/solorey/Art-Saver/wiki/Pixiv",
	links: {
		main: "https://www.pixiv.net",
		user: (userId) => `https://www.pixiv.net/users/${userId}/artworks`,
		gallery: (userId) => `https://www.pixiv.net/users/${userId}/artworks`,
		favorites: (userId) => `https://www.pixiv.net/users/${userId}/bookmarks/artworks`,
		submission: (submissionId) => `https://www.pixiv.net/artworks/${submissionId}`
	}
};

const furaffinity_options = {
	userFolder: {
		type: "textarea",
		label: "User folder",
		default: "Saved/{site}/{userLower}/",
		metas: ["site", "userName", "userLower"]
	},
	file: {
		type: "textarea",
		label: "Save file as",
		default: "Saved/{site}/{userLower}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
		metas: ["site", "userName", "userLower", "title", "submissionId", "fileName", "fileId", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	}
};

const furaffinity_info = {
	label: "Fur Affinity",
	helplink: "https://github.com/solorey/Art-Saver/wiki/Fur-Affinity",
	links: {
		main: "https://www.furaffinity.net/",
		user: (userLower) => `https://www.furaffinity.net/user/${userLower}`,
		gallery: (userLower) => `https://www.furaffinity.net/gallery/${userLower}`,
		favorites: (userLower) => `https://www.furaffinity.net/favorites/${userLower}`,
		submission: (submissionId) => `https://www.furaffinity.net/view/${submissionId}`
	}
};

const inkbunny_options = {
	userFolder: {
		type: "textarea",
		label: "User folder",
		default: "Saved/{site}/{userName}/",
		metas: ["site", "userName", "userId"]
	},
	file: {
		type: "textarea",
		label: "Save file as",
		default: "Saved/{site}/{userName}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
		metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	},
	multiple: {
		type: "textarea",
		label: "Save multiple files as",
		default: "Saved/{site}/{userName}/{submissionId}_{title}/{fileId}_{submissionId}_{title}_by_{userName}.{ext}",
		metas: ["site", "userName", "userId", "title", "submissionId", "fileName", "fileId", "page", "ext", "YYYY", "MM", "DD", "hh", "mm", "ss"]
	}
};

const inkbunny_info = {
	label: "Inkbunny",
	helplink: "https://github.com/solorey/Art-Saver/wiki/Inkbunny",
	links: {
		main: "https://inkbunny.net",
		user: (userName) => `https://inkbunny.net/${userName}`,
		gallery: (userName) => `https://inkbunny.net/gallery/${userName}`,
		favorites: (userName) => `https://inkbunny.net/submissionsviewall.php?mode=search&favsby=${userName}`,
		submission: (submissionId) => `https://inkbunny.net/s/${submissionId}`
	}
};

const SITEOPTIONS = {
	deviantart: deviantart_options,
	pixiv: pixiv_options,
	furaffinity: furaffinity_options,
	inkbunny: inkbunny_options
};

const SITEINFO = {
	deviantart: deviantart_info,
	pixiv: pixiv_info,
	furaffinity: furaffinity_info,
	inkbunny: inkbunny_info
};

const optionsKey = (s) => `${s}_options`;
const savedKey = (s) => `${s}_saved`;

const SITES = [...Object.keys(SITEINFO)];
const SITESSAVEDKEYS = SITES.map(savedKey);
const SITESOPTIONSKEYS = SITES.map(optionsKey);

const ALLOPTIONS = {
	global: GLOBALOPTIONS,
	...SITEOPTIONS
}
const ALLOPTIONSKEYS = [optionsKey("global"), ...SITESOPTIONSKEYS];