"use strict";
function cloneTemplate(selector) {
    const template = document.querySelector(selector)?.content.cloneNode(true);
    if (!template) {
        throw new Error(`'${selector}' template not found`);
    }
    return template;
}
