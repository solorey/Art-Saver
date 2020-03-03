function $(arg1, arg2){
  return arg2 ? arg1.querySelector(arg2) : document.querySelector(arg1);
}

function $$(arg1, arg2){
  let nodes = arg2 ? arg1.querySelectorAll(arg2) : document.querySelectorAll(arg1);
  return [...nodes];
}

function removeElement(element){
  if (element){
    element.parentElement.removeChild(element);
  }
}