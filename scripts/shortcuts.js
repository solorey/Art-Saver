"use strict";
function getShortcutFromEvent(event) {
    let modifiers;
    if (window.navigator.userAgent.includes('Mac OS')) {
        modifiers = {
            MacCtrl: event.ctrlKey,
            Alt: event.altKey,
            Command: event.metaKey,
            Shift: event.shiftKey,
        };
    }
    else {
        modifiers = {
            Ctrl: event.ctrlKey,
            Alt: event.altKey,
            Shift: event.shiftKey,
        };
    }
    return Object.entries(modifiers)
        .filter(([_, active]) => active)
        .map(([key, _]) => key)
        .concat(normalizeKey(event.key) ?? normalizeKey(event.code) ?? '')
        .join('+');
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function normalizeKey(key) {
    const letters = /^[a-zA-Z]$/;
    if (letters.test(key)) {
        return key.toUpperCase();
    }
    const digits = /^(?:Digit|Numpad)?([0-9])$/.exec(key);
    if (digits) {
        return digits[1];
    }
    const funcs = /^F(?:[0-9]|1[0-2])$/;
    const others = /^(?:Insert|Delete|Home|End|Page(?:Up|Down))$/;
    const medias = /^(?:Media(?:PlayPause|Stop|(?:(?:Next|Prev)Track)))$/;
    if (funcs.test(key) || others.test(key) || medias.test(key)) {
        return key;
    }
    const space = /^\s$/;
    if (space.test(key)) {
        return 'Space';
    }
    const arrows = /^(?:Arrow(Up|Down|Left|Right))$/.exec(key);
    if (arrows) {
        return arrows[1];
    }
    if (key === ',') {
        return 'Comma';
    }
    if (key === '.') {
        return 'Period';
    }
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function shortcutsMatch(shortcut_1, shortcut_2) {
    return Boolean(shortcut_1 && shortcut_2 && shortcut_1 === shortcut_2);
}
