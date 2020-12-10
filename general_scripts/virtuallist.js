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

function createVirtualList(sbox, values, linkstring){
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
    rows.forEach(r => $remove(r));
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

    let a = $create("a");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.href = linkstring.replace(/\{1\}/g, i[0]);
    a.style.top = `${index * rh}px`;

    let span = $insert($insert(a, "li"), "span", {class: "link-search", text: i[2]});
    span.insertAdjacentText("beforebegin", i[1]);
    span.insertAdjacentText("afterend", i[i.length - 1]);

    return a;
  }

  function renderRows(sboxlist){
    let scrolly = sboxlist.scrollTop;

    let top = Math.max(0, Math.floor(scrolly / rh));
    let bottom = Math.min(listresult.length - 1, Math.ceil((scrolly + vph) / rh));

    for (let [i, r] of rows.entries()){
      if (i < top || i > bottom){
        $remove(r);
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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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