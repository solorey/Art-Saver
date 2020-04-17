var globalopened = false;
var globalrunningobservers = [];

openTab("getting-page");
getPageInfo();

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

function openTab(tab){
  $$(".tabs > button").forEach(t => t.classList.remove("active"));
  $$(".tab-content").forEach(t => t.removeAttribute("style"));

  let tabbutton = $(`.tabs > button[data-tab="${tab}"]`);
  if (tabbutton){
    tabbutton.classList.add("active");
  }
  $(`#${tab}`).style.display = "block";
}

for (let t of $$(".tabs > button[data-tab]")){
  t.onclick = function(){ openTab(this.getAttribute("data-tab")); };
}

function toggleDownload(){
  let lock = $("#download-lock");
  let bolt = $("#download-bolt");

  if (lock.getAttribute("data-toggle") === "closed"){
    lock.setAttribute("data-toggle", "open");
    bolt.className = "icon-lock_open";
    $("#download-all").removeAttribute("disabled");
  }
  else {
    lock.setAttribute("data-toggle", "closed");
    bolt.className = "icon-lock_closed";
    $("#download-all").setAttribute("disabled", true);
  }
}

$("#download-lock").onclick = () => toggleDownload();

$("#settings-tab").onclick = () => browser.runtime.openOptionsPage();

function showSavedList(stat, list){
  if (stat.getAttribute("data-toggle") === "closed"){
    stat.setAttribute("data-toggle", "open");
    list.style.display =  "block"; //`${$(list, ".search-box").offsetHeight}px`;
  }
  else {
    stat.setAttribute("data-toggle", "closed");
    list.removeAttribute("style");
  }
}

function siteStats(request, sitelist){
  globalrunningobservers.forEach(ob => ob.disconnect());
  globalrunningobservers = [];

  $("#stats-tab").style.display = "block";
  $("#stats-site").textContent = request.site;

  $("#downloads-stat").textContent = request.total.downloads;
  $("#saved-stat").textContent = request.total.saved;

  let savedstats = {
    user: [...new Set(Object.keys(sitelist))].sort(),
    submission: [...new Set(Object.values(sitelist).flat())].sort((a, b) => b - a)
  };

  openTab("stats-page"); //for rendering virtual list

  for (let [stat, list] of Object.entries(savedstats)){
    let rowelem = $(`#total-${stat}s`);
    let listelem = $(`#${stat}-list`);

    $(rowelem, ".badge").textContent = list.length;

    if (list.length > 0){
      createVirtualList(listelem, list, stat, request.links[`${stat}Url`]);
      rowelem.onclick = function(){ showSavedList(this, listelem); };
    }
    else {
      rowelem.classList.remove("stat-button");
    }
  }

  let resize = new ResizeObserver(entries => {
    let ul = $("#user-list .list");
    let sl = $("#submission-list .list");
    let sblock = ($("#submission-list").style.display === "block") ? 45 : 0;
    ul.style.maxHeight = `${600 - ul.offsetTop - sblock}px`;
    sl.style.maxHeight = `${600 - sl.offsetTop}px`;
  });
  globalrunningobservers.push(resize);
  resize.observe($("#user-list .list"));
  resize.observe($("#submission-list .list"));

  if (request.user && !globalopened){
    $("#user-tab").style.display = "block";
    openTab("user-page");
    globalopened = true;
  }
}

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
  $$(userstats, ".header ~ .stat-row").forEach(row => removeElement(row));

  let userprofile = $("#user-profile");

  let hasstats = user.stats.size > 0;
  $(userstats, ".header").style.display = hasstats ? "block" : "none";
  userprofile.style.flexDirection = hasstats ? "row" : "column";
  if (hasstats){
    for (let [stat, value] of user.stats.entries()){
      let row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = '<div></div><div><span class="badge"></span></div>';
      row.firstElementChild.textContent = stat;
      $(row, "span").textContent = value;

      userstats.insertAdjacentElement("beforeend", row);
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
  createVirtualList(listelem, user.saved, "submission", request.submissionUrl);

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

function createVirtualList(sbox, values, linktype, linkstring){
  let linklist = $(sbox, ".link-list");
  while (linklist.firstChild) {
    linklist.removeChild(linklist.firstChild);
  }

  let listholder = $(sbox, ".list");

  //Firefox max scroll height 17895697px ~ 994205 rows
  //Rows blank out after around 466040 Rows
  //Safe max 466000 rows

  let vph = listholder.offsetHeight;
  let rows = new Map();
  let rh = 18;
  let listresult = [];

  let defaultheight = (values.length < 10) ? (values.length * rh) + 1 : 181;
  listholder.style.height = `${defaultheight}px`;
  refreshResult();

  let wait = false;
  listholder.onscroll = function(){
    if (wait){ return; }

    wait = true;
    window.requestAnimationFrame(() => {
      renderRows(this);
      wait = false;
    });
  };

  $(sbox, "input").oninput = () => {
    refreshResult();
  };
  $(sbox, "button").onclick = () => {
    toggleListSort(sbox);
    refreshResult();
  };

  let resize = new ResizeObserver(entries => {
    vph = [...entries].pop().borderBoxSize.blockSize;
    refreshList();
  });
  globalrunningobservers.push(resize);
  resize.observe(listholder);

  function refreshList(){
    rows.forEach(r => removeElement(r));
    rows.clear();

    linklist.style.height = `${rh * listresult.length}px`;
    renderRows(listholder);
  }

  function refreshResult(){
    listresult = searchResult(sbox, values);
    refreshList();
  }

  function rowElement(index){
    let i = listresult[index];
    let a = document.createElement("a");
    a.target = "_blank";
    a.innerHTML = '<li><span class="link-search"></span></li>';
    let li = a.firstElementChild;
    li.insertAdjacentText("afterbegin", i[1]);
    li.insertAdjacentText("beforeend", i[i.length - 1]);
    li.firstElementChild.textContent = i[2];
    a.href = linkstring.replace(RegExp(`{${linktype}}`, "g"), i[0]);
    a.style.top = `${index * rh}px`;
    return a;
  }

  function renderRows(sboxlist){
    let scrolly = sboxlist.scrollTop;

    let top = Math.max(0, Math.floor(scrolly / rh));
    let bottom = Math.min(listresult.length - 1, Math.ceil((scrolly + vph) / rh));

    for (let [i, r] of rows.entries()){
      if (i < top || i > bottom){
        removeElement(r);
        rows.delete(i);
      }
    }

    // add new rows
    for (let i = top; i <= bottom; i++){
      if (rows.has(i)){
        continue;
      }

      let alink = rowElement(i);
      rows.set(i, alink);
      linklist.insertAdjacentElement("beforeend", alink);
    }
  }
}

//assumes list is already in descending order
function searchResult(sbox, list){
  let input = $(sbox, "input").value;

  let results = [];
  for (let l of list){
    let result = RegExp(`^(.*?)(${input})(.*?)$`, "gi").exec(l);
    if (result){
      results.push(result);
    }
  }

  if ($(sbox, ".link-list").getAttribute("data-sort") === "ascend"){
    results.reverse();
  }

  return results;
}

function toggleListSort(sbox){
  let sorticon = $(sbox, ".search button i");
  let linklist = $(sbox, ".link-list");

  if (linklist.getAttribute("data-sort") === "descend"){
    linklist.setAttribute("data-sort", "ascend");
    sorticon.className = "icon-ascend";
  }
  else {
    linklist.setAttribute("data-sort", "descend");
    sorticon.className = "icon-descend";
  }
}