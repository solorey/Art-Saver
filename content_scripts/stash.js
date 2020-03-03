browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let stashes = "";
  if(request.req === "stashurls") {
    stashes = $$("div#gmi-StashStream > div#gmi-StashThumb span.shadow > a").map(s => s.href);
  }
  sendResponse({content: stashes});
});