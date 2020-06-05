var globaluserlist;
var globalrunningobservers = [];
var globaltooltip = createTooltip();

main();

async function main(){
  let options = await getOptions();
  document.body.style.setProperty("--as-icon-size", `${options.global.iconSize}px`);
  
  await setList();

  let page = await getPage();

  as[page.site].check.startChecking();
}

async function setList(){
  let item = await browser.storage.local.get("userlist");
  //console.log(item);
  globaluserlist = item.userlist;
  if (!globaluserlist){
    globaluserlist = {};

    await browser.storage.local.set({
      userlist: globaluserlist
    });
  }
}

function getPage(){
  return new Promise((resolve, reject) => {
    try {
      resolve(pageInfo());
    }
    catch (err){
      setTimeout(() => resolve(getPage()), 300);
    }
  });
}

async function reCheck(){
  await setList();

  globalrunningobservers.forEach(ob => ob.disconnect());
  globalrunningobservers = [];

  $$("[data-checkstatus]").forEach(e => e.removeAttribute("data-checkstatus"));
  $$(".artsaver-check").forEach(e => removeElement(e));

  let page = await getPage();
  as[page.site].check.startChecking();
}

//---------------------------------------------------------------------------------------------------------------------
// quality of life functions
//---------------------------------------------------------------------------------------------------------------------

//themed console log
function asLog(...texts){
  let log = ["%c[art saver]%c", "color: #006efe", ""];
  if (typeof(texts[0]) === "string"){
    log[0] += ` ${texts.shift()}`;
  }
  console.log(...log.concat(texts));
}

//simpler fetch function with document support
async function fetcher(url, type, init = {}){
  init = {
    credentials: "include",
    referrer: window.location.href,
    ...init
  };

  let response = await fetch(url, init);

  if (!response.ok && type !== "response"){
    let err = new Error(url);
    err.name = `Error ${response.status}`;
    return err;
  }

  switch (type){
    case "response":
      return response;

    case "document":
      let html = await response.text();
      let parser = new DOMParser();
      return parser.parseFromString(html, "text/html");

    case "json":
      return await response.json();

    case "blob":
      return await response.blob();

    default:
      return await response.text();
  }
}

//---------------------------------------------------------------------------------------------------------------------
// "create" functions
//---------------------------------------------------------------------------------------------------------------------

function createTooltip(){
  removeElement($("artsaver-tip"));

  let tip = document.createElement("div");
  tip.className = "artsaver-tip";
  tip.innerHTML = "<table><tr><td>User:</td><td></td></tr><tr><td>Id:</td><td></td></tr></table>";
  document.body.appendChild(tip);

  tooltip = {tip};

  tooltip.show = function(){
    this.tip.setAttribute("data-display", "show");
  }
  tooltip.fade = function(){
    this.tip.removeAttribute("data-display");
  }
  tooltip.set = function(user, id){
    let fields = $$(this.tip, "td:last-child");
    fields[0].textContent = user;
    fields[1].textContent = id;
  }
  tooltip.move = function(x, user, id){
    let rect = x.getBoundingClientRect();
    this.set(user, id);
    this.tip.style.top = `${rect.top + window.scrollY - this.tip.offsetHeight - 1}px`;
    //dont let the tooltip cross the document width
    this.tip.style.left = `${Math.min(rect.left + window.scrollX, document.body.offsetWidth - this.tip.offsetWidth)}px`;
    this.show();
  }

  return tooltip;
}

function createCheck(anchor, color, position, data){
  let checkbutton = document.createElement("div");
  checkbutton.className = "artsaver-check";

  checkbutton.setAttribute("data-color", color);

  if (tooltip){
    checkbutton.onmouseover = function(){
      globaltooltip.move(this, data.user, data.id);
    };
    checkbutton.onmouseout = () => {
      globaltooltip.fade();
    }
  }

  checkbutton.addEventListener("click", function(event){
    event.preventDefault();
    event.stopPropagation();

    removeCheck(this, data);
    globaltooltip.fade();
  }, {once: true});

  anchor.insertAdjacentElement(position, checkbutton);

  return checkbutton;
}

async function removeCheck(checkbutton, data){
  checkbutton.className = "artsaver-loading";
  try {
    let item = await browser.storage.local.get("userlist");
    let userids = item.userlist[data.site][data.user];

    globaluserlist[data.site][data.user] = userids.filter(id => id !== data.id);

    if (globaluserlist[data.site][data.user].length === 0){
      delete globaluserlist[data.site][data.user];
    }
    if (Object.keys(globaluserlist[data.site]).length === 0){
      delete globaluserlist[data.site];
    }

    await browser.storage.local.set({
      userlist: globaluserlist
    });
    removeElement(checkbutton);
    reCheck();
  }
  catch (err){}
}

function createDownload(site, anchor, url, position){
  let downloadbutton = document.createElement("div");
  downloadbutton.className = "artsaver-download";

  downloadbutton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    as[site].download.startDownloading(url, createProgress(downloadbutton, [site, anchor, url, position]));
  }, {once: true});

  anchor.insertAdjacentElement(position, downloadbutton);

  document.addEventListener("keypress", event => {
    if (anchor.matches(":hover") && event.key === "d"){
      downloadbutton.click();
    }
  });

  return downloadbutton;
}

function addButton(site, user, subid, submission, anchor, url, position = "afterend"){
  let parent = ["afterend", "beforebegin"].includes(position) ? anchor.parentElement : anchor;
  let button = $(parent, ".artsaver-check, .artsaver-download");

  if (submission.getAttribute("data-checkstatus") !== "checked"){
    let result = checkUserList(site, user, subid);
    submission.setAttribute("data-checkstatus", "checked");

    if (result.found){
      $$(parent, "[class^=artsaver]").forEach(e => removeElement(e));

      button = createCheck(anchor, result.color, position, {site, user: result.user, id: subid});
    }
  }

  if (!button){
    button = createDownload(site, anchor, url, position);
  }

  return button;
}

function checkUserList(site, user, id){
  let found = false;
  let founduser = user;
  let color = "green";

  if (globaluserlist[site] && globaluserlist[site][user] && globaluserlist[site][user].includes(id)){
    found = true;
  }
  else if (globaluserlist[site]) {
    for (let otheruser in globaluserlist[site]){
      if (otheruser === user || !globaluserlist[site][otheruser].includes(id)){
        continue;
      }

      founduser = otheruser;
      if (user){
        color = "yellow";
      }
      found = true;
      break;
    }
  }

  return {found, user: founduser, color};
}

function createProgress(downloadbutton, rebuild){
  downloadbutton.className = "artsaver-loading";

  let p = document.createElement("div");
  p.className = "artsaver-progress";
  p.innerHTML = '<div class="artsaver-bar"><div class="artsaver-bar-text"></div></div>';
  downloadbutton.insertAdjacentElement("beforebegin", p);

  let progress = {button: downloadbutton, element: p};

  progress.bar = progress.element.firstChild;

  progress.start = function(){
    this.bar.style = "width:0";
  }
  progress.say = function(text){
    this.bar.firstChild.textContent = text;
  }
  progress.width = function(width){
    this.bar.style.width = `${width}%`;
  }
  progress.saving = function(amount){
    let multiple = (amount > 1) ? [` ${amount}`, "s"] : ["", ""];
    this.say(`Saving${multiple[0]} file${multiple[1]}`);
  }
  progress.remove = function(){
    removeElement(this.element);
    removeElement(this.button);
  }
  progress.reset = function(){
    this.remove();
    createDownload(...rebuild);
  }
  progress.error = function(){
    this.button.className = "artsaver-error";
    removeElement(this.element);
    this.button.addEventListener("click", function(event){
      event.preventDefault();
      event.stopPropagation();

      removeElement(this);
      createDownload(...rebuild);
    }, {once: true});
  }

  progress.start();
  return progress;
}

//---------------------------------------------------------------------------------------------------------------------
// functions used when downloading a submission
//---------------------------------------------------------------------------------------------------------------------

async function getOptions(){
  let res = await browser.storage.local.get("options");
  return res.options;
}

async function fetchBlobsProgress(downloads, progress){
  progress.say("Starting download");

  let allprogress = Array(downloads.length);

  return await Promise.all(downloads.map((dl, i) => getBlob(dl, i)));

  async function getBlob(dl, i){
    let response = await fetcher(dl.url, "response");
    
    if (!response.ok){
      let err = new Error(dl.url);
      err.name = `Error ${response.status}`;
      throw err;
    }

    let loaded = 0;
    let total = parseInt(response.headers.get("Content-Length"), 10);
    let computable = total ? true : false;

    let reader = response.body.getReader();
    let chunks = [];

    while (true){
      let {done, value} = await reader.read();
      if (done){
        break;
      }
      chunks.push(value);
      loaded += value.length;

      allprogress[i] = {computable, total, loaded};

      blobProgress(allprogress, progress);
    }

    dl.blob = new Blob(chunks);
    return dl;
  }
}

function blobProgress(allprogress, progress){
  let current = allprogress.flat();

  let [total, loaded] = current.reduce((acc, c) => [c.total + acc[0], c.loaded + acc[1]], [0, 0]);

  if (current.some(d => !d.computable)){
    progress.width(100);
    progress.say(`... ${fileSize(loaded)}`);
  }
  else {
    let percent = (loaded / total * 100) * (current.length / allprogress.length);
    progress.width(percent);
    progress.say(`${fileSize(loaded)} ${Math.floor(percent)}%`);
  }
}

function fileSize(bytes){
  for (let size of ["bytes", "KB", "MB", "GB", "TB"]){
    if (bytes < 1024 || size === "TB"){
      return `${bytes.toFixed(2)} ${size}`;
    }
    bytes = bytes / 1024;
  }
}

async function downloadBlobs(blobs){
  let results = [];
  for (let blob of blobs){
    let message = await browser.runtime.sendMessage({
      function: "blob",
      ...blob
    });
    handleResponse(message);
    results.push(message.response);
  }
  return results;
}

function handleResponse(message){
  if (message.response === "Success"){
    asLog("%cDownloading:", "color: #006efe", message.filename);
  }
  else if (message.response === "Failure"){
    asLog("%cFailed to download:", "color: #d70022", message.filename);
  }
}

async function updateList(site, user, id){
  let message = await browser.runtime.sendMessage({function: "updatelist", site, user, id});
  if (message.response === "Success"){
    globaluserlist = message.list;
  }
  else if (message.response === "Failure"){
    asLog("%cFailed to update list:", "color: #d70022", message.error);
  }
}

//---------------------------------------------------------------------------------------------------------------------
// message listener functions
//---------------------------------------------------------------------------------------------------------------------

browser.runtime.onMessage.addListener(message => {
  switch (message.command){
    case "downloadall":
      downloadAll();
      break;

    case "recheck":
      reCheck();
      setTimeout(() => sendStats(), 300);
      break;

    case "sitestats":
      sendStats();
  }
});

function downloadAll(){
  $$(".artsaver-download").forEach(d => d.click());
}

function sendStats(){
  let downloads = $$(".artsaver-download").length;
  let saved = $$(".artsaver-check").length;
  let page;
  try {
    page = pageInfo();
  }
  catch (err){
    browser.runtime.sendMessage({
      function: "pageerror"
    });
    return;
  }

  let isuser = page.user ? true : false;
  browser.runtime.sendMessage({
    function: "sitestats",
    total: {saved, downloads},
    links: page.links,
    site: page.site,
    user: isuser
  });

  if (isuser){
    userInfo(page);
  }
}

async function userInfo(page){
  let user = {
    site: page.site,
    name: page.user
  };

  let item = await browser.storage.local.get("userlist");
  let savedlist = item.userlist ? item.userlist[user.site] : {};
  user = await as[user.site].userInfo(user, page, savedlist);

  browser.runtime.sendMessage({function: "userstats", user, submissionUrl: page.links.submissionUrl});
}