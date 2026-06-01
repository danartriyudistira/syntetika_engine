export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function setText(element, text) {
    if (element) element.textContent = text;
}

export function pulseButton(button, duration = 220) {
    if (!button) return;
    button.classList.add("active");
    window.setTimeout(() => button.classList.remove("active"), duration);
}

export function setEngineState(element, text) {
    setText(element, text);
}
