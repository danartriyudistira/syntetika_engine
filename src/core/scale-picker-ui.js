export function renderScalePicker({
    rootHost,
    optionHost,
    mode,
    drumGenres,
    noteRoots,
    scales
}) {
    if (!rootHost || !optionHost) return;
    rootHost.replaceChildren();
    optionHost.replaceChildren();

    if (mode === "drum") {
        rootHost.hidden = true;
        drumGenres.forEach((genre) => {
            optionHost.append(createScaleOptionButton({
                datasetKey: "drumGenre",
                datasetValue: genre.id,
                title: genre.label,
                description: genre.description
            }));
        });
        return;
    }

    rootHost.hidden = false;
    noteRoots.forEach((root) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-scale-root";
        button.dataset.scaleRoot = root;
        button.textContent = root;
        rootHost.appendChild(button);
    });

    scales.forEach((scale) => {
        optionHost.append(createScaleOptionButton({
            datasetKey: "scaleId",
            datasetValue: scale.id,
            title: scale.label,
            description: scale.notes.join(" ")
        }));
    });
}

function createScaleOptionButton({ datasetKey, datasetValue, title, description }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-scale-option";
    button.dataset[datasetKey] = datasetValue;

    const titleEl = document.createElement("span");
    titleEl.textContent = title;
    const descriptionEl = document.createElement("small");
    descriptionEl.textContent = description;
    button.append(titleEl, descriptionEl);
    return button;
}
