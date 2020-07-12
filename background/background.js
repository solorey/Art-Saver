browser.runtime.onInstalled.addListener(details => {
  getOptions().then(options => {
    browser.storage.local.set({options});
    if (details.reason === "install"){
      browser.runtime.openOptionsPage();
    }
  });
});

async function getOptions(){
  let res = await browser.storage.local.get("options");
  return updateOptions(res.options || {});
}

//if new settings have been added
function updateOptions(current) {
  for (s of settingsList()){
    if (!current[s.site]){
      current[s.site] = {};
    }
    if (!current[s.site][s.option]){
      current[s.site][s.option] = s.default;
    }
  }
  return current;
}

browser.runtime.onMessage.addListener(request => {
  return messageActions(request);
});

async function messageActions(request){
  switch (request.function){
    case "blob":
      let bloburl = URL.createObjectURL(request.blob);
      return startDownload(bloburl, request.filename, request.meta);

    case "updatelist":
      return updateUserList(request.site, request.user, request.id);

    case "createobjecturl":
      return URL.createObjectURL(request.object);

    case "revokeobjecturl":
      URL.revokeObjectURL(request.url);
      return;

    case "openuserfolder":
      return openFolder(request.folderFile, request.meta, request.replace);

    case "getoptions":
      return getOptions();

    case "updateoptions":
      return updateOptions(request.newoptions);
  }
}

var updating = false;

async function updateUserList(site, user, id){
  let message;
  updating = await isUpdating();

  try {
    let item = await browser.storage.local.get("userlist");
    let list = item.userlist || {};
    if (!list[site]){
      list[site] = {};
    }
    let saved = list[site][user] || [];
    saved.push(id);
    list[site][user] = [...new Set(saved)].sort((a, b) => b - a);

    await browser.storage.local.set({
      userlist: list
    });
    message = {response: "Success", list};
  }
  catch (error){
    message = {response: "Failure", error};
  }

  updating = false;
  return message;
}

//function to prevent the userlist from updating multiple times at once
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

//remove illegal filename characters
function sanitize(text){
  return text
    .replace(/\\/g, "＼") //\uff3c
    .replace(/\//g, "／") //\uff0f
    .replace(/:/g, "：")  //\uff1a
    .replace(/\*/g, "＊") //\uff0a
    .replace(/\?/g, "？") //\uff1f
    .replace(/\"/g, "″")  //\u2033
    .replace(/</g, "＜")  //\uff1c
    .replace(/>/g, "＞")  //\uff1e
    .replace(/\|/g, "｜") //\uff5c
    .replace(/[\u200e\u200f\u202a-\u202e]/g, ""); //remove bidirectional formatting characters.
    //Not illegal in windows but firefox errors when trying to download a filename with them.
}

//create filename by replacing every {info} in the options filename with appropriate meta
function createFilename(meta, path, replace){
  for (key in meta){
    let metavalue = sanitize(`${meta[key]}`); //make sure it is a filesafe string
    if (replace){
      metavalue = metavalue.replace(/\s/g, "_");
    }
    path = path.replace(RegExp(`{${key}}`, "g"), metavalue);
  }
  //Make sure no folders end with "."
  path = path.replace(/\.\//g, "．/"); //\uff0e

  return path;
}

var currentdownloads = new Map();

async function startDownload(url, filename, meta){
  let res = await browser.storage.local.get("options");
  filename = createFilename(meta, filename, res.options.global.replace);
  try {
    let opt = res.options.global;
    let dlid = await browser.downloads.download({url, filename, conflictAction: opt.conflict, saveAs: opt.saveAs});
    currentdownloads.set(dlid, url);
    return {response: "Success", url, filename};
  }
  catch (err){
    return {response: "Failure", url, filename};
  }
}

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

var folderfiles = new Map();

async function openFolder(filename, meta, replace){
  let url = URL.createObjectURL(new Blob([""]));
  filename = createFilename(meta, filename, replace);
  let dlid = await browser.downloads.download({url, filename, saveAs: false});
  folderfiles.set(dlid, url);
  browser.downloads.show(dlid);
}