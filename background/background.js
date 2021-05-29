browser.runtime.onInstalled.addListener(details => {
	initalSetup(details);
});

async function initalSetup(details){
	for (let state of Object.keys(UISTATES)){
		setState(state);
	}
	await setupOptions();
	if (details.reason === "install"){
		browser.runtime.openOptionsPage();
	}
}

//---------------------------------------------------------------------------------------------------------------------
// options functions
//---------------------------------------------------------------------------------------------------------------------

async function updateOldStorage(){
	browser.storage.local.remove(["popup", "infobar"]);
	let oldoptions = await browser.storage.local.get("options");
	if (Object.entries(oldoptions).length > 0){
		console.log("Old options exists. Updating option storage")
		for (let [key, values] of Object.entries(oldoptions.options)){
			//console.log(key, values);
			await browser.storage.local.set(Object.fromEntries([[optionsKey(key), values]]));
		}
		await browser.storage.local.remove("options");
	}
	let olduserlist = await browser.storage.local.get("userlist");
	if (Object.entries(olduserlist).length > 0){
		console.log("Old userlist exists. Updating saved information storage")
		for (let [key, values] of Object.entries(olduserlist.userlist)){
			//console.log(key, values);
			await browser.storage.local.set(Object.fromEntries([[savedKey(key), values]]));
		}
		await browser.storage.local.remove("userlist");
	}
	return;
}

async function setupOptions(){
	await updateOldStorage();
	let allsavedoptions = await browser.storage.local.get(ALLOPTIONSKEYS);

	let initaloptions = {}
	for (let site of Object.keys(ALLOPTIONS)){
		let sitekey = optionsKey(site);
		initaloptions[sitekey] = {};
		for (let [key, values] of Object.entries(ALLOPTIONS[site])){
			let initialvalue;
			if (!allsavedoptions[sitekey]){
				console.log("New site", site);
				allsavedoptions[sitekey] = {};
			}
			if (![...Object.keys(allsavedoptions[sitekey])].includes(key)){
				console.log(`New option ${site}.${key}`);
				initialvalue = values.default;
			}
			else {
				initialvalue = allsavedoptions[sitekey][key];
			}

			initaloptions[sitekey][key] = initialvalue;
		}
	}
	await browser.storage.local.set(initaloptions);
}

async function getOptions(){
	let res = await browser.storage.local.get("options");
	return updateOptions(res.options || {});
}

//if new settings have been added
function updateOptions(current){
	for (let s of settingsList()){
		if (!current[s.site]){
			current[s.site] = {};
		}
		if (!current[s.site][s.option]){
			current[s.site][s.option] = s.default;
		}
	}
	return current;
}

//---------------------------------------------------------------------------------------------------------------------
// state functions
//---------------------------------------------------------------------------------------------------------------------

async function setState(ui){
	let statekey = stateKey(ui);
	let res = await browser.storage.local.get(statekey);
	let uistate = {};
	let defaultstate = UISTATES[ui];
	uistate[statekey] = {...defaultstate, ...(res[statekey] || {})};
	browser.storage.local.set(uistate);
}

async function updateState(ui, component, value){
	let statekey = stateKey(ui);
	let uistate = await browser.storage.local.get(statekey);
	uistate[statekey][component] = value;
	browser.storage.local.set(uistate);
}

//---------------------------------------------------------------------------------------------------------------------
// message functions
//---------------------------------------------------------------------------------------------------------------------

browser.runtime.onMessage.addListener(request => {
	return messageActions(request);
});

async function messageActions(request){
	switch (request.function){
		case "blob":
			let bloburl = URL.createObjectURL(request.blob);
			return startDownload(bloburl, request.filename, request.meta);

		case "updatesavedinfo":
			return updateSavedInfo(request.site, request.user, request.id);

		case "createobjecturl":
			return URL.createObjectURL(request.object);

		case "revokeobjecturl":
			URL.revokeObjectURL(request.url);
			return;

		case "openuserfolder":
			return openFolder(request.folderFile, request.meta);

		case "getoptions":
			return getOptions();

		case "updateoptions":
			return updateOptions(request.newoptions);

		case "showdownload":
			return browser.downloads.show(request.id);

		case "updatestate":
			return updateState(request.ui, request.component, request.value);

		case "removeuser":
			return removeUser(request.site, request.user);

		case "removesubmission":
			return removeSubmission(request.site, request.sid);
	}
}

//---------------------------------------------------------------------------------------------------------------------
// update saved info
//---------------------------------------------------------------------------------------------------------------------

var updating = false;

async function updateSavedInfo(site, user, sid){
	let message;
	updating = await isUpdating();

	try {
		let key = savedKey(site);
		let storage = await browser.storage.local.get(key);
		let sitesavedinfo = storage[key] || {};

		let saved = sitesavedinfo[user] || [];
		saved.push(sid);
		sitesavedinfo[user] = [...new Set(saved)].sort((a, b) => b - a);

		await browser.storage.local.set(Object.fromEntries([[key, sitesavedinfo]]));
		message = {response: "Success", list: sitesavedinfo};
	}
	catch (error){
		message = {response: "Failure", error};
	}

	updating = false;
	return message;
}

async function removeUser(site, user){
	updating = await isUpdating();
	let key = savedKey(site);
	let storage = await browser.storage.local.get(key);
	let sitesavedinfo = storage[key];

	delete sitesavedinfo[user];

	if (Object.keys(sitesavedinfo).length <= 0){
		await browser.storage.local.remove(key);
	}
	else {
		await browser.storage.local.set(Object.fromEntries([[key, sitesavedinfo]]));
	}
	updating = false;
	return sitesavedinfo;
}

async function removeSubmission(site, sid){
	updating = await isUpdating();
	let key = savedKey(site);
	let storage = await browser.storage.local.get(key);
	let sitesavedinfo = storage[key];

	for (let [user, sids] of Object.entries(sitesavedinfo)){
		sitesavedinfo[user] = sids.filter(id => id !== sid);

		if (sitesavedinfo[user].length <= 0){
			delete sitesavedinfo[user];
		}
	}
	if (Object.keys(sitesavedinfo).length <= 0){
		await browser.storage.local.remove(key);
	}
	else {
		await browser.storage.local.set(Object.fromEntries([[key, sitesavedinfo]]));
	}
	updating = false;
	return sitesavedinfo;
}

//function to prevent the saved info from updating multiple times at once
//it could cause some downloaded files to not be added to the list
function isUpdating(){
	return new Promise((resolve, reject) => {
		if (!updating){
			resolve(true);
		}
		else {
			setTimeout(() => resolve(isUpdating()), 25);
		}
	});
}

//---------------------------------------------------------------------------------------------------------------------
// filename creation
//---------------------------------------------------------------------------------------------------------------------

//remove illegal filename characters
function sanitize(text){
	return `${text}`
		.replace(/\\/g, "＼")	//\uff3c
		.replace(/\//g, "／")	//\uff0f
		.replace(/:/g, "：")	//\uff1a
		.replace(/\*/g, "＊") //\uff0a
		.replace(/\?/g, "？") //\uff1f
		.replace(/\"/g, "″")	//\u2033
		.replace(/</g, "＜")	//\uff1c
		.replace(/>/g, "＞")	//\uff1e
		.replace(/\|/g, "｜") //\uff5c
		.replace(/[\u200e\u200f\u202a-\u202e]/g, ""); //remove bidirectional formatting characters.
		//Not illegal in windows but firefox errors when trying to download a filename with them.
}

//create filename by replacing every {info} in the options filename with appropriate meta
function createFilename(meta, path, replace){
	for (let key in meta){
		let metavalue = sanitize(meta[key]); //make sure it is a filesafe string
		if (replace){
			metavalue = metavalue.replace(/\s/g, "_");
		}
		path = path.replace(RegExp(`{${key}}`, "g"), metavalue);
	}
	//Make sure no folders end with "."
	path = path.replace(/\.\//g, "．/"); //\uff0e

	return path;
}

//---------------------------------------------------------------------------------------------------------------------
// downloading functions
//---------------------------------------------------------------------------------------------------------------------

var currentdownloads = new Map();

async function startDownload(url, filename, meta){
	let key = optionsKey("global");
	let res = await browser.storage.local.get(key);
	filename = createFilename(meta, filename, res[key].replace);
	try {
		let dlid = await browser.downloads.download({url, filename, conflictAction: res[key].conflict, saveAs: res[key].saveAs});
		currentdownloads.set(dlid, url);
		return {response: "Success", url, filename, id: dlid};
	}
	catch (err){
		return {response: "Failure", url, filename};
	}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function handleChanged(delta){
	if (!delta.state || delta.state.current !== "complete"){
		return;
	}

	URL.revokeObjectURL(delta.url);
	let dlid = delta.id;

	if (folderfiles.has(dlid)){
		//Delete the file used to open the folder
		//and remove from the download history
		browser.downloads.removeFile(delta.id);
		browser.downloads.erase({id: delta.id});
		folderfiles.delete(dlid);
	}
	else if (currentdownloads.has(dlid)){
		currentdownloads.delete(dlid);
	}
}

browser.downloads.onChanged.addListener(handleChanged);

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

var folderfiles = new Map();

async function openFolder(filename, meta){
	let url = URL.createObjectURL(new Blob([""]));
	let res = await browser.storage.local.get(optionsKey("global"));
	filename = createFilename(meta, filename, res.replace);
	let dlid = await browser.downloads.download({url, filename, saveAs: false});
	folderfiles.set(dlid, url);
	browser.downloads.show(dlid);
}