browser.runtime.onInstalled.addListener(details => {
  browser.runtime.openOptionsPage();
});

browser.runtime.onMessage.addListener(request => {
  return messageActions(request);
});

async function messageActions(request){
  switch (request.function){
    case "blob":
      let bloburl = URL.createObjectURL(request.options.blob);
      return startDownload(bloburl, request.options.filename, request.options.meta);

    case "updatelist":
      return updateUserList(request.site, request.user, request.id);

    case "createobjecturl":
      return URL.createObjectURL(request.object);

    case "revokeobjecturl":
      URL.revokeObjectURL(request.url);
      return;

    case "opentab":
      return stashTab(request.options.url);

    case "openuserfolder":
      return openFolder(request.folderFile, request.meta, request.replace);
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

var currentdownloads = {};

async function startDownload(url, filename, meta){
  let res = await browser.storage.local.get("options");
  filename = createFilename(meta, filename, res.options.global.replace);
  try {
    let dlid = await browser.downloads.download({url, filename, conflictAction: res.options.global.conflict});
    currentdownloads[`${dlid}`] = url;
    return {response: "Success", url, filename};
  }
  catch (err){
    return {response: "Failure", url, filename};
  }
}

async function stashTab(url){
  let tab = await browser.tabs.create({url, active: false});
  let urls = await getStashUrls(tab.id);
  await browser.tabs.remove(tab.id);
  return {response: "Success", urls};
}

async function getStashUrls(id){
  try {
    let urls = await browser.tabs.sendMessage(id, {req: "stashurls"});
    if (urls && !urls.content.includes("")){
      return urls.content;
    }
  }
  catch (err){}

  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(getStashUrls(id)), 300);
  });
}

function handleChanged(delta){
  if (!delta.state || delta.state.current !== "complete"){
    return;
  }
  //console.log(currentdownloads);
  //console.log(`Download ${delta.id} has completed:`, delta);
  URL.revokeObjectURL(delta.url);
  let dlid = `${delta.id}`;

  if (dlid in folderfiles){
    browser.downloads.removeFile(delta.id);
    browser.downloads.erase({id: delta.id});
    delete folderfiles[dlid];
  }
  else if (dlid in folderfiles){
    delete currentdownloads[dlid];
  }
}

browser.downloads.onChanged.addListener(handleChanged);

var folderfiles = {};

async function openFolder(filename, meta, replace){
  let url = URL.createObjectURL(new Blob([""]));
  filename = createFilename(meta, filename, replace);
  let dlid = await browser.downloads.download({url, filename});
  folderfiles[`${dlid}`] = url;
  browser.downloads.show(dlid);
}