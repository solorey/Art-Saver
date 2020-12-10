var globaluserlist;
var globalrunningobservers = [];
var globaltooltip = createTooltip();
var globaloptions;
var globalqueue;

main();

async function main(){
  globaloptions = (await getOptions()).global;
  document.body.style.setProperty("--as-icon-size", `${globaloptions.iconSize}px`);

  globalqueue = createPageQueue(globaloptions.useQueue, {
    concurrent: globaloptions.queueConcurrent,
    waittime: globaloptions.queueWait,
    infobar: globaloptions.infoBar ? createPageInfoBar() : false
  });

  await setList();

  let page = await getPage();

  as[page.site].check.startChecking();
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function getOptions(){
  let res = await browser.storage.local.get("options");
  return res.options;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function reCheck(){
  await setList();

  globalrunningobservers.forEach(ob => ob.disconnect());
  globalrunningobservers = [];

  $$("[data-checkstatus]").forEach(e => e.removeAttribute("data-checkstatus"));
  $$(".artsaver-check, .artsaver-screen").forEach(e => $remove(e));

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//simpler fetch function with document support

async function fetcher(url, type = "response", init = {}){
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
    case "document":
      let html = await response.text();
      let parser = new DOMParser();
      return parser.parseFromString(html, "text/html");

    case "json":
      return await response.json();

    case "blob":
      return await response.blob();

    default:
      return response;
  }
}

//---------------------------------------------------------------------------------------------------------------------
// "create" functions
//---------------------------------------------------------------------------------------------------------------------

function createTooltip(){
  $remove($(".artsaver-tip"));

  let tip = $insert(document.body, "div", {class: "artsaver-tip"});
  let table = $insert(tip, "table");
  let tr1 = $insert(table, "tr");
  $insert(tr1, "td", {text: "User:"});
  $insert(tr1, "td");
  let tr2 = $insert(table, "tr");
  $insert(tr2, "td", {text: "Id:"});
  $insert(tr2, "td");

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createCheck(anchor, color, position, data){
  let checkbutton = $insert(anchor, "div", {position, class: "artsaver-check", "data-color": color});

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

  return checkbutton;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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
    $remove(checkbutton);
    reCheck();
  }
  catch (err){}
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createDownload(site, anchor, url, position){
  let dlbutton = $insert(anchor, "div", {position, class: "artsaver-download"});
  let activated = false;

  dlbutton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    activated = true;
    let bar = createProgress(dlbutton, [site, anchor, url, position]);
    globalqueue.addDownload(site, url, bar);
  }, {once: true});

  document.addEventListener("keypress", event => {
    if (anchor.matches(":hover") && event.key === "d" && !activated){
      dlbutton.click();
      activated = true;
    }
  });

  return dlbutton;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function addButton(site, user, subid, submission, anchor, url, position = "afterend", screen = true){
  let parent = ["afterend", "beforebegin"].includes(position) ? anchor.parentElement : anchor;
  if ($(parent, ".artsaver-error, .artsaver-loading")){
    return;
  }
  let button = $(parent, ".artsaver-check, .artsaver-download");

  if (submission.getAttribute("data-checkstatus") !== "checked"){
    let result = checkUserList(site, user, subid);
    submission.setAttribute("data-checkstatus", "checked");

    if (result.found){
      $$(parent, "[class^=artsaver]").forEach(e => $remove(e));

      button = createCheck(anchor, result.color, position, {site, user: result.user, id: subid});

      if (globaloptions.addScreen && screen){
        let cover = $insert(button, "div", {position: "beforebegin", class: "artsaver-screen"});
        cover.style.opacity = `${globaloptions.screenOpacity}%`;

        $insert(cover, "div");
      }
    }
  }

  if (!button){
    button = createDownload(site, anchor, url, position);
  }

  return button;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function createProgress(dlbutton, rebuild){
  dlbutton.className = "artsaver-loading";

  let p = $insert(dlbutton, "div", {position: "beforebegin", class: "artsaver-progress"});
  $insert($insert(p, "div", {class: "artsaver-bar"}), "div", {class: "artsaver-bar-text"});

  let progress = {button: dlbutton, element: p};

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
    try {
      $remove(this.element);
    }
    catch (e){}
    try {
      $remove(this.button);
    }
    catch (e){}
  }
  progress.reset = function(){
    this.remove();
    return createDownload(...rebuild).click();
  }
  progress.error = function(){
    this.button.className = "artsaver-error";
    $remove(this.element);
    this.button.addEventListener("click", function(event){
      event.preventDefault();
      event.stopPropagation();

      $remove(this);
      createDownload(...rebuild);
    }, {once: true});
  }

  progress.start();
  return progress;
}

//---------------------------------------------------------------------------------------------------------------------
// functions used when downloading a submission
//---------------------------------------------------------------------------------------------------------------------

async function fetchBlobsProgress(downloads, progress){
  progress.say("Starting download");

  let allprogress = Array(downloads.length);

  return await Promise.all(downloads.map((dl, i) => getBlob(dl, i)));

  async function getBlob(dl, i){
    let response = await fetcher(dl.url);

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

async function downloadBlobs(blobs){
  let results = [];
  for (let blob of blobs){
    let message = await browser.runtime.sendMessage({
      function: "blob",
      ...blob
    });
    logDownloadResponse(message);
    results.push(message);
  }
  return results;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function logDownloadResponse(message){
  if (message.response === "Success"){
    asLog("%cDownloading:", "color: #006efe", message.filename);
  }
  else if (message.response === "Failure"){
    asLog("%cFailed to download:", "color: #d70022", message.filename);
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function downloadAll(){
  $$(".artsaver-download").forEach(d => d.click());
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//---------------------------------------------------------------------------------------------------------------------
// queue functions
//---------------------------------------------------------------------------------------------------------------------

async function timer(s){
  return await new Promise((resolve, reject) => {
    setTimeout(resolve, s * 1000); //seconds
  });
}

function createPageQueue(usequeue, options){
  let concurrent = usequeue ? options.concurrent || 1 : Infinity;
  let waittime = usequeue ? options.waittime || 0 : 0;
  let infobar = options.infobar;

  let queue = {
    list: [],
    downloading: 0,
    inprogress: 0,
    threads: 0
  };

  queue.addDownload = function(site, url, bar){
    this.list.push({site, url, bar});
    this.downloading += 1;
    this.updateDownloadInfo();

    if (this.threads < concurrent){
      this.addThread();
    }
  }

  queue.addThread = async function(){
    this.threads += 1;
    while (this.list.length > 0){
      await this.downloadNext();
      if (waittime > 0){
        await timer(waittime);
      }
    }
    this.threads -= 1;

    if (this.threads <= 0){
      this.downloading = 0;
    }

    this.updateDownloadInfo();
  }

  queue.downloadNext = async function(){
    this.inprogress += 1;
    let {site, url, bar} = this.list.shift();
    this.updateDownloadInfo();
    try {
      let result = await as[site].download.startDownloading(url, bar);

      if (infobar){
        if (result.status === "Success"){
          infobar.addSaved(result);
        }
        else {
          infobar.addError(result);
        }
      }
    }
    catch (err){
      asLog("Uncaught download error", err);
    }
    this.inprogress -= 1;
    this.updateDownloadInfo();
    return;
  }

  queue.updateDownloadInfo = function(){
    this.list.forEach((place, i) => {
      place.bar.say(`In queue pos: ${i + 1}`);
    });

    if (infobar){
      infobar.setProgress(this.downloading, this.inprogress, this.list.length);
    }
  }

  return queue
}

//---------------------------------------------------------------------------------------------------------------------
// Page Info Bar
//---------------------------------------------------------------------------------------------------------------------

function createPageInfoBar(){
  $remove($(".artsaver-infobar"));
  $remove($(".artsaver-show-infobar"));

  //all this to avoid using innerHTML
  let ib = $insert(document.body, "div", {class: "artsaver-infobar", "data-display": "hide"});

  let l1 = $insert(ib, "div", {id: "list-recent", class: "list-box"});
  $insert(l1, "div", {class: "list"});
  $insert(l1, "div", {class: "list-bar", text: "Recent"});

  let l2 = $insert(ib, "div", {id: "list-files", class: "list-box hide-folders"});
  $insert(l2, "div", {class: "list"});
  let l2b = $insert(l2, "div", {class: "list-bar"});
  $insert(l2b, "div", {text: "Recent"});
  let l2s = $insert(l2b, "label", {text: "Show folders"})
  let l2si = $insert(l2s, "input", {type: "checkbox"});
  l2si.oninput = function(){
    if (this.checked){
      l2.classList.remove("hide-folders");
    }
    else {
      l2.classList.add("hide-folders");
    }
  }
  $insert(l2s, "div", {class: "switch"});

  let l3 = $insert(ib, "div", {id: "list-errors", class: "list-box"});
  $insert(l3, "div", {class: "list"});
  $insert(l3, "div", {class: "list-bar", text: "Errors"});

  let bar = $insert(ib, "div", {id: "infobar"});
  let col = $insert(bar, "div", {id: "collapse"});

  let his = $insert(bar, "div", {id: "history-stats"});

  let hs1 = $insert(his, "div", {id: "stat-recent", class: "expand"});
  $insert(hs1, "div", {text: "Recently saved"});
  $insert($insert(hs1, "div"), "span", {class: "badge", text: "-"});

  let hs2 = $insert(his, "div", {id: "stat-files", class: "expand"});
  $insert(hs2, "div", {text: "Files"});
  $insert($insert(hs2, "div"), "span", {class: "badge", text: "-"});

  let hs3 = $insert(his, "div", {id: "stat-errors"});
  $insert(hs3, "div", {text: "Errors"});
  $insert($insert(hs3, "div"), "span", {class: "badge", text: "-"});

  let q = $insert(ib, "div", {id: "queue"});

  let qs = $insert(q, "div", {id: "queue-stats"});
  $insert($insert(qs, "div", {text: " downloading"}), "span", {position: "afterbegin", id: "stat-downloading", text: "-"});
  $insert($insert(qs, "div", {text: " in progress"}), "span", {position: "afterbegin", id: "stat-progress", text: "-"});
  $insert($insert(qs, "div", {text: " in queue"}), "span", {position: "afterbegin", id: "stat-queue", text: "-"});

  $insert($insert($insert(q, "div", {class: "artsaver-progress"}), "div", {class: "artsaver-bar"}), "div", {class: "artsaver-bar-text"});

  let sib = $insert(document.body, "div", {class: "artsaver-show-infobar"});
  let st = $insert(sib, "div", {id: "show-tab"});

  let infobar = {
    element: ib,
    tab: sib,
    collapse: col,
    expand: st,
    saved: [],
    errors: [],
    state: "initial"
  };

  infobar.show = function(){
    this.element.removeAttribute("data-display");
    this.tab.classList.add("hide");
  }

  infobar.hide = function(){
    this.element.addEventListener('transitionend', () => {
      this.tab.classList.remove("hide");
    }, {once: true});
    this.element.setAttribute("data-display", "hide");
  }

  infobar.expand.onclick = () => {
    infobar.show();
    infobar.state = "show";
  }
  infobar.collapse.onclick = () => {
    infobar.hide();
    if (parseInt($(infobar.element, "#stat-downloading").textContent, 10) > 0){
      infobar.state = "staydown";
    }
  }

  infobar.addSaved = function(saved){
    this.saved.push(saved);
    let recentrow = $insert($(this.element, "#list-recent .list"), "div", {class: "row"});
    let recenttext = $insert(recentrow, "div", {class: "row-text"});
    $insert(recenttext, "div", {text: saved.submission.user});
    $insert(recenttext, "div", {text: saved.submission.id});
    $insert(recenttext, "div", {text: `(${saved.files.length})`});
    $insert(recenttext, "div", {text: saved.submission.title});

    let link = $insert($insert(recentrow, "div", {class: "row-buttons"}), "a", {class: "link"});
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = saved.submission.url;

    for (let f of saved.files){
      let filerow = $insert($(this.element, "#list-files .list"), "div", {class: "row"});
      let filetext = $insert(filerow, "div", {class: "row-text"});

      let reg = /^(.*\/)?(.+)$/.exec(f.filename);
      $insert(filetext, "span", {text: reg[1]});
      $insert(filetext, "span", {text: reg[2]});

      let folder = $insert($insert(filerow, "div", {class: "row-buttons"}), "button", {class: "folder"});
      folder.onclick = () => {
        browser.runtime.sendMessage({function: "showdownload", id: f.id});
      }
    }

    this.updateHistoryInfo();
  }

  infobar.addError = function(error){
    this.errors.push(error);
    let errorrow = $insert($(this.element, "#list-errors .list"), "div", {class: "row"});
    let errortext = $insert(errorrow, "div", {class: "row-text"});
    $insert(errortext, "span", {text: error.url});

    let buttonrow = $insert(errorrow, "div", {class: "row-buttons"});
    let link = $insert(buttonrow, "a", {class: "link"});
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = error.url;

    this.updateHistoryInfo();
  }

  infobar.updateHistoryInfo = function(){
    let tsaved = this.saved.length;
    let tfiles = this.saved.reduce((acc, s) => acc += s.files.length, 0);
    let terrors = this.errors.length;

    for (let [stat, name] of [[tsaved, "recent"], [tfiles, "files"], [terrors, "errors"]]){
      let statrow = $(this.element, `#stat-${name}`);
      $(statrow, ".badge").textContent = stat;
      let statlist = $(this.element, `#list-${name}`);
      if (stat > 0) {
        statrow.classList.add("stat-button");
        statrow.onclick = () => {
          statlist.classList.toggle("hide");
        };
      }
      else {
        statrow.classList.remove("stat-button");
        statlist.classList.add("hide");
      }
    }

    let errorselem = $(this.element, `#stat-errors`);
    if (terrors <= 0){
      errorselem.classList.add("hide");
    }
    else {
      errorselem.classList.remove("hide");
    }
  }

  infobar.setProgress = function(downloading = 0, inprogress = 0, inqueue = 0){
    let bar = $(this.element, "#queue");
    if (downloading > 0){
      if (this.state !== "staydown"){
        this.show();
      }
      bar.classList.remove("hide");
      let percent = (downloading - (inqueue + inprogress)) / downloading * 100;
      $(this.element, ".artsaver-bar").style.width = `${percent}%`;
      $(this.element, ".artsaver-bar-text").textContent = `${Math.floor(percent)}%`;
    }
    else {
      bar.classList.add("hide");
    }

    $(this.element, "#stat-downloading").textContent = downloading;
    $(this.element, "#stat-progress").textContent = inprogress;
    $(this.element, "#stat-queue").textContent = inqueue;

    let statqc = $(this.element, "#stat-queue").parentElement.classList;
    if (inqueue > 0){
      statqc.remove("hide");
    }
    else {
      statqc.add("hide");
    }
  }

  infobar.updateHistoryInfo();
  infobar.setProgress();
  return infobar;
}

