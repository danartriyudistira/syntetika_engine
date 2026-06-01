import { clamp } from "./utils.js";

export function renderNotePicker(picker, notes, onSelect) {
    if (!picker) return;
    picker.replaceChildren();
    notes.forEach((note) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "note-opt";
        button.dataset.note = note;
        button.textContent = note;
        button.addEventListener("click", () => onSelect?.(note));
        picker.appendChild(button);
    });
}

export function openNotePicker(picker, { kind, index, targetRect, selectedNote }) {
    if (!picker) return;
    picker.dataset.kind = kind;
    picker.dataset.stepIndex = String(index);
    picker.classList.add("open");
    picker.setAttribute("aria-hidden", "false");
    positionNotePicker(picker, targetRect);
    markSelectedNote(picker, selectedNote);
}

export function hideNotePicker(picker) {
    picker?.classList.remove("open");
    picker?.setAttribute("aria-hidden", "true");
}

export function notePickerContext(picker, validKinds) {
    const index = Number(picker?.dataset.stepIndex);
    const rawKind = picker?.dataset.kind;
    const kind = validKinds.includes(rawKind) && rawKind !== "drum" ? rawKind : "bass";
    return { kind, index };
}

function positionNotePicker(picker, targetRect) {
    const pickerWidth = picker.offsetWidth || 250;
    const pickerHeight = picker.offsetHeight || 220;
    const margin = 8;
    const left = clamp(targetRect.left, margin, window.innerWidth - pickerWidth - margin);
    let top = targetRect.bottom + margin;
    if (top + pickerHeight > window.innerHeight - margin) {
        top = targetRect.top - pickerHeight - margin;
    }
    picker.style.left = `${left}px`;
    picker.style.top = `${clamp(top, margin, window.innerHeight - pickerHeight - margin)}px`;
}

function markSelectedNote(picker, selectedNote) {
    picker.querySelectorAll(".note-opt").forEach((button) => {
        button.classList.toggle("selected", button.dataset.note === selectedNote);
    });
    const selectedButton = picker.querySelector(`.note-opt[data-note="${CSS.escape(selectedNote || "")}"]`);
    selectedButton?.scrollIntoView({ block: "center" });
}
