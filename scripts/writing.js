"use strict";
function cleanWriting(element, remove_attrs) {
    element = DOMPurify.sanitize(element, {
        IN_PLACE: true,
        FORBID_TAGS: ['style'],
        FORBID_ATTR: remove_attrs ?? [],
        ALLOW_DATA_ATTR: false,
    });
    // remove unnecessary div and span elements
    for (const elem of element.querySelectorAll('div, span')) {
        if (elem.attributes.length <= 0) {
            elem.before(...elem.childNodes);
            elem.parentElement?.removeChild(elem);
        }
    }
    element.normalize();
    doubleBrToP(element);
    // remove double spacing
    for (const elem of element.querySelectorAll('p + br + p, p + br + br')) {
        const spacer = elem.previousElementSibling;
        spacer?.parentElement?.removeChild(spacer);
    }
    // remove empty paragraphs
    for (const elem of element.querySelectorAll('p')) {
        if (!elem.firstChild) {
            elem.parentElement?.removeChild(elem);
        }
    }
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function doubleBrToP(element) {
    // split text nodes into paragraphs
    const block_node_names = [
        'ADDRESS',
        'ARTICLE',
        'ASIDE',
        'BLOCKQUOTE',
        'DETAILS',
        'DIV',
        'DL',
        'FIELDSET',
        'FIGCAPTION',
        'FIGURE',
        'FOOTER',
        'FORM',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'HEADER',
        'HGROUP',
        'HR',
        'MAIN',
        'MENU',
        'NAV',
        'OL',
        'P',
        'PRE',
        'SEARCH',
        'SECTION',
        'TABLE',
        'UL',
    ];
    let child = element.firstChild;
    const div = document.createElement('div');
    let p = document.createElement('p');
    const addP = () => {
        while (p.lastChild?.nodeName === 'BR') {
            p.removeChild(p.lastChild);
        }
        if (p.hasChildNodes()) {
            div.append(p);
            p = document.createElement('p');
        }
    };
    while (child) {
        const type = child.nodeName;
        const next = child.nextSibling;
        if (!p.hasChildNodes() && type === 'BR') {
            child = next;
            continue;
        }
        const has_breaks = Boolean(child.querySelector?.('br'));
        if (block_node_names.includes(type) || has_breaks) {
            addP();
            if (child.nodeName === 'P') {
                div.append(...doubleBrToP(child).childNodes);
            }
            else if (has_breaks) {
                div.append(doubleBrToP(child));
            }
            else {
                div.append(child);
            }
            child = next;
            continue;
        }
        p.append(child);
        if (p.lastChild?.nodeName === 'BR' && p.lastChild?.previousSibling?.nodeName === 'BR') {
            addP();
        }
        child = next;
    }
    addP();
    element.replaceChildren(...div.childNodes);
    return element;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getElementText(element) {
    element.querySelectorAll('li').forEach((li) => li.prepend('  ●  '));
    const renderer = document.createElement('div');
    renderer?.classList.add('artsaver-text-render');
    renderer.append(...element.childNodes);
    document.body.append(renderer);
    let text = renderer.innerText;
    // fix for lists
    text = text.replaceAll('  ●  \n\n', '  ●  ');
    renderer.parentElement?.removeChild(renderer);
    return text;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function wordCount(text) {
    // https://www.regular-expressions.info/unicode.html#category
    return text.replace(/[^\p{L}\s]+/gu, '').match(/\p{L}+/gu)?.length ?? 0;
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function embedImages(content) {
    for (const img of content.querySelectorAll('img')) {
        img.src = await urlToDataUrl(img.src);
    }
}
