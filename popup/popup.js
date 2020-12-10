var globalopened = false;
var globalrunningobservers = [];
var globalpopupstate;

//---------------------------------------------------------------------------------------------------------------------
// state functions
//---------------------------------------------------------------------------------------------------------------------

browser.storage.local.get("popup").then(s => globalpopupstate = s.popup);

function updateState(component, value){
  globalpopupstate[component] = value;
  browser.runtime.sendMessage({
    function: "updatestate",
    ui: "popup",
    component,
    value
  });
}

//---------------------------------------------------------------------------------------------------------------------
// page information
//---------------------------------------------------------------------------------------------------------------------

async function getPageInfo(){
  let tabs = await browser.tabs.query({
    active: true,
    currentWindow: true
  });
  let id = tabs[0].id;

  send(id, "sitestats");

  $("#download-all").onclick = () => send(id, "downloadall");
  $("#recheck").onclick = () => send(id, "recheck");
}

getPageInfo();

//---------------------------------------------------------------------------------------------------------------------
// message send/listen functions
//---------------------------------------------------------------------------------------------------------------------

function send(id, message){
  browser.tabs.sendMessage(id, {
    command: message,
  }).catch(() => {
    openTab("unsupported-page");
  });
}

browser.runtime.onMessage.addListener(request => {
  messageActions(request);
});

async function messageActions(request){
  if (request.function === "pageerror"){
    openTab("unsupported-page");
    return;
  }

  let res = await browser.storage.local.get(["userlist", "options"]);

  switch(request.function){
    case "sitestats":
      siteStats(request, res.userlist[request.site] || {});
      break;

    case "userstats":
      userStats(request, res.options);
  }
}

//---------------------------------------------------------------------------------------------------------------------
// tabs
//---------------------------------------------------------------------------------------------------------------------

function openTab(tab){
  $$(".tabs > button").forEach(t => t.classList.remove("active"));
  $$(".tab-content").forEach(t => t.removeAttribute("style"));

  let tabbutton = $(`.tabs > button[data-tab="${tab}"]`);
  if (tabbutton){
    tabbutton.classList.add("active");
  }
  $(`#${tab}`).style.display = "block";
}

openTab("getting-page");

for (let t of $$(".tabs > button[data-tab]")){
  t.onclick = function(){
    let tab = this.getAttribute("data-tab");

    openTab(tab);

    switch (tab){
      case "user-page":
        updateState("tab", "user");
        break;

      case "stats-page":
        updateState("tab", "stats");
        break;
    }
  };
}

$("#settings-tab").onclick = () => browser.runtime.openOptionsPage();

//---------------------------------------------------------------------------------------------------------------------
// download all button
//---------------------------------------------------------------------------------------------------------------------

function toggleDownload(){
  let lock = $("#download-lock");
  let bolt = $("#download-bolt");
  let dlall = $("#download-all");

  if (lock.getAttribute("data-toggle") === "closed"){
    lock.setAttribute("data-toggle", "open");
    bolt.className = "icon-lock_open";
    dlall.removeAttribute("disabled");
    return false;
  }
  else {
    lock.setAttribute("data-toggle", "closed");
    bolt.className = "icon-lock_closed";
    dlall.setAttribute("disabled", true);
    return true;
  }
}

$("#download-lock").onclick = () => {
  updateState("downloadLock", toggleDownload());
};

//---------------------------------------------------------------------------------------------------------------------
// stats
//---------------------------------------------------------------------------------------------------------------------

function siteStats(request, sitelist){
  globalrunningobservers.forEach(ob => ob.disconnect());
  globalrunningobservers = [];

  $("#stats-tab").style.display = "block";
  $("#stats-site").textContent = request.site;

  $("#downloads-stat").textContent = request.total.downloads;
  if (!globalpopupstate.downloadLock){
    $("#download-lock").setAttribute("data-toggle", "open");
    $("#download-bolt").className = "icon-lock_open";
    $("#download-all").removeAttribute("disabled");
  }
  $("#saved-stat").textContent = request.total.saved;

  let savedstats = {
    user: [...new Set(Object.keys(sitelist))].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: "base", numeric: true})),
    submission: [...new Set(Object.values(sitelist).flat())].sort((a, b) => b - a)
  };

  openTab("stats-page"); //for rendering virtual list

  for (let [stat, list] of Object.entries(savedstats)){
    let rowelem = $(`#total-${stat}s`);
    let listelem = $(`#${stat}-list`);

    $(rowelem, ".badge").textContent = list.length;

    if (list.length > 0){
      createVirtualList(listelem, list, request.links[`${stat}Url`]);
      rowelem.onclick = function(){ showSavedList(this, listelem); };
    }
    else {
      rowelem.classList.remove("stat-button");
    }
  }

  let ul = $("#user-list .list");
  let srow = $("#submission-list");
  let sl = $("#submission-list .list");

  let resize = new ResizeObserver(() => {
    let sblock = (srow.style.display === "block") ? 45 : 0;
    ul.style.maxHeight = `${600 - ul.offsetTop - sblock}px`;
    sl.style.maxHeight = `${600 - sl.offsetTop}px`;
  });
  globalrunningobservers.push(resize);
  resize.observe(ul);
  resize.observe(sl);

  if (request.user && !globalopened){
    $("#user-tab").style.display = "block";
    if (globalpopupstate["tab"] === "user"){
      openTab("user-page");
    }
    globalopened = true;
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function userStats(request, options){
  let user = request.user;

  $("#profile-cover").style.width = "auto";

  let pic = $("#profile-pic");
  pic.src = user.icon;
  pic.classList.remove("loading-icon");

  $("#user-name").textContent = user.name;

  $("#user-buttons").style.display = "flex";
  $("#user-home").href = user.home;
  $("#user-gallery").href = user.gallery;

  let userstats = $("#user-stats");
  $$(userstats, ".header ~ .stat-row").forEach(row => $remove(row));

  let userprofile = $("#user-profile");

  let hasstats = user.stats.size > 0;
  $(userstats, ".header").style.display = hasstats ? "block" : "none";
  userprofile.style.flexDirection = hasstats ? "row" : "column";
  if (hasstats){
    for (let [stat, value] of user.stats.entries()){
      let row = $insert(userstats, "div", {class: "stat-row"});
      $insert(row, "div", {text: stat});
      $insert($insert(row, "div"), "span", {class: "badge", text: value});
    }
  }

  userstats.style.display = "flex";

  if (user.saved.length === 0){
    return;
  }

  let savedelem = $("#total-saved");
  $(savedelem, ".badge").textContent = user.saved.length;
  savedelem.style.display = "flex";

  $("#saved-list .list").style.maxHeight = `${600 - (userprofile.offsetTop + userprofile.offsetHeight + 29)}px`;

  let listelem = $("#saved-list");
  createVirtualList(listelem, user.saved, request.submissionUrl);

  savedelem.onclick = function(){ showSavedList(this, listelem); };

  let folderelem = $("#user-folder");
  folderelem.style.display = "flex";
  folderelem.onclick = () => {
    browser.runtime.sendMessage({
      function: "openuserfolder",
      folderFile: `${options[user.site].userFolder}folderopener.file`,
      meta: user.folderMeta,
      replace: options.global.replace
    });
  };
}