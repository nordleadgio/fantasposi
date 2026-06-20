(function () {

    const token =
        location.pathname.split("/").filter(Boolean).pop();
    const steps = [
        "Gli sposi",
        "Il rito",
        "Best Moment",
        "Momenti speciali",
        "Riepilogo"
    ];
    const $ = selector =>
        document.querySelector(selector);
    const $$ = selector =>
        Array.from(document.querySelectorAll(selector));

    let eventData = null;
    let answers = null;
    let currentStep = 0;
    let saveTimer = null;

    const els = {
        eventTitle: $("#eventTitle"),
        eventIntro: $("#eventIntro"),
        eventFacts: $("#eventFacts"),
        guestIntro: $("#guestIntro"),
        formShell: $("#formShell"),
        startButton: $("#startButton"),
        stepCounter: $("#stepCounter"),
        stepTitle: $("#stepTitle"),
        progressFill: $("#progressFill"),
        prevStep: $("#prevStep"),
        nextStep: $("#nextStep"),
        saveDraft: $("#saveDraft"),
        submitPlanner: $("#submitPlanner"),
        submitMessage: $("#submitMessage"),
        cakeExtraSongs: $("#cakeExtraSongs"),
        addCakeSong: $("#addCakeSong"),
        finalSummary: $("#finalSummary")
    };

    init();

    function init() {

        renderSongInputs();
        bindFields();

        els.startButton.addEventListener("click", () => {
            els.guestIntro.classList.add("hidden");
            els.formShell.classList.remove("hidden");
            renderStep();
        });
        els.prevStep.addEventListener("click", () => {
            currentStep =
                Math.max(0, currentStep - 1);
            renderStep();
        });
        els.nextStep.addEventListener("click", () => {
            save(false);
            currentStep =
                Math.min(steps.length - 1, currentStep + 1);
            renderStep();
        });
        els.saveDraft.addEventListener("click", () => save(false, true));
        els.submitPlanner.addEventListener("click", () => save(true, true));
        els.addCakeSong.addEventListener("click", addCakeSong);

        fetch(`/api/wedding-planner/public/${encodeURIComponent(token)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Scheda non trovata");
                }
                return response.json();
            })
            .then(data => {
                eventData = data;
                answers = data.answers || createEmptyAnswers();
                renderEvent();
                hydrateFields();
                renderCakeSongs();
                renderConditionals();
            })
            .catch(() => {
                els.eventTitle.textContent =
                    "Scheda non trovata";
                els.eventIntro.textContent =
                    "Controlla il link ricevuto oppure richiedilo alla regia musicale.";
                els.startButton.classList.add("hidden");
            });

    }

    function createEmptyAnswers() {

        return {
            couple: {},
            ceremony: {
                civilSeparateEntrances: true,
                startTime: "",
                churchName: "",
                churchTown: ""
            },
            reception: {
                cakeExtraSongs: []
            },
            specialMoments: {}
        };

    }

    function renderEvent() {

        els.eventTitle.textContent =
            eventData.title || "La vostra colonna sonora";
        els.eventIntro.textContent =
            eventData.introMessage || "";

        const facts = [
            eventData.weddingDate,
            eventData.venue
        ].filter(Boolean);

        els.eventFacts.innerHTML =
            facts.map(fact => `<span>${escapeHtml(fact)}</span>`).join("");

    }

    function renderSongInputs() {

        $$("[data-song]").forEach(container => {
            const base =
                container.dataset.song;
            container.innerHTML = `
                <div class="songFields">
                    <label>Canzone
                        <input data-field="${base}.title" type="text" placeholder="Titolo del brano">
                    </label>
                    <label>Artista
                        <input data-field="${base}.artist" type="text" placeholder="Nome artista">
                    </label>
                    <label class="wide">Link YouTube
                        <input data-field="${base}.youtubeUrl" type="url" placeholder="https://youtube.com/...">
                    </label>
                </div>
            `;
        });

    }

    function bindFields() {

        document.addEventListener("input", event => {
            const field =
                event.target.dataset.field;

            if (!field || !answers) {
                return;
            }

            writeField(field, readInput(event.target));
            renderConditionals();
            scheduleSave();
        });

        document.addEventListener("change", event => {
            const field =
                event.target.dataset.field;

            if (!field || !answers) {
                return;
            }

            writeField(field, readInput(event.target));
            renderConditionals();
            scheduleSave();
        });

    }

    function hydrateFields() {

        $$("[data-field]").forEach(input => {
            const value =
                readField(input.dataset.field);

            if (input.type === "checkbox") {
                input.checked = value === true;
                return;
            }

            if (input.type === "radio") {
                input.checked = value === input.value;
                return;
            }

            input.value =
                value || "";
        });

    }

    function readInput(input) {

        if (input.type === "checkbox") {
            return input.checked;
        }

        if (input.type === "radio") {
            return input.checked ? input.value : readField(input.dataset.field);
        }

        return input.value;

    }

    function readField(path) {

        return path.split(".").reduce(
            (value, key) => value && value[key],
            answers
        );

    }

    function writeField(path, value) {

        const parts =
            path.split(".");
        const last =
            parts.pop();
        let target =
            answers;

        parts.forEach(part => {
            if (!target[part] || typeof target[part] !== "object") {
                target[part] = {};
            }
            target = target[part];
        });

        target[last] =
            value;

    }

    function renderConditionals() {

        $$("[data-visible-when]").forEach(el => {
            el.classList.toggle(
                "hidden",
                readField(el.dataset.visibleWhen) !== true
            );
        });

        $$("[data-hidden-when]").forEach(el => {
            el.classList.toggle(
                "hidden",
                readField(el.dataset.hiddenWhen) === true
            );
        });

        $$("[data-visible-value]").forEach(el => {
            const [field, expected] =
                el.dataset.visibleValue.split(":");

            el.classList.toggle(
                "hidden",
                readField(field) !== expected
            );
        });

    }

    function addCakeSong() {

        answers.reception.cakeExtraSongs =
            answers.reception.cakeExtraSongs || [];
        answers.reception.cakeExtraSongs.push({
            title: "",
            artist: "",
            youtubeUrl: ""
        });
        renderCakeSongs();
        scheduleSave();

    }

    function renderCakeSongs() {

        const songs =
            answers.reception.cakeExtraSongs || [];

        els.cakeExtraSongs.innerHTML =
            songs.map((song, index) => `
                <article class="songBlock compactSong">
                    <div class="songBlockHeader">
                        <h3>Brano ${index + 1}</h3>
                        <button class="ghostButton" type="button" data-remove-cake="${index}">Rimuovi</button>
                    </div>
                    <div class="songFields">
                        <label>Canzone
                            <input type="text" value="${escapeAttr(song.title)}" data-cake-index="${index}" data-cake-field="title">
                        </label>
                        <label>Artista
                            <input type="text" value="${escapeAttr(song.artist)}" data-cake-index="${index}" data-cake-field="artist">
                        </label>
                        <label class="wide">Link YouTube
                            <input type="url" value="${escapeAttr(song.youtubeUrl)}" data-cake-index="${index}" data-cake-field="youtubeUrl">
                        </label>
                    </div>
                </article>
            `).join("");

        els.cakeExtraSongs.querySelectorAll("[data-cake-field]").forEach(input => {
            input.addEventListener("input", () => {
                const song =
                    answers.reception.cakeExtraSongs[Number(input.dataset.cakeIndex)];
                song[input.dataset.cakeField] =
                    input.value;
                scheduleSave();
            });
        });

        els.cakeExtraSongs.querySelectorAll("[data-remove-cake]").forEach(button => {
            button.addEventListener("click", () => {
                answers.reception.cakeExtraSongs.splice(
                    Number(button.dataset.removeCake),
                    1
                );
                renderCakeSongs();
                scheduleSave();
            });
        });

    }

    function renderStep() {

        $$(".formStep").forEach((step, index) => {
            step.classList.toggle("active", index === currentStep);
        });

        els.stepCounter.textContent =
            `Step ${currentStep + 1} di ${steps.length}`;
        els.stepTitle.textContent =
            steps[currentStep];
        els.progressFill.style.width =
            `${((currentStep + 1) / steps.length) * 100}%`;
        els.prevStep.disabled =
            currentStep === 0;
        els.nextStep.classList.toggle(
            "hidden",
            currentStep === steps.length - 1
        );
        els.submitPlanner.classList.toggle(
            "hidden",
            currentStep !== steps.length - 1
        );

        if (currentStep === steps.length - 1) {
            renderSummary();
        }

    }

    function renderSummary() {

        els.finalSummary.innerHTML =
            buildSummaryHtml(answers);

    }

    function scheduleSave() {

        clearTimeout(saveTimer);
        saveTimer =
            setTimeout(() => save(false), 800);

    }

    function save(submit, showMessage) {

        clearTimeout(saveTimer);

        return fetch(
            `/api/wedding-planner/public/${encodeURIComponent(token)}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    answers,
                    submit
                })
            }
        )
            .then(response => response.json())
            .then(data => {
                eventData = data;
                answers = data.answers || answers;
                if (showMessage) {
                    els.submitMessage.textContent =
                        submit ?
                            "Scheda inviata." :
                            "Bozza salvata.";
                }
            })
            .catch(() => {
                if (showMessage) {
                    els.submitMessage.textContent =
                        "Non riesco a salvare in questo momento. Riprova tra poco.";
                }
            });

    }

    function buildSummaryHtml(data) {

        const ceremonyType =
            data.ceremony.type === "civil" ?
                "Rito civile" :
                data.ceremony.type === "religious" ?
                    "Rito religioso" :
                    "Non indicato";

        return `
            ${summarySection("Sposi", [
                data.couple.groomFullName,
                data.couple.brideFullName,
                data.couple.groomAge && `Eta sposo: ${data.couple.groomAge}`,
                data.couple.brideAge && `Eta sposa: ${data.couple.brideAge}`,
                data.couple.hasChildren && `Figli: ${data.couple.childrenNames || "si"}`
            ])}
            ${summarySection("Rito", [
                ceremonyType,
                data.ceremony.startTime && `Orario inizio rito: ${data.ceremony.startTime}`,
                data.ceremony.type === "religious" && data.ceremony.churchName && `Chiesa: ${data.ceremony.churchName}`,
                data.ceremony.type === "religious" && data.ceremony.churchTown && `Paese chiesa: ${data.ceremony.churchTown}`,
                songLine("Ingresso sposo", data.ceremony.groomEntranceSong),
                songLine("Ingresso sposa", data.ceremony.brideEntranceSong),
                songLine("Ingresso insieme", data.ceremony.jointEntranceSong),
                songLine("Conclusione rito", data.ceremony.ceremonyClosingSong),
                songLine("Uscita sposi", data.ceremony.ceremonyExitSong),
                data.ceremony.religiousNotes
            ])}
            ${summarySection("Best Moment", [
                songLine("Arrivo location", data.reception.arrivalSong),
                songLine("Ingresso", data.reception.entranceSong),
                songLine("Ballo sposi", data.reception.firstDanceSong),
                songLine("Taglio torta", data.reception.cakeMainSong),
                ...(data.reception.cakeExtraSongs || []).map((song, index) =>
                    songLine(`Brano extra ${index + 1}`, song)
                )
            ])}
            ${summarySection("Momenti speciali", [
                data.specialMoments.parentDance && songLine("Ballo genitori", data.specialMoments.parentDanceSong),
                data.specialMoments.siblingDance && songLine("Ballo fratelli/sorelle", data.specialMoments.siblingDanceSong),
                data.specialMoments.childrenDance && songLine("Ballo figli", data.specialMoments.childrenDanceSong),
                data.specialMoments.dedications && `Dediche: ${data.specialMoments.dedications}`,
                data.specialMoments.otherRequests && `Altre richieste: ${data.specialMoments.otherRequests}`
            ])}
        `;

    }

    function summarySection(title, rows) {

        const cleanRows =
            rows.filter(Boolean);

        if (!cleanRows.length) {
            return "";
        }

        return `
            <article>
                <h3>${escapeHtml(title)}</h3>
                ${cleanRows.map(row => `<p>${escapeHtml(row)}</p>`).join("")}
            </article>
        `;

    }

    function songLine(label, song) {

        if (!song || (!song.title && !song.artist && !song.youtubeUrl)) {
            return "";
        }

        return `${label}: ${[song.title, song.artist].filter(Boolean).join(" - ")}${song.youtubeUrl ? ` (${song.youtubeUrl})` : ""}`;

    }

    function escapeHtml(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    function escapeAttr(value) {

        return escapeHtml(value);

    }

}());
