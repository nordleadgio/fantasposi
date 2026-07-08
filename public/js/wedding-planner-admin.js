(function () {

    const SESSION_KEY =
        "fantasposiAdminPassword";
    const $ = id =>
        document.getElementById(id);

    let events = [];
    let selectedToken = "";

    const religiousProgramMoments = [
        {
            key: "groomEntrance",
            title: "Entrata sposo",
            options: [
                "Canone in D di Pachelbel",
                "Marcia di Elgar (Pomp and Circumstance N.1 Theme)",
                "Rivers flow in you (Yiruma)",
                "Altro"
            ]
        },
        {
            key: "brideEntrance",
            title: "Entrata sposa",
            options: [
                "Canone in D di Pachelbel",
                "Marcia nuziale di F. Mendelssohn",
                "Marcia nuziale di Wagner",
                "Figlia di Sion",
                "Altro"
            ]
        },
        {
            key: "gloriaAspersion",
            title: "Gloria e aspersione",
            options: [
                "Gloria Giombini",
                "Gloria in excelsis deo"
            ]
        },
        {
            key: "gospel",
            title: "Canto al Vangelo",
            options: [
                "Alleluia, la nostra festa (Alleluia delle lampadine)",
                "Alleluia, canto per Cristo",
                "Alleluia, passeranno i cieli"
            ]
        },
        {
            key: "offertory",
            title: "Offertorio",
            options: [
                "Ecco quel che abbiamo",
                "Vivere la vita",
                "Servo per amore"
            ]
        },
        {
            key: "holy",
            title: "Santo",
            options: [
                "Santo Zaire, Osanna eh",
                "Santo di Bonfitto",
                "Santo Gen Rosso, Santo Santo Santo"
            ]
        },
        {
            key: "ourFather",
            title: "Padre Nostro",
            options: [
                "Padre nostro sulle note di The sound of silence",
                "Padre nostro Giombini",
                "Padre nostro classico"
            ]
        },
        {
            key: "peace",
            title: "Segno della pace",
            options: [
                "Pace nel signore, Pace a te pace a te",
                "Pace sia pace a voi"
            ]
        },
        {
            key: "lambOfGod",
            title: "Agnello di Dio",
            options: [
                "Agnello di Dio"
            ]
        },
        {
            key: "communion",
            title: "Canto di comunione",
            options: [
                "Dolce e sentire, fratello sole",
                "Te al centro del mio cuore",
                "Pane del cielo",
                "Su ali d'aquila",
                "Tu sei"
            ]
        },
        {
            key: "signatures",
            title: "Canto sulle firme",
            options: [
                "Ave Maria di Schubert",
                "Altro"
            ]
        },
        {
            key: "preCivilClosing",
            title: "Canto di fine celebrazione pre rito civile se richiesto dal sacerdote",
            options: [
                "Resta qui con noi",
                "Laudato sii",
                "Figlia di Sion"
            ]
        },
        {
            key: "exit",
            title: "Uscita sposi",
            options: [
                "Accompagnamento strumentale"
            ]
        }
    ];

    const els = {
        loginGate: $("loginGate"),
        loginForm: $("loginForm"),
        adminPassword: $("adminPassword"),
        loginMessage: $("loginMessage"),
        adminApp: $("adminApp"),
        logoutButton: $("logoutButton"),
        newTitle: $("newTitle"),
        newGroom: $("newGroom"),
        newBride: $("newBride"),
        newDate: $("newDate"),
        newVenue: $("newVenue"),
        newIntro: $("newIntro"),
        createEvent: $("createEvent"),
        refreshEvents: $("refreshEvents"),
        eventCounter: $("eventCounter"),
        eventList: $("eventList"),
        detailPanel: $("detailPanel"),
        detailStatus: $("detailStatus"),
        detailTitle: $("detailTitle"),
        detailMeta: $("detailMeta"),
        detailQr: $("detailQr"),
        detailUrl: $("detailUrl"),
        copyLink: $("copyLink"),
        openPlanner: $("openPlanner"),
        printEvent: $("printEvent"),
        deleteEvent: $("deleteEvent"),
        editTitle: $("editTitle"),
        editStatus: $("editStatus"),
        editWeddingWorkflowStatus: $("editWeddingWorkflowStatus"),
        editGroom: $("editGroom"),
        editBride: $("editBride"),
        editDate: $("editDate"),
        editVenue: $("editVenue"),
        editIntro: $("editIntro"),
        editAdminInternalNotes: $("editAdminInternalNotes"),
        religiousProgramPanel: $("religiousProgramPanel"),
        religiousProgramFields: $("religiousProgramFields"),
        confirmReligiousProgram: $("confirmReligiousProgram"),
        religiousProgramMessage: $("religiousProgramMessage"),
        saveEvent: $("saveEvent"),
        adminSaveMessage: $("adminSaveMessage"),
        answersSummary: $("answersSummary")
    };

    els.loginForm.addEventListener("submit", login);
    els.logoutButton.addEventListener("click", logout);
    els.createEvent.addEventListener("click", createEvent);
    els.refreshEvents.addEventListener("click", loadEvents);
    els.copyLink.addEventListener("click", copyLink);
    els.openPlanner.addEventListener("click", openPlanner);
    els.printEvent.addEventListener("click", printSelected);
    els.deleteEvent.addEventListener("click", deleteSelected);
    els.confirmReligiousProgram.addEventListener("click", confirmReligiousProgram);
    els.saveEvent.addEventListener("click", saveSelected);

    setUnlocked(Boolean(adminPassword()));

    if (adminPassword()) {
        loadEvents();
    }

    function adminPassword() {

        return sessionStorage.getItem(SESSION_KEY) || "";

    }

    function headers() {

        return {
            "Content-Type": "application/json",
            "x-fantasposi-admin-password": adminPassword()
        };

    }

    function setUnlocked(unlocked) {

        els.loginGate.classList.toggle("hidden", unlocked);
        els.adminApp.classList.toggle("locked", !unlocked);

        if (!unlocked) {
            els.adminPassword.focus();
        }

    }

    function login(event) {

        event.preventDefault();

        const password =
            els.adminPassword.value;

        fetch(
            "/api/fantasposi/admin-login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    password
                })
            }
        )
            .then(response => response.json())
            .then(data => {
                if (!data.ok) {
                    els.loginMessage.textContent =
                        "Password non corretta.";
                    return;
                }

                sessionStorage.setItem(SESSION_KEY, password);
                els.adminPassword.value = "";
                els.loginMessage.textContent = "";
                setUnlocked(true);
                loadEvents();
            })
            .catch(() => {
                els.loginMessage.textContent =
                    "Non riesco a verificare la password.";
            });

    }

    function logout() {

        sessionStorage.removeItem(SESSION_KEY);
        setUnlocked(false);

    }

    function loadEvents() {

        fetch(
            "/api/wedding-planner/events",
            {
                headers: headers()
            }
        )
            .then(response => response.json())
            .then(data => {
                events =
                    sortEvents(Array.isArray(data) ? data : []);
                renderEvents();

                if (selectedToken) {
                    selectEvent(selectedToken);
                }
            });

    }

    function createEvent() {

        const title =
            els.newTitle.value.trim() ||
            `Il matrimonio di ${els.newGroom.value.trim()} e ${els.newBride.value.trim()}`.trim();

        fetch(
            "/api/wedding-planner/events",
            {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    title,
                    groomName: els.newGroom.value,
                    brideName: els.newBride.value,
                    weddingDate: els.newDate.value,
                    venue: els.newVenue.value,
                    introMessage: els.newIntro.value
                })
            }
        )
            .then(response => response.json())
            .then(event => {
                selectedToken =
                    event.token;
                els.newTitle.value = "";
                els.newGroom.value = "";
                els.newBride.value = "";
                els.newDate.value = "";
                els.newVenue.value = "";
                els.newIntro.value = "";
                loadEvents();
            });

    }

    function sortEvents(list) {

        return [...list].sort((left, right) => {
            const leftWorkflow =
                workflowRank(left.weddingWorkflowStatus);
            const rightWorkflow =
                workflowRank(right.weddingWorkflowStatus);

            if (leftWorkflow !== rightWorkflow) {
                return leftWorkflow - rightWorkflow;
            }

            const leftDate =
                sortableDate(left.weddingDate);
            const rightDate =
                sortableDate(right.weddingDate);

            if (leftDate !== rightDate) {
                return leftDate - rightDate;
            }

            return String(left.title || "").localeCompare(
                String(right.title || ""),
                "it",
                {
                    sensitivity: "base"
                }
            );
        });

    }

    function workflowRank(value) {

        return value === "done" ? 1 : 0;

    }

    function workflowLabel(value) {

        return value === "done" ? "Gi\u00e0 fatto" : "Da fare";

    }

    function sortableDate(value) {

        if (!value) {
            return Number.MAX_SAFE_INTEGER;
        }

        const time =
            new Date(`${value}T00:00:00`).getTime();

        return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;

    }

    function renderEvents() {

        els.eventCounter.textContent =
            events.length === 1 ?
                "1 scheda creata." :
                `${events.length} schede create.`;

        if (!events.length) {
            els.eventList.innerHTML =
                "<div class=\"emptyState\">Crea la prima scheda per generare il link sposi.</div>";
            els.detailPanel.classList.add("hidden");
            selectedToken = "";
            return;
        }

        els.eventList.innerHTML =
            events.map(event => `
                <article class="eventRow ${event.weddingWorkflowStatus === "done" ? "isDone" : ""} ${event.token === selectedToken ? "selected" : ""}">
                    <button class="eventOpenButton" type="button" data-open-token="${event.token}">
                        <span>${escapeHtml(event.title)}</span>
                        <strong>${escapeHtml(event.status || "bozza")}</strong>
                        <em>${escapeHtml(workflowLabel(event.weddingWorkflowStatus))}</em>
                        <small>${escapeHtml([event.weddingDate, event.venue].filter(Boolean).join(" - ") || "Senza data")}</small>
                    </button>
                    <button class="workflowToggleButton" type="button" data-toggle-workflow-token="${event.token}">
                        ${event.weddingWorkflowStatus === "done" ? "Rimetti da fare" : "Segna gi\u00e0 fatto"}
                    </button>
                </article>
            `).join("");

        els.eventList.querySelectorAll("[data-open-token]").forEach(button => {
            button.addEventListener("click", () => selectEvent(button.dataset.openToken));
        });

        els.eventList.querySelectorAll("[data-toggle-workflow-token]").forEach(button => {
            button.addEventListener("click", () => toggleWeddingWorkflow(button.dataset.toggleWorkflowToken));
        });

        if (!selectedToken) {
            selectEvent(events[0].token);
        }

    }

    function toggleWeddingWorkflow(token) {

        const event =
            events.find(item => item.token === token);

        if (!event) {
            return;
        }

        const nextStatus =
            event.weddingWorkflowStatus === "done" ? "todo" : "done";

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(token)}`,
            {
                method: "PUT",
                headers: headers(),
                body: JSON.stringify({
                    weddingWorkflowStatus: nextStatus
                })
            }
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error("Cambio stato non riuscito");
                }
                return response.json();
            })
            .then(updated => {
                events =
                    sortEvents(events.map(item =>
                        item.token === updated.token ? updated : item
                    ));
                selectedToken =
                    updated.token;
                renderEvents();
                selectEvent(updated.token);
            })
            .catch(() => {
                window.alert("Non sono riuscito a cambiare lo stato del matrimonio. Riprova.");
            });

    }

    function selectEvent(token) {

        const event =
            events.find(item => item.token === token);

        if (!event) {
            selectedToken = "";
            els.detailPanel.classList.add("hidden");
            return;
        }

        selectedToken =
            token;
        els.detailPanel.classList.remove("hidden");
        els.detailStatus.textContent =
            event.status || "bozza";
        els.detailTitle.textContent =
            event.title || "Scheda";
        els.detailMeta.textContent =
            [event.weddingDate, event.venue].filter(Boolean).join(" - ");
        els.detailUrl.value =
            event.publicUrl || "";
        els.editTitle.value =
            event.title || "";
        els.editStatus.value =
            event.status || "bozza";
        els.editWeddingWorkflowStatus.value =
            event.weddingWorkflowStatus === "done" ? "done" : "todo";
        els.editGroom.value =
            event.groomName || "";
        els.editBride.value =
            event.brideName || "";
        els.editDate.value =
            event.weddingDate || "";
        els.editVenue.value =
            event.venue || "";
        els.editIntro.value =
            event.introMessage || "";
        els.editAdminInternalNotes.value =
            event.adminInternalNotes || event.adminCeremonyNotes || "";
        els.answersSummary.innerHTML =
            buildSummary(event);
        clearAdminSaveMessage();
        clearReligiousProgramMessage();
        renderReligiousProgram(event);
        renderEvents();
        loadQr(event.token);

    }

    function createReligiousProgram(source) {

        const program =
            source && source.moments ? source : {};
        const momentsByKey =
            new Map(
                (program.moments || []).map(moment => [moment.key, moment])
            );

        return {
            confirmed: Boolean(program.confirmed),
            confirmedAt: program.confirmedAt || "",
            moments: religiousProgramMoments.map(moment => {
                const saved =
                    momentsByKey.get(moment.key) || {};

                return {
                    key: moment.key,
                    title: moment.title,
                    selected: moment.options.includes(saved.selected) ? saved.selected : "",
                    otherText: saved.otherText || ""
                };
            })
        };

    }

    function renderReligiousProgram(event) {

        const isReligious =
            event.answers &&
            event.answers.ceremony &&
            event.answers.ceremony.type === "religious";

        els.religiousProgramPanel.classList.toggle("hidden", !isReligious);

        if (!isReligious) {
            els.religiousProgramFields.innerHTML = "";
            return;
        }

        const program =
            createReligiousProgram(event.religiousProgram);

        els.religiousProgramFields.innerHTML =
            religiousProgramMoments.map(moment => {
                const saved =
                    program.moments.find(item => item.key === moment.key) || {};
                const selected =
                    saved.selected || "";

                return `
                    <article class="religiousProgramMoment" data-religious-moment="${escapeAttr(moment.key)}">
                        <h3>${escapeHtml(moment.title)}</h3>
                        <div class="religiousOptions">
                            ${moment.options.map(option => `
                                <label class="radioLine">
                                    <input type="radio" name="religious-${escapeAttr(moment.key)}" value="${escapeAttr(option)}" ${selected === option ? "checked" : ""}>
                                    <span>${escapeHtml(option)}</span>
                                </label>
                            `).join("")}
                        </div>
                        <label class="religiousOther ${selected === "Altro" ? "" : "hidden"}">Brano alternativo
                            <input type="text" value="${escapeAttr(saved.otherText || "")}" data-religious-other="${escapeAttr(moment.key)}" placeholder="Scrivi titolo e autore">
                        </label>
                    </article>
                `;
            }).join("");

        els.religiousProgramFields.querySelectorAll("input[type='radio']").forEach(input => {
            input.addEventListener("change", () => {
                const container =
                    input.closest("[data-religious-moment]");
                const other =
                    container && container.querySelector(".religiousOther");

                if (other) {
                    other.classList.toggle("hidden", input.value !== "Altro");
                }
            });
        });

    }

    function collectReligiousProgram() {

        return {
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            moments: religiousProgramMoments.map(moment => {
                const checked =
                    els.religiousProgramFields.querySelector(
                        `[data-religious-moment="${cssEscape(moment.key)}"] input[type="radio"]:checked`
                    );
                const other =
                    els.religiousProgramFields.querySelector(
                        `[data-religious-other="${cssEscape(moment.key)}"]`
                    );

                return {
                    key: moment.key,
                    title: moment.title,
                    selected: checked ? checked.value : "",
                    otherText: other ? other.value : ""
                };
            })
        };

    }

    function confirmReligiousProgram() {

        const event =
            events.find(item => item.token === selectedToken);

        if (!event) {
            return;
        }

        const religiousProgram =
            collectReligiousProgram();

        showReligiousProgramMessage("Conferma rito in corso...", "loading");
        els.confirmReligiousProgram.disabled =
            true;

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(selectedToken)}`,
            {
                method: "PUT",
                headers: headers(),
                body: JSON.stringify({
                    religiousProgram
                })
            }
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error("Conferma rito non riuscita");
                }
                return response.json();
            })
            .then(updated => {
                events =
                    events.map(item =>
                        item.token === updated.token ? updated : item
                    );
                selectEvent(updated.token);
                showReligiousProgramMessage("Rito religioso confermato.", "success");
            })
            .catch(() => {
                showReligiousProgramMessage(
                    "Non sono riuscito a confermare il rito. Riprova.",
                    "error"
                );
            })
            .finally(() => {
                els.confirmReligiousProgram.disabled =
                    false;
            });

    }

    function loadQr(token) {

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(token)}/qr`,
            {
                headers: headers()
            }
        )
            .then(response => response.json())
            .then(data => {
                els.detailQr.src =
                    data.qr || "";
            });

    }

    function copyLink() {

        els.detailUrl.select();
        navigator.clipboard.writeText(els.detailUrl.value)
            .catch(() => document.execCommand("copy"));

    }

    function openPlanner() {

        const event =
            events.find(item => item.token === selectedToken);

        if (!event || !event.publicUrl) {
            return;
        }

        window.open(
            `${event.publicUrl}?admin=1`,
            "_blank"
        );

    }

    function saveSelected() {

        const event =
            events.find(item => item.token === selectedToken);

        if (!event) {
            return;
        }

        showAdminSaveMessage("Salvataggio modifiche admin in corso...", "loading");
        els.saveEvent.disabled =
            true;

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(selectedToken)}`,
            {
                method: "PUT",
                headers: headers(),
                body: JSON.stringify({
                    title: els.editTitle.value,
                    status: els.editStatus.value,
                    weddingWorkflowStatus: els.editWeddingWorkflowStatus.value,
                    groomName: els.editGroom.value,
                    brideName: els.editBride.value,
                    weddingDate: els.editDate.value,
                    venue: els.editVenue.value,
                    introMessage: els.editIntro.value,
                    adminInternalNotes: els.editAdminInternalNotes.value
                })
            }
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error("Salvataggio non riuscito");
                }
                return response.json();
            })
            .then(updated => {
                events =
                    sortEvents(events.map(item =>
                        item.token === updated.token ? updated : item
                    ));
                selectEvent(updated.token);
                showAdminSaveMessage("Modifiche admin salvate.", "success");
            })
            .catch(() => {
                showAdminSaveMessage(
                    "Non sono riuscito a salvare le modifiche. Riprova.",
                    "error"
                );
            })
            .finally(() => {
                els.saveEvent.disabled =
                    false;
            });

    }

    function printSelected() {

        const event =
            events.find(item => item.token === selectedToken);

        if (!event) {
            return;
        }

        const pdfWindow =
            window.open("", "_blank");

        if (pdfWindow) {
            pdfWindow.document.write("Preparazione PDF...");
        }

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(selectedToken)}/pdf`,
            {
                headers: {
                    "x-fantasposi-admin-password": adminPassword()
                }
            }
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error("PDF non disponibile");
                }

                return response.blob();
            })
            .then(blob => {
                const url =
                    URL.createObjectURL(blob);

                if (pdfWindow) {
                    pdfWindow.location.href =
                        url;
                } else {
                    const link =
                        document.createElement("a");

                    link.href = url;
                    link.download =
                        `${slugify(event.title || "scheda-sposi")}.pdf`;
                    link.click();
                }

                setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
            .catch(() => {
                if (pdfWindow) {
                    pdfWindow.close();
                }

                window.alert("Non riesco ad aprire il PDF in questo momento.");
            });

    }

    function deleteSelected() {

        const event =
            events.find(item => item.token === selectedToken);

        if (!event) {
            return;
        }

        const ok =
            window.confirm(
                `Eliminare definitivamente la scheda "${event.title}"?`
            );

        if (!ok) {
            return;
        }

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(selectedToken)}`,
            {
                method: "DELETE",
                headers: headers()
            }
        )
            .then(response => response.json())
            .then(data => {
                if (!data || !data.ok) {
                    return;
                }

                events =
                    sortEvents(events.filter(item =>
                        item.token !== selectedToken
                    ));
                selectedToken =
                    events[0] ? events[0].token : "";
                renderEvents();

                if (selectedToken) {
                    selectEvent(selectedToken);
                }
            });

    }

    function showAdminSaveMessage(message, type) {

        els.adminSaveMessage.textContent =
            message;
        els.adminSaveMessage.dataset.type =
            type;
        els.adminSaveMessage.classList.add("isVisible");

    }

    function clearAdminSaveMessage() {

        els.adminSaveMessage.textContent =
            "";
        els.adminSaveMessage.removeAttribute("data-type");
        els.adminSaveMessage.classList.remove("isVisible");

    }

    function showReligiousProgramMessage(message, type) {

        els.religiousProgramMessage.textContent =
            message;
        els.religiousProgramMessage.dataset.type =
            type;
        els.religiousProgramMessage.classList.add("isVisible");

    }

    function clearReligiousProgramMessage() {

        els.religiousProgramMessage.textContent =
            "";
        els.religiousProgramMessage.removeAttribute("data-type");
        els.religiousProgramMessage.classList.remove("isVisible");

    }

    function buildSummary(eventOrAnswers) {

        const data =
            eventOrAnswers.answers ? eventOrAnswers.answers : eventOrAnswers;
        const adminInternalNotes =
            eventOrAnswers.adminInternalNotes || eventOrAnswers.adminCeremonyNotes || "";
        const religiousProgram =
            eventOrAnswers.religiousProgram && eventOrAnswers.religiousProgram.confirmed ?
                eventOrAnswers.religiousProgram :
                null;
        const religiousRows =
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

        const couple =
            data.couple || {};
        const ceremony =
            data.ceremony || {};
        const reception =
            data.reception || {};
        const special =
            data.specialMoments || {};

        return [
            section("Sposi", [
                couple.groomFullName && `Sposo: ${couple.groomFullName}`,
                couple.brideFullName && `Sposa: ${couple.brideFullName}`,
                couple.groomAge && `Eta sposo: ${couple.groomAge}`,
                couple.brideAge && `Eta sposa: ${couple.brideAge}`,
                couple.hasChildren && `Figli: ${couple.childrenNames || "si"}`
            ]),
            section("Rito", [
                ceremony.type === "civil" ? "Rito civile" : "",
                ceremony.type === "religious" ? "Rito religioso" : "",
                ceremony.type === "noRite" ? "Rito non richiesto" : "",
                ceremony.startTime && `Orario inizio rito: ${ceremony.startTime}`,
                ceremony.type === "religious" && ceremony.churchName && `Chiesa: ${ceremony.churchName}`,
                ceremony.type === "religious" && ceremony.churchTown && `Paese chiesa: ${ceremony.churchTown}`,
                ...religiousRows,
                song("Ingresso sposo", ceremony.groomEntranceSong),
                ...((ceremony.groomEntranceExtraSongs || []).map((item, index) =>
                    song(`Ingresso sposo - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Ingresso sposa", ceremony.brideEntranceSong),
                ...((ceremony.brideEntranceExtraSongs || []).map((item, index) =>
                    song(`Ingresso sposa - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Ingresso insieme", ceremony.jointEntranceSong),
                ...((ceremony.jointEntranceExtraSongs || []).map((item, index) =>
                    song(`Ingresso insieme - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Conclusione rito", ceremony.ceremonyClosingSong),
                ...((ceremony.ceremonyClosingExtraSongs || []).map((item, index) =>
                    song(`Conclusione rito - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Uscita sposi", ceremony.ceremonyExitSong),
                ...((ceremony.ceremonyExitExtraSongs || []).map((item, index) =>
                    song(`Uscita sposi - brano aggiuntivo ${index + 1}`, item)
                )),
                ...((ceremony.civilCustomMoments || []).flatMap((moment, index) => [
                    moment.title && `Momento personalizzato ${index + 1}: ${moment.title}`,
                    song(moment.title || `Momento personalizzato ${index + 1}`, moment.song),
                    ...((moment.extraSongs || []).map((item, songIndex) =>
                        song(`${moment.title || `Momento personalizzato ${index + 1}`} - brano aggiuntivo ${songIndex + 1}`, item)
                    ))
                ])),
                ceremony.civilNotes && textLine("Altre richieste rito civile", ceremony.civilNotes),
                ceremony.religiousNotes && textLine("Note rito", ceremony.religiousNotes)
            ]),
            section("Best Moments", [
                song("Arrivo location", reception.arrivalSong),
                ...((reception.arrivalExtraSongs || []).map((item, index) =>
                    song(`Arrivo location - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Ingresso", reception.entranceSong),
                ...((reception.entranceExtraSongs || []).map((item, index) =>
                    song(`Ingresso - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Ballo sposi", reception.firstDanceSong),
                ...((reception.firstDanceExtraSongs || []).map((item, index) =>
                    song(`Ballo sposi - brano aggiuntivo ${index + 1}`, item)
                )),
                song("Taglio torta", reception.cakeMainSong),
                ...((reception.cakeExtraSongs || []).map((item, index) =>
                    song(`Taglio torta - brano aggiuntivo ${index + 1}`, item)
                ))
            ]),
            section("Momenti speciali", [
                special.parentDance && song("Ballo genitori", special.parentDanceSong),
                special.siblingDance && song("Ballo fratelli/sorelle", special.siblingDanceSong),
                special.childrenDance && song("Ballo figli", special.childrenDanceSong),
                ...((special.customMoments || []).flatMap((moment, index) => [
                    moment.title && `Momento personalizzato ${index + 1}: ${moment.title}`,
                    song(moment.title || `Momento personalizzato ${index + 1}`, moment.song)
                ])),
                special.dedications && textLine("Dediche", special.dedications),
                special.otherRequests && textLine("Altre richieste", special.otherRequests)
            ]),
            section("Note interne admin", [
                adminInternalNotes && textLine("Note private", adminInternalNotes)
            ])
        ].join("") || "<div class=\"emptyState\">Gli sposi non hanno ancora compilato la scheda.</div>";

    }

    function section(title, rows) {

        const cleanRows =
            rows.filter(Boolean);

        if (!cleanRows.length) {
            return "";
        }

        return `
            <article class="summarySection">
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

        if (typeof row === "object" && row.html) {
            return `<div class="summaryRow">${row.html}</div>`;
        }

        return `<div class="summaryRow">${linkifyText(row)}</div>`;

    }

    function song(label, value) {

        if (!value || (!value.title && !value.artist && !value.youtubeUrl)) {
            return "";
        }

        const details =
            [value.title, value.artist].filter(Boolean).join(" - ");
        const url =
            safeUrl(value.youtubeUrl);
        return {
            type: "song",
            label,
            value: details || "Brano indicato",
            url
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

    function cssEscape(value) {

        return String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"");

    }

    function slugify(value) {

        return String(value || "scheda-sposi")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "scheda-sposi";

    }

}());
