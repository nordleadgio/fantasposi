(function () {

    const SESSION_KEY =
        "fantasposiAdminPassword";
    const $ = id =>
        document.getElementById(id);

    let events = [];
    let selectedToken = "";

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
        editGroom: $("editGroom"),
        editBride: $("editBride"),
        editDate: $("editDate"),
        editVenue: $("editVenue"),
        editIntro: $("editIntro"),
        editAdminCeremonyNotes: $("editAdminCeremonyNotes"),
        saveEvent: $("saveEvent"),
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
                    Array.isArray(data) ? data : [];
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
                <button class="eventRow ${event.token === selectedToken ? "selected" : ""}" type="button" data-token="${event.token}">
                    <span>${escapeHtml(event.title)}</span>
                    <strong>${escapeHtml(event.status || "bozza")}</strong>
                    <small>${escapeHtml([event.weddingDate, event.venue].filter(Boolean).join(" - ") || "Senza data")}</small>
                </button>
            `).join("");

        els.eventList.querySelectorAll("[data-token]").forEach(button => {
            button.addEventListener("click", () => selectEvent(button.dataset.token));
        });

        if (!selectedToken) {
            selectEvent(events[0].token);
        }

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
        els.editAdminCeremonyNotes.value =
            event.adminCeremonyNotes || "";
        els.answersSummary.innerHTML =
            buildSummary(event.answers || {});
        renderEvents();
        loadQr(event.token);

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

        fetch(
            `/api/wedding-planner/events/${encodeURIComponent(selectedToken)}`,
            {
                method: "PUT",
                headers: headers(),
                body: JSON.stringify({
                    title: els.editTitle.value,
                    status: els.editStatus.value,
                    groomName: els.editGroom.value,
                    brideName: els.editBride.value,
                    weddingDate: els.editDate.value,
                    venue: els.editVenue.value,
                    introMessage: els.editIntro.value,
                    adminCeremonyNotes: els.editAdminCeremonyNotes.value
                })
            }
        )
            .then(response => response.json())
            .then(updated => {
                events =
                    events.map(item =>
                        item.token === updated.token ? updated : item
                    );
                selectEvent(updated.token);
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
                    events.filter(item =>
                        item.token !== selectedToken
                    );
                selectedToken =
                    events[0] ? events[0].token : "";
                renderEvents();

                if (selectedToken) {
                    selectEvent(selectedToken);
                }
            });

    }

    function buildSummary(data) {

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
                ceremony.startTime && `Orario inizio rito: ${ceremony.startTime}`,
                ceremony.type === "religious" && ceremony.churchName && `Chiesa: ${ceremony.churchName}`,
                ceremony.type === "religious" && ceremony.churchTown && `Paese chiesa: ${ceremony.churchTown}`,
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
                ceremony.civilNotes && `Altre richieste rito civile: ${ceremony.civilNotes}`,
                ceremony.religiousNotes && `Note rito: ${ceremony.religiousNotes}`
            ]),
            section("Best Moment", [
                song("Arrivo location", reception.arrivalSong),
                song("Ingresso", reception.entranceSong),
                song("Ballo sposi", reception.firstDanceSong),
                song("Taglio torta", reception.cakeMainSong),
                ...((reception.cakeExtraSongs || []).map((item, index) =>
                    song(`Brano extra ${index + 1}`, item)
                ))
            ]),
            section("Momenti speciali", [
                special.parentDance && song("Ballo genitori", special.parentDanceSong),
                special.siblingDance && song("Ballo fratelli/sorelle", special.siblingDanceSong),
                special.childrenDance && song("Ballo figli", special.childrenDanceSong),
                special.dedications && `Dediche: ${special.dedications}`,
                special.otherRequests && `Altre richieste: ${special.otherRequests}`
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

        if (typeof row === "object" && row.html) {
            return `<p>${row.html}</p>`;
        }

        return `<p>${escapeHtml(row)}</p>`;

    }

    function song(label, value) {

        if (!value || (!value.title && !value.artist && !value.youtubeUrl)) {
            return "";
        }

        const details =
            [value.title, value.artist].filter(Boolean).join(" - ");
        const url =
            safeUrl(value.youtubeUrl);
        const text =
            `${label}: ${details || "brano indicato"}`;

        if (!url) {
            return text;
        }

        return {
            html: `${escapeHtml(text)} <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Apri link YouTube</a>`
        };

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

    function slugify(value) {

        return String(value || "scheda-sposi")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "scheda-sposi";

    }

}());
