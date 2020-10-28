//restore options on page load
document.addEventListener("DOMContentLoaded", async () => {
  let options = await browser.runtime.sendMessage({
    function: "getoptions"
  });
  setOptions(options);
});

window.addEventListener("resize", () => {
  fixFormat();
});

function getJSON(file){
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = loaded => {
      resolve(JSON.parse(loaded.target.result));
    };
    reader.readAsText(file);
  });
}

//---------------------------------------------------------------------------------------------------------------------
// Help
//---------------------------------------------------------------------------------------------------------------------

for (let b of $$("button.help-button")){
  b.onclick = function(){
    toggleHelpButton(this);
  };
}

function toggleHelpButton(button){
  let table = button.nextElementSibling;
  if (button.textContent === "Show Help"){
    table.style.display = "block";
    button.textContent = "Hide Help";
  }
  else if (button.textContent === "Hide Help"){
    table.removeAttribute("style");
    button.textContent = "Show Help";
  }
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function addTable(location, tablemetas){
  let metas = {
    site:              "The name of the website. 'pixiv', 'deviantart', etc.",
    userName:          "The user name of the artist.",
    title:             "Title of the submission.",
    submissionId:      "Id of the submission. Different according to each site.",
    submissionId36:    "submissionId in base 36 format.",
    fileName:          "Original site filename of the submission. Does not include extension.",
    ext:               "File extension. 'jpg', 'png', 'gif', etc.",
    stashUrlId:        "The digits and letters at the end of a the stash url.",
    stashUserName:     "The user name of the artist of the stash submission.",
    stashTitle:        "Title of the stash submission.",
    stashSubmissionId: "Id of the stash submission.",
    stashFileName:     "The original file name of the stash submission. Does not include extension.",
    stashExt:          "File extension of the stash submission.",
    userId:            "The user Id of the artist.",
    page:              "The page number of the file in the submission set. Pages start at 1.",
    fileId:            "Id of the submission file.",
    userLower:          "The way the user name appears in the url bar."
  };

  let table = $insert($(`${location} ~ button`), "table", {position: "afterend"});

  for (let tm of tablemetas){
    let tr = $insert(table, "tr");
    $insert($insert($insert(tr, "td"), "li"), "strong", {text: tm});
    $insert(tr, "td", {text: metas[tm]});
  }
}

for (let s of settingsList()){
  if (!s.metas){
    continue;
  }

  addTable(s.location, s.metas);
}

//---------------------------------------------------------------------------------------------------------------------
// User list
//---------------------------------------------------------------------------------------------------------------------

async function userlistDetails(){
  let res = await browser.storage.local.get("userlist");
  let list = res.userlist;
  let savedtable = $("#saved-table");

  $$(savedtable, "tr:nth-child(n+2)").forEach(row => $remove(row));

  if (!list || Object.keys(list).length === 0){
    savedtable.style.display = "none";
    return;
  }

  let sites = ["deviantart", "pixiv", "furaffinity", "inkbunny"];

  let tbody = $(savedtable,  "tbody");

  for (let s of sites){
    if (!list[s]){
      continue;
    }

    let row = $insert(tbody, "tr");

    $insert(row, "td", {text: `${s[0].toUpperCase()}${s.slice(1)}`});  //site

    let totalusers = new Set(Object.keys(list[s])).size
    let span1 = $insert($insert(row, "td"), "span", {class: "badge", text: totalusers});

    let totalsubmissions = new Set(Object.values(list[s]).flat()).size;
    let span2 = $insert($insert(row, "td"), "span", {class: "badge", text: totalsubmissions});
  }

  savedtable.removeAttribute("style");
}

userlistDetails();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#userlist").oninput = function(){
  $("#filename").textContent = this.files[0].name;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#submit-list").onclick = async () => {
  try {
    let jsonfile = await getJSON($("#userlist").files[0]);
    await browser.storage.local.set({
      userlist: cleanUserList(jsonfile)
    });
    userlistDetails();
  }
  catch (err){}
};

//makes sure that the saved ids are an array of unique desending integers
function cleanUserList(userlist){
  for (let site in userlist){
    for (let user in userlist[site]){
      userlist[site][user] = [...new Set(userlist[site][user].map(n => parseInt(n, 10)))].sort((a, b) => b - a);
      if (userlist[site][user].length === 0){
        delete userlist[site][user];
      }
    }
    if (Object.keys(userlist[site]).length === 0){
      delete userlist[site];
    }
  }
  return userlist;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#export-list").onclick = async () => {
  let res = await browser.storage.local.get("userlist");
  let blob = new Blob([JSON.stringify(res.userlist)], {type : "application/json"});

  browser.downloads.download({
    url: URL.createObjectURL(blob),
    filename: "Userlist.json",
    saveAs: true
  });
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#reset-list").onclick = async () => {
  let undo = $("#userlist-undo");
  if (undo.style.display === "flex"){
    return;
  }

  let old = await browser.storage.local.get("userlist");
  await browser.storage.local.remove("userlist");
  await userlistDetails();

  undo.style.display = "flex";

  $(undo, ".undo-button").onclick = async () => {
    await browser.storage.local.set({
      userlist: old.userlist
    });
    await userlistDetails();
    undo.removeAttribute("style");
  }
};

//---------------------------------------------------------------------------------------------------------------------
// Custom number and range input
//---------------------------------------------------------------------------------------------------------------------

for (let n of $$(".custom-number")){
  let range;
  if (n.matches(".number-range .custom-number")){
    range = $(n.parentElement.parentElement.parentElement, "input[type=range]");
  }
  let num = $(n, "input");
  $(n, ".increase").onmousedown = function(){ numberIncrement(num, this, 1, range) };
  $(n, ".decrease").onmousedown = function(){ numberIncrement(num, this, -1, range) };
}

function numberIncrement(num, elem, n, range){
  let step = () => {
    num.stepUp(n);
    if (range){
      range.value = num.value;
    }
  };
  step();

  let intid;
  let timeid = setTimeout(() => {
    intid = setInterval(step, 80);
  }, 400);

  elem.onmouseup = elem.onmouseout = () => {
    clearTimeout(timeid);
    clearInterval(intid);
    saveOptions();
  };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

for (let nr of $$(".number-range")){
  let number = $(nr, "input[type=number]");
  let range = $(nr, "input[type=range]");
  range.value = number.value;
  number.oninput = function(){
    range.value = this.value;
    saveOptions();
  };
  range.oninput = function(){
    number.value = this.value;
    saveOptions();
  };
}

//---------------------------------------------------------------------------------------------------------------------
// Options buttons
//---------------------------------------------------------------------------------------------------------------------

$("#reset-options").onclick = async () => {
  let undo = $("#options-undo");
  if (undo.style.display === "flex"){
    return;
  }

  let oldoptions = optionsInfo();
  setOptions("default");

  undo.style.display = "flex";

  $(undo, ".undo-button").onclick = () => {
    setOptions(oldoptions);
    undo.removeAttribute("style");
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#export-options").onclick = () => {
  let blob = new Blob([JSON.stringify(optionsInfo())], {type : "application/json"});

  browser.downloads.download({
    url: URL.createObjectURL(blob),
    filename: "artsaver-settings.json",
    saveAs: true
  });
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

$("#import-options").oninput = async function(){
  let jsonfile = await getJSON(this.files[0]);
  let newoptions = await browser.runtime.sendMessage({
    function: "updateoptions",
    newoptions: jsonfile
  });
  setOptions(newoptions);
};

$("#click-import").onclick = () => {
  $("#import-options").click();
};

//---------------------------------------------------------------------------------------------------------------------
// Form functions
//---------------------------------------------------------------------------------------------------------------------

$("form").onsubmit = s => s.preventDefault();
$("form").oninput = () => saveOptions();

//---------------------------------------------------------------------------------------------------------------------
// Options functions
//---------------------------------------------------------------------------------------------------------------------

function saveOptions(){
  browser.storage.local.set({
    options: optionsInfo()
  });
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function optionsInfo(){
  let currentoptions = {};
  for (let s of settingsList()){
    if (!currentoptions[s.site]){
      currentoptions[s.site] = {};
    }

    let elem = $(s.location);
    if (elem.getAttribute("type") === "checkbox"){
      currentoptions[s.site][s.option] = elem.checked;
    }
    else {
      currentoptions[s.site][s.option] = elem.value;
    }
  }

  return currentoptions;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setOptions(options){
  for (let s of settingsList()){
    let elem = $(s.location);
    let value = (options === "default")? s.default : options[s.site][s.option];
    if (elem.getAttribute("type") === "checkbox"){
      elem.checked = value;
    }
    else {
      elem.value = value;
    }
  }
  saveOptions();
  fixFormat();
}

//---------------------------------------------------------------------------------------------------------------------
// Page format functions
//---------------------------------------------------------------------------------------------------------------------

function textareaResize(textarea){
  let height = 0;
  while (textarea.clientHeight < textarea.scrollHeight){
    textarea.style.height = `${textarea.scrollHeight + height}px`;
    height += 1;
  }
}

for (let t of $$("textarea")){
  t.style.height = "1.6em";
  textareaResize(t);
  t.oninput = function(){
    this.style.height = "1.6em";
    textareaResize(this);
  };
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

let optiontoggles = [
  {toggle:"#stash", opt: "div.stash-options"},
  {toggle:"#add-screen", opt: "div.screen-options"},
  {toggle:"#use-queue", opt: "div.queue-options"}
];

for (let {toggle, opt} of optiontoggles){
  $(toggle).oninput = function(){ uncoverOptions(toggle, opt) };
}

function uncoverOptions(toggle, opt){
  let screenoptions = $(opt);
  if ($(toggle).checked){
    screenoptions.removeAttribute("style");
  }
  else {
    screenoptions.style.display = "none";
  }

  if (toggle === "#stash"){
    textareaResize($("#dev-stash"));
  }
}

function showOptions(){
  for (let {toggle, opt} of optiontoggles){
    uncoverOptions(toggle, opt);
  }
}

showOptions();

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function fixFormat(){
  showOptions();
  for (let t of $$("textarea")){
    t.style.height = "1.6em";
    textareaResize(t);
  }
  for (let nr of $$(".number-range")){
    $(nr, "input[type=range]").value = $(nr, "input[type=number]").value;
  }
}