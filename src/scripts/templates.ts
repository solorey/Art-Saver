function cloneTemplate(selector: string) {
    const template = document.querySelector<HTMLTemplateElement>(selector)?.content.cloneNode(true);
    if (!template) {
        throw new Error(`'${selector}' template not found`);
    }
    return template as DocumentFragment;
}
