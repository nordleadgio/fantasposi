(function () {

    const token =
        location.pathname.split("/").filter(Boolean).pop();
    const autoOpenForm =
        new URLSearchParams(location.search).get("admin") === "1";
    const steps = [
        "Gli sposi",
        "Il rito",
        "Best Moments",
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
        civilCustomMoments: $("#civilCustomMoments"),
        addCivilMoment: $("#addCivilMoment"),
        specialCustomMoments: $("#specialCustomMoments"),
        addSpecialMoment: $("#addSpecialMoment"),
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
        els.addCivilMoment.addEventListener("click", addCivilMoment);
        els.addSpecialMoment.addEventListener("click", addSpecialMoment);
        $$("[data-add-extra-song]").forEach(button => {
            button.addEventListener("click", () =>
                addCeremonyExtraSong(button.dataset.addExtraSong)
            );
        });
        $$("[data-add-reception-extra-song]").forEach(button => {
            button.addEventListener("click", () =>
                addReceptionExtraSong(button.dataset.addReceptionExtraSong)
            );
        });
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
                renderCeremonyExtras();
                renderCivilMoments();
                renderSpecialMoments();
                renderReceptionExtras();
                renderCakeSongs();
                renderConditionals();

                if (autoOpenForm) {
                    els.guestIntro.classList.add("hidden");
                    els.formShell.classList.remove("hidden");
                    renderStep();
                }
            })
            .catch(() => {
                els.eventTitle.textContent =
                    "Scheda non trovata";
                els.eventIntro.textContent =
                    "Controlla il link ricevuto oppure richiedine uno nuovo.";
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
                churchTown: "",
                groomEntranceExtraSongs: [],
                brideEntranceExtraSongs: [],
                jointEntranceExtraSongs: [],
                ceremonyClosingExtraSongs: [],
                ceremonyExitExtraSongs: [],
                civilCustomMoments: [],
                civilNotes: "",
                religiousNotes: ""
            },
            reception: {
                mealType: "",
                guestCount: "",
                arrivalExtraSongs: [],
                entranceExtraSongs: [],
                firstDanceExtraSongs: [],
                cakeExtraSongs: []
            },
            specialMoments: {
                customMoments: []
            }
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

        document.addEventListener("click", event => {
            const addCivilMomentSong =
                event.target.closest("[data-add-civil-moment-song]");
            const removeCivilMoment =
                event.target.closest("[data-remove-civil-moment]");
            const removeCivilMomentSong =
                event.target.closest("[data-remove-civil-moment-song]");

            if (addCivilMomentSong) {
                event.preventDefault();
                addCivilMomentExtraSong(Number(addCivilMomentSong.dataset.addCivilMomentSong));
                return;
            }

            if (removeCivilMoment) {
                event.preventDefault();
                removeCivilMomentAt(Number(removeCivilMoment.dataset.removeCivilMoment));
                return;
            }

            if (removeCivilMomentSong) {
                event.preventDefault();
                removeCivilMomentExtraSong(
                    Number(removeCivilMomentSong.dataset.removeCivilMomentSong),
                    Number(removeCivilMomentSong.dataset.removeCivilMomentSongIndex)
                );
            }
        });

        document.addEventListener("input", event => {
            const field =
                event.target.dataset.field;

            if (handleDynamicField(event.target, true)) {
                return;
            }

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

            if (handleDynamicField(event.target, true)) {
                return;
            }

            if (!field || !answers) {
                return;
            }

            writeField(field, readInput(event.target));
            renderConditionals();
            scheduleSave();
        });

    }

    function handleDynamicField(input, shouldSchedule) {

        if (!answers || !input || !input.dataset) {
            return false;
        }

        if ("extraSongField" in input.dataset) {
            const songs =
                answers.ceremony[input.dataset.extraSongKey] || [];
            const song =
                songs[Number(input.dataset.extraSongIndex)];

            if (!song) {
                return true;
            }

            song[input.dataset.extraSongField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        if ("civilMomentField" in input.dataset) {
            const moment =
                (answers.ceremony.civilCustomMoments || [])[Number(input.dataset.civilMomentIndex)];

            if (!moment) {
                return true;
            }

            moment[input.dataset.civilMomentField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        if ("civilMomentSongField" in input.dataset) {
            const moment =
                (answers.ceremony.civilCustomMoments || [])[Number(input.dataset.civilMomentIndex)];

            if (!moment) {
                return true;
            }

            moment.song =
                moment.song || emptySong();
            moment.song[input.dataset.civilMomentSongField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        if ("civilMomentExtraField" in input.dataset) {
            const moment =
                (answers.ceremony.civilCustomMoments || [])[Number(input.dataset.civilMomentIndex)];
            const song =
                moment &&
                Array.isArray(moment.extraSongs) &&
                moment.extraSongs[Number(input.dataset.civilMomentExtraIndex)];

            if (!song) {
                return true;
            }

            song[input.dataset.civilMomentExtraField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        if ("receptionExtraField" in input.dataset) {
            const songs =
                answers.reception[input.dataset.receptionExtraKey] || [];
            const song =
                songs[Number(input.dataset.receptionExtraIndex)];

            if (!song) {
                return true;
            }

            song[input.dataset.receptionExtraField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        if ("cakeField" in input.dataset) {
            const song =
                (answers.reception.cakeExtraSongs || [])[Number(input.dataset.cakeIndex)];

            if (!song) {
                return true;
            }

            song[input.dataset.cakeField] =
                input.value;
            if (shouldSchedule) {
                scheduleSave();
            }
            return true;
        }

        return false;

    }

    function syncDynamicFieldsFromDom() {

        $$([
            "[data-extra-song-field]",
            "[data-civil-moment-field]",
            "[data-civil-moment-song-field]",
            "[data-civil-moment-extra-field]",
            "[data-reception-extra-field]",
            "[data-cake-field]"
        ].join(",")).forEach(input => {
            handleDynamicField(input, false);
        });

    }

    function syncStandardFieldsFromDom() {

        $$("[data-field]").forEach(input => {
            if (input.type === "radio" && !input.checked) {
                return;
            }

            writeField(input.dataset.field, readInput(input));
        });

        renderConditionals();

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

        $$("[data-hidden-value]").forEach(el => {
            const [field, expected] =
                el.dataset.hiddenValue.split(":");

            el.classList.toggle(
                "hidden",
                readField(field) === expected
            );
        });

    }

    function emptySong() {

        return {
            title: "",
            artist: "",
            youtubeUrl: ""
        };

    }

    function addCeremonyExtraSong(key) {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        answers.ceremony[key] =
            Array.isArray(answers.ceremony[key]) ? answers.ceremony[key] : [];
        answers.ceremony[key].push(emptySong());
        renderCeremonyExtras();
        scheduleSave();

    }

    function renderCeremonyExtras() {

        $$("[data-extra-songs]").forEach(container => {
            const key =
                container.dataset.extraSongs;
            const songs =
                Array.isArray(answers.ceremony[key]) ? answers.ceremony[key] : [];

            container.innerHTML =
                songs.map((song, index) => extraSongHtml(key, song, index)).join("");
        });

        $$("[data-extra-song-field]").forEach(input => {
            input.addEventListener("input", () => {
                const songs =
                    answers.ceremony[input.dataset.extraSongKey] || [];
                const song =
                    songs[Number(input.dataset.extraSongIndex)];

                if (!song) {
                    return;
                }

                song[input.dataset.extraSongField] =
                    input.value;
                scheduleSave();
            });
        });

        $$("[data-remove-extra-song]").forEach(button => {
            button.addEventListener("click", () => {
                syncStandardFieldsFromDom();
                syncDynamicFieldsFromDom();

                const songs =
                    answers.ceremony[button.dataset.removeExtraSong] || [];

                songs.splice(Number(button.dataset.removeExtraSongIndex), 1);
                renderCeremonyExtras();
                scheduleSave();
            });
        });

    }

    function extraSongHtml(key, song, index) {

        return `
            <article class="songBlock compactSong nestedSong">
                <div class="songBlockHeader">
                    <h3>Brano aggiuntivo ${index + 1}</h3>
                    <button class="ghostButton" type="button" data-remove-extra-song="${key}" data-remove-extra-song-index="${index}">Rimuovi</button>
                </div>
                <div class="songFields">
                    <label>Canzone
                        <input type="text" value="${escapeAttr(song.title)}" data-field="ceremony.${key}.${index}.title" data-extra-song-key="${key}" data-extra-song-index="${index}" data-extra-song-field="title">
                    </label>
                    <label>Artista
                        <input type="text" value="${escapeAttr(song.artist)}" data-field="ceremony.${key}.${index}.artist" data-extra-song-key="${key}" data-extra-song-index="${index}" data-extra-song-field="artist">
                    </label>
                    <label class="wide">Link YouTube
                        <input type="url" value="${escapeAttr(song.youtubeUrl)}" data-field="ceremony.${key}.${index}.youtubeUrl" data-extra-song-key="${key}" data-extra-song-index="${index}" data-extra-song-field="youtubeUrl">
                    </label>
                </div>
            </article>
        `;

    }

    function addCivilMoment() {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        answers.ceremony.civilCustomMoments =
            Array.isArray(answers.ceremony.civilCustomMoments) ?
                answers.ceremony.civilCustomMoments :
                [];
        answers.ceremony.civilCustomMoments.push({
            title: "",
            song: emptySong(),
            extraSongs: []
        });
        renderCivilMoments();
        scheduleSave();

    }

    function renderCivilMoments() {

        const moments =
            Array.isArray(answers.ceremony.civilCustomMoments) ?
                answers.ceremony.civilCustomMoments :
                [];

        els.civilCustomMoments.innerHTML =
            moments.map((moment, index) => `
                <article class="songBlock compactSong customMoment">
                    <div class="songBlockHeader">
                        <h3>Momento ${index + 1}</h3>
                        <button class="ghostButton" type="button" data-remove-civil-moment="${index}" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.weddingPlannerRemoveCivilMoment(${index}); return false;">Rimuovi</button>
                    </div>
                    <label>Titolo del momento
                        <input type="text" value="${escapeAttr(moment.title)}" data-field="ceremony.civilCustomMoments.${index}.title" placeholder="Es. Ingresso fedi">
                    </label>
                    <div class="songFields">
                        <label>Canzone
                            <input type="text" value="${escapeAttr(moment.song && moment.song.title)}" data-field="ceremony.civilCustomMoments.${index}.song.title">
                        </label>
                        <label>Artista
                            <input type="text" value="${escapeAttr(moment.song && moment.song.artist)}" data-field="ceremony.civilCustomMoments.${index}.song.artist">
                        </label>
                        <label class="wide">Link YouTube
                            <input type="url" value="${escapeAttr(moment.song && moment.song.youtubeUrl)}" data-field="ceremony.civilCustomMoments.${index}.song.youtubeUrl">
                        </label>
                    </div>
                    <div data-civil-moment-extra-songs="${index}">
                        ${(moment.extraSongs || []).map((song, songIndex) => `
                            <article class="songBlock compactSong nestedSong">
                                <div class="songBlockHeader">
                                    <h3>Brano aggiuntivo ${songIndex + 1}</h3>
                                    <button class="ghostButton" type="button" data-remove-civil-moment-song="${index}" data-remove-civil-moment-song-index="${songIndex}" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.weddingPlannerRemoveCivilMomentSong(${index}, ${songIndex}); return false;">Rimuovi</button>
                                </div>
                                <div class="songFields">
                                    <label>Canzone
                                        <input type="text" value="${escapeAttr(song.title)}" data-field="ceremony.civilCustomMoments.${index}.extraSongs.${songIndex}.title">
                                    </label>
                                    <label>Artista
                                        <input type="text" value="${escapeAttr(song.artist)}" data-field="ceremony.civilCustomMoments.${index}.extraSongs.${songIndex}.artist">
                                    </label>
                                    <label class="wide">Link YouTube
                                        <input type="url" value="${escapeAttr(song.youtubeUrl)}" data-field="ceremony.civilCustomMoments.${index}.extraSongs.${songIndex}.youtubeUrl">
                                    </label>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                    <button class="secondaryButton" type="button" data-add-civil-moment-song="${index}" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.weddingPlannerAddCivilMomentSong(${index}); return false;">Aggiungi brano</button>
                </article>
            `).join("");

        bindCivilMomentFields();

    }

    function bindCivilMomentFields() {

        $$("[data-civil-moment-field], [data-civil-moment-song-field], [data-civil-moment-extra-field]").forEach(input => {
            input.addEventListener("input", () => {
                handleDynamicField(input, true);
            });
        });

        $$("[data-add-civil-moment-song]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                addCivilMomentExtraSong(Number(button.dataset.addCivilMomentSong));
            });
        });

        $$("[data-remove-civil-moment]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                removeCivilMomentAt(Number(button.dataset.removeCivilMoment));
            });
        });

        $$("[data-remove-civil-moment-song]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                removeCivilMomentExtraSong(
                    Number(button.dataset.removeCivilMomentSong),
                    Number(button.dataset.removeCivilMomentSongIndex)
                );
            });
        });

    }

    function addCivilMomentExtraSong(momentIndex) {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        const moment =
            (answers.ceremony.civilCustomMoments || [])[momentIndex];

        if (!moment) {
            return;
        }

        moment.extraSongs =
            Array.isArray(moment.extraSongs) ? moment.extraSongs : [];
        moment.extraSongs.push(emptySong());
        renderCivilMoments();
        scheduleSave();

    }

    function removeCivilMomentAt(momentIndex) {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        if (!Array.isArray(answers.ceremony.civilCustomMoments)) {
            return;
        }

        answers.ceremony.civilCustomMoments.splice(momentIndex, 1);
        renderCivilMoments();
        scheduleSave();

    }

    function removeCivilMomentExtraSong(momentIndex, songIndex) {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        const moment =
            (answers.ceremony.civilCustomMoments || [])[momentIndex];

        if (!moment || !Array.isArray(moment.extraSongs)) {
            return;
        }

        moment.extraSongs.splice(songIndex, 1);
        renderCivilMoments();
        scheduleSave();

    }

    function addSpecialMoment() {

        syncStandardFieldsFromDom();

        answers.specialMoments.customMoments =
            Array.isArray(answers.specialMoments.customMoments) ?
                answers.specialMoments.customMoments :
                [];
        answers.specialMoments.customMoments.push({
            title: "",
            song: emptySong()
        });
        renderSpecialMoments();
        scheduleSave();

    }

    function renderSpecialMoments() {

        const moments =
            Array.isArray(answers.specialMoments.customMoments) ?
                answers.specialMoments.customMoments :
                [];

        els.specialCustomMoments.innerHTML =
            moments.map((moment, index) => `
                <article class="songBlock compactSong customMoment">
                    <div class="songBlockHeader">
                        <h3>Momento ${index + 1}</h3>
                        <button class="ghostButton" type="button" onclick="event.preventDefault(); event.stopImmediatePropagation(); window.weddingPlannerRemoveSpecialMoment(${index}); return false;">Rimuovi</button>
                    </div>
                    <label>Titolo del momento
                        <input type="text" value="${escapeAttr(moment.title)}" data-field="specialMoments.customMoments.${index}.title" placeholder="Es. Brindisi, sorpresa, dedica">
                    </label>
                    <div class="songFields">
                        <label>Canzone
                            <input type="text" value="${escapeAttr(moment.song && moment.song.title)}" data-field="specialMoments.customMoments.${index}.song.title">
                        </label>
                        <label>Artista
                            <input type="text" value="${escapeAttr(moment.song && moment.song.artist)}" data-field="specialMoments.customMoments.${index}.song.artist">
                        </label>
                        <label class="wide">Link YouTube
                            <input type="url" value="${escapeAttr(moment.song && moment.song.youtubeUrl)}" data-field="specialMoments.customMoments.${index}.song.youtubeUrl">
                        </label>
                    </div>
                </article>
            `).join("");

    }

    function removeSpecialMomentAt(momentIndex) {

        syncStandardFieldsFromDom();

        if (!Array.isArray(answers.specialMoments.customMoments)) {
            return;
        }

        answers.specialMoments.customMoments.splice(momentIndex, 1);
        renderSpecialMoments();
        scheduleSave();

    }

    function addReceptionExtraSong(key) {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        answers.reception[key] =
            Array.isArray(answers.reception[key]) ? answers.reception[key] : [];
        answers.reception[key].push(emptySong());
        renderReceptionExtras();
        scheduleSave();

    }

    function renderReceptionExtras() {

        $$("[data-reception-extra-songs]").forEach(container => {
            const key =
                container.dataset.receptionExtraSongs;
            const songs =
                Array.isArray(answers.reception[key]) ? answers.reception[key] : [];

            container.innerHTML =
                songs.map((song, index) => receptionExtraSongHtml(key, song, index)).join("");
        });

        $$("[data-reception-extra-field]").forEach(input => {
            input.addEventListener("input", () => {
                const songs =
                    answers.reception[input.dataset.receptionExtraKey] || [];
                const song =
                    songs[Number(input.dataset.receptionExtraIndex)];

                if (!song) {
                    return;
                }

                song[input.dataset.receptionExtraField] =
                    input.value;
                scheduleSave();
            });
        });

        $$("[data-remove-reception-extra]").forEach(button => {
            button.addEventListener("click", () => {
                syncStandardFieldsFromDom();
                syncDynamicFieldsFromDom();

                const songs =
                    answers.reception[button.dataset.removeReceptionExtra] || [];

                songs.splice(Number(button.dataset.removeReceptionExtraIndex), 1);
                renderReceptionExtras();
                scheduleSave();
            });
        });

    }

    function receptionExtraSongHtml(key, song, index) {

        return `
            <article class="songBlock compactSong nestedSong">
                <div class="songBlockHeader">
                    <h3>Brano aggiuntivo ${index + 1}</h3>
                    <button class="ghostButton" type="button" data-remove-reception-extra="${key}" data-remove-reception-extra-index="${index}">Rimuovi</button>
                </div>
                <div class="songFields">
                    <label>Canzone
                        <input type="text" value="${escapeAttr(song.title)}" data-field="reception.${key}.${index}.title" data-reception-extra-key="${key}" data-reception-extra-index="${index}" data-reception-extra-field="title">
                    </label>
                    <label>Artista
                        <input type="text" value="${escapeAttr(song.artist)}" data-field="reception.${key}.${index}.artist" data-reception-extra-key="${key}" data-reception-extra-index="${index}" data-reception-extra-field="artist">
                    </label>
                    <label class="wide">Link YouTube
                        <input type="url" value="${escapeAttr(song.youtubeUrl)}" data-field="reception.${key}.${index}.youtubeUrl" data-reception-extra-key="${key}" data-reception-extra-index="${index}" data-reception-extra-field="youtubeUrl">
                    </label>
                </div>
            </article>
        `;

    }

    function addCakeSong() {

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();

        answers.reception.cakeExtraSongs =
            answers.reception.cakeExtraSongs || [];
        answers.reception.cakeExtraSongs.push(emptySong());
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
                            <input type="text" value="${escapeAttr(song.title)}" data-field="reception.cakeExtraSongs.${index}.title" data-cake-index="${index}" data-cake-field="title">
                        </label>
                        <label>Artista
                            <input type="text" value="${escapeAttr(song.artist)}" data-field="reception.cakeExtraSongs.${index}.artist" data-cake-index="${index}" data-cake-field="artist">
                        </label>
                        <label class="wide">Link YouTube
                            <input type="url" value="${escapeAttr(song.youtubeUrl)}" data-field="reception.cakeExtraSongs.${index}.youtubeUrl" data-cake-index="${index}" data-cake-field="youtubeUrl">
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
                syncStandardFieldsFromDom();
                syncDynamicFieldsFromDom();

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

        syncStandardFieldsFromDom();
        syncDynamicFieldsFromDom();
        clearTimeout(saveTimer);

        if (showMessage) {
            setFormMessage(
                submit ?
                    "Invio della scheda in corso..." :
                    "Salvataggio in corso...",
                "loading",
                false
            );
        }

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
                    setFormMessage(
                        submit ?
                            "Scheda inviata correttamente. Grazie, abbiamo ricevuto le vostre scelte." :
                            "Scheda salvata correttamente. Potete continuare o tornare a modificarla quando volete.",
                        "success",
                        true
                    );
                }
            })
            .catch(() => {
                if (showMessage) {
                    setFormMessage(
                        "Non riesco a salvare in questo momento. Riprova tra poco.",
                        "error",
                        true
                    );
                }
            });

    }

    function setFormMessage(message, type, focusMessage) {

        els.submitMessage.textContent =
            message;
        els.submitMessage.dataset.type =
            type;
        els.submitMessage.classList.add("isVisible");

        if (focusMessage) {
            els.submitMessage.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }

    }

    function buildSummaryHtml(data) {

        const ceremonyType =
            data.ceremony.type === "civil" ?
                "Rito civile" :
                data.ceremony.type === "religious" ?
                    "Rito religioso" :
                    data.ceremony.type === "noRite" ?
                        "Rito non richiesto" :
                        "Non indicato";
        const religiousProgram =
            eventData && eventData.religiousProgram && eventData.religiousProgram.confirmed ?
                eventData.religiousProgram :
                null;
        const religiousProgramRows =
            religiousProgram ?
                [
                    "Programma rito religioso confermato",
                    ...religiousProgram.moments
                        .map(moment => {
                            const selected =
                                moment.selected === "Altro" ?
                                    moment.otherText :
                                    moment.selected;
                            return selected && textLine(moment.title, selected);
                        })
                        .filter(Boolean)
                ] :
                [];

        const riteSummary =
            summarySection("Riepilogo rito", [
                ceremonyType,
                data.ceremony.startTime && `Orario inizio rito: ${data.ceremony.startTime}`,
                data.ceremony.type === "religious" && data.ceremony.churchName && `Chiesa: ${data.ceremony.churchName}`,
                data.ceremony.type === "religious" && data.ceremony.churchTown && `Paese chiesa: ${data.ceremony.churchTown}`,
                ...religiousProgramRows,
                songLine("Ingresso sposo", data.ceremony.groomEntranceSong),
                ...(data.ceremony.groomEntranceExtraSongs || []).map((song, index) =>
                    songLine(`Ingresso sposo - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Ingresso sposa", data.ceremony.brideEntranceSong),
                ...(data.ceremony.brideEntranceExtraSongs || []).map((song, index) =>
                    songLine(`Ingresso sposa - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Ingresso insieme", data.ceremony.jointEntranceSong),
                ...(data.ceremony.jointEntranceExtraSongs || []).map((song, index) =>
                    songLine(`Ingresso insieme - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Conclusione rito", data.ceremony.ceremonyClosingSong),
                ...(data.ceremony.ceremonyClosingExtraSongs || []).map((song, index) =>
                    songLine(`Conclusione rito - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Uscita sposi", data.ceremony.ceremonyExitSong),
                ...(data.ceremony.ceremonyExitExtraSongs || []).map((song, index) =>
                    songLine(`Uscita sposi - brano aggiuntivo ${index + 1}`, song)
                ),
                ...(data.ceremony.civilCustomMoments || []).flatMap((moment, index) => [
                    moment.title && `Momento personalizzato ${index + 1}: ${moment.title}`,
                    songLine(moment.title || `Momento personalizzato ${index + 1}`, moment.song),
                    ...((moment.extraSongs || []).map((song, songIndex) =>
                        songLine(`${moment.title || `Momento personalizzato ${index + 1}`} - brano aggiuntivo ${songIndex + 1}`, song)
                    ))
                ]),
                data.ceremony.civilNotes && textLine("Altre richieste rito civile", data.ceremony.civilNotes),
                data.ceremony.religiousNotes && textLine("Note rito", data.ceremony.religiousNotes)
            ]);

        const mainSummary = `
            ${summarySection("Sposi", [
                data.couple.groomFullName,
                data.couple.brideFullName,
                data.couple.groomAge && `Eta sposo: ${data.couple.groomAge}`,
                data.couple.brideAge && `Eta sposa: ${data.couple.brideAge}`,
                data.couple.hasChildren && `Figli: ${data.couple.childrenNames || "si"}`
            ])}
            ${summarySection("Riepilogo festa e location", [
                data.reception.mealType && `Servizio: ${data.reception.mealType}`,
                data.reception.guestCount && `Invitati: ${data.reception.guestCount}`,
                songLine("Arrivo location", data.reception.arrivalSong),
                ...(data.reception.arrivalExtraSongs || []).map((song, index) =>
                    songLine(`Arrivo location - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Ingresso", data.reception.entranceSong),
                ...(data.reception.entranceExtraSongs || []).map((song, index) =>
                    songLine(`Ingresso - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Ballo sposi", data.reception.firstDanceSong),
                ...(data.reception.firstDanceExtraSongs || []).map((song, index) =>
                    songLine(`Ballo sposi - brano aggiuntivo ${index + 1}`, song)
                ),
                songLine("Taglio torta", data.reception.cakeMainSong),
                ...(data.reception.cakeExtraSongs || []).map((song, index) =>
                    songLine(`Taglio torta - brano aggiuntivo ${index + 1}`, song)
                )
            ])}
            ${summarySection("Momenti speciali", [
                data.specialMoments.parentDance && songLine("Ballo genitori", data.specialMoments.parentDanceSong),
                data.specialMoments.siblingDance && songLine("Ballo fratelli/sorelle", data.specialMoments.siblingDanceSong),
                data.specialMoments.childrenDance && songLine("Ballo figli", data.specialMoments.childrenDanceSong),
                ...(data.specialMoments.customMoments || []).flatMap((moment, index) => [
                    moment.title && `Momento personalizzato ${index + 1}: ${moment.title}`,
                    songLine(moment.title || `Momento personalizzato ${index + 1}`, moment.song)
                ]),
                data.specialMoments.dedications && textLine("Dediche", data.specialMoments.dedications),
                data.specialMoments.otherRequests && textLine("Altre richieste", data.specialMoments.otherRequests)
            ])}
        `;

        return `${riteSummary}${mainSummary}`;

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
                ${cleanRows.map(renderSummaryRow).join("")}
            </article>
        `;

    }

    function renderSummaryRow(row) {

        if (typeof row === "object" && row.type === "song") {
            return `
                <div class="summaryRow songSummaryRow">
                    <span class="summaryLabel">${escapeHtml(row.label)}</span>
                    <span class="summaryValue">
                        ${escapeHtml(row.value)}
                        ${row.url ? `<a class="summaryLink" href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">Apri link</a>` : ""}
                    </span>
                </div>
            `;
        }

        if (typeof row === "object" && row.type === "text") {
            return `
                <div class="summaryRow textSummaryRow">
                    <span class="summaryLabel">${escapeHtml(row.label)}</span>
                    <span class="summaryValue">${linkifyText(row.value)}</span>
                </div>
            `;
        }

        return `<div class="summaryRow">${linkifyText(row)}</div>`;

    }

    function songLine(label, song) {

        if (!song || (!song.title && !song.artist && !song.youtubeUrl)) {
            return "";
        }

        return {
            type: "song",
            label,
            value: [song.title, song.artist].filter(Boolean).join(" - ") || "Brano indicato",
            url: safeUrl(song.youtubeUrl)
        };

    }

    function textLine(label, value) {

        return {
            type: "text",
            label,
            value
        };

    }

    function linkifyText(value) {

        const text =
            String(value || "");
        const urlPattern =
            /(https?:\/\/[^\s<]+)/g;
        let lastIndex =
            0;
        let html =
            "";
        let match;

        while ((match = urlPattern.exec(text)) !== null) {
            html +=
                escapeHtml(text.slice(lastIndex, match.index));
            html +=
                `<a class="summaryLink" href="${escapeHtml(match[0])}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[0])}</a>`;
            lastIndex =
                match.index + match[0].length;
        }

        html +=
            escapeHtml(text.slice(lastIndex));

        return html;

    }

    function safeUrl(value) {

        const url =
            String(value || "").trim();

        if (!url) {
            return "";
        }

        try {
            const parsed =
                new URL(url);

            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                return "";
            }

            return parsed.href;
        } catch {
            return "";
        }

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

    window.weddingPlannerAddCivilMomentSong =
        addCivilMomentExtraSong;
    window.weddingPlannerRemoveCivilMoment =
        removeCivilMomentAt;
    window.weddingPlannerRemoveCivilMomentSong =
        removeCivilMomentExtraSong;
    window.weddingPlannerRemoveSpecialMoment =
        removeSpecialMomentAt;

}());
