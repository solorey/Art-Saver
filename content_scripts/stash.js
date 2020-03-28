browser.runtime.onMessage.addListener(request => {
  let stashes = "";
  if(request.req === "stashurls") {
    stashes = $$("div#gmi-StashStream > div#gmi-StashThumb span.shadow > a").map(s => s.href);
  }
  return {content: stashes};
});