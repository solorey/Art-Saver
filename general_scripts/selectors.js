function $(arg1, arg2){
	return arg2 ? arg1.querySelector(arg2) : document.querySelector(arg1);
}

function $$(arg1, arg2){
	let nodes = arg2 ? arg1.querySelectorAll(arg2) : document.querySelectorAll(arg1);
	return [...nodes];
}

function $remove(element){
	if (element){
		element.parentElement.removeChild(element);
	}
}

function $create(element){
	return document.createElement(element);
}

function $insert(elem1, elem2, attrs = {}){
	attrs = {
		position: "beforeend",
		...attrs
	};

	let newelem = $create(elem2);

	for (let [attribute, value] of Object.entries(attrs)) {
		switch (attribute){
			case "position":
				if (value === "parent"){
					elem1.insertAdjacentElement("beforebegin", newelem);
					newelem.insertAdjacentElement("beforeend", elem1);
				}
				else {
					elem1.insertAdjacentElement(value, newelem);
				}
				break;

			case "class":
				newelem.className = value;
				break;

			case "text":
				newelem.textContent = value;
				break;

			default:
				newelem.setAttribute(attribute, value);
		}
	}

	return newelem;
}

function classToggle(condition, element, classname){
	if (condition){
		element.classList.add(classname);
	}
	else {
		element.classList.remove(classname);
	}
}