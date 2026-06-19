(function () {

    const socket =
        io();

    let state = null;
    const ADMIN_SESSION_KEY =
        "fantasposiAdminPassword";

    const $ = id =>
        document.getElementById(id);

    const els = {
        adminLogin: $("adminLogin"),
        adminLoginForm: $("adminLoginForm"),
        adminPassword: $("adminPassword"),
        adminLoginHint: $("adminLoginHint"),
        adminShell: $("adminShell"),
        adminLogout: $("adminLogout"),
        adminBrideLabel: $("adminBrideLabel"),
        adminGroomLabel: $("adminGroomLabel"),
        adminBrideScore: $("adminBrideScore"),
        adminGroomScore: $("adminGroomScore"),
        topTableName: $("topTableName"),
        topTableScore: $("topTableScore"),
        eventTitle: $("eventTitle"),
        eventSubtitle: $("eventSubtitle"),
        brideName: $("brideName"),
        groomName: $("groomName"),
        brideTeamName: $("brideTeamName"),
        groomTeamName: $("groomTeamName"),
        titleFont: $("titleFont"),
        bodyFont: $("bodyFont"),
        brideColor: $("brideColor"),
        groomColor: $("groomColor"),
        accentColor: $("accentColor"),
        welcome: $("welcome"),
        saveEvent: $("saveEvent"),
        resetGame: $("resetGame"),
        guestQr: $("guestQr"),
        guestUrl: $("guestUrl"),
        awardTitle: $("awardTitle"),
        awardNote: $("awardNote"),
        awardType: $("awardType"),
        awardTarget: $("awardTarget"),
        awardTable: $("awardTable"),
        tableAwardFields: $("tableAwardFields"),
        singleTeamFields: $("singleTeamFields"),
        bothTeamsFields: $("bothTeamsFields"),
        awardSummary: $("awardSummary"),
        tablePoints: $("tablePoints"),
        teamPoints: $("teamPoints"),
        teamPointsBride: $("teamPointsBride"),
        teamPointsGroom: $("teamPointsGroom"),
        applyTableShares: $("applyTableShares"),
        confirmAwardButton: $("confirmAwardButton"),
        challengeTitleInput: $("challengeTitleInput"),
        challengeDescriptionInput: $("challengeDescriptionInput"),
        challengeRewardInput: $("challengeRewardInput"),
        challengeTablePoints: $("challengeTablePoints"),
        challengeTeamPoints: $("challengeTeamPoints"),
        launchChallenge: $("launchChallenge"),
        activeChallenges: $("activeChallenges"),
        openQuizDialog: $("openQuizDialog"),
        quizDialog: $("quizDialog"),
        quizQuestion: $("quizQuestion"),
        quizAnswer0: $("quizAnswer0"),
        quizAnswer1: $("quizAnswer1"),
        quizAnswer2: $("quizAnswer2"),
        quizAnswer3: $("quizAnswer3"),
        quizCorrectIndex: $("quizCorrectIndex"),
        launchQuiz: $("launchQuiz"),
        activeQuizBox: $("activeQuizBox"),
        quizLibraryBox: $("quizLibraryBox"),
        newTableName: $("newTableName"),
        addTable: $("addTable"),
        tablePodium: $("tablePodium"),
        tablesList: $("tablesList"),
        awardsList: $("awardsList")
    };

    els.adminLoginForm.addEventListener("submit", unlockAdmin);
    els.adminLogout.addEventListener("click", lockAdmin);
    els.saveEvent.addEventListener("click", saveEvent);
    els.resetGame.addEventListener("click", resetGame);
    els.addTable.addEventListener("click", addTable);
    els.confirmAwardButton.addEventListener("click", createAward);
    els.awardTitle.addEventListener("input", renderAwardSummaries);
    els.awardTarget.addEventListener("change", renderAwardSummaries);
    els.awardTable.addEventListener("change", renderAwardSummaries);
    els.applyTableShares.addEventListener("change", renderAwardSummaries);
    els.tablePoints.addEventListener("input", renderAwardSummaries);
    els.teamPoints.addEventListener("input", renderAwardSummaries);
    els.teamPointsBride.addEventListener("input", renderAwardSummaries);
    els.teamPointsGroom.addEventListener("input", renderAwardSummaries);
    els.launchChallenge.addEventListener("click", launchChallenge);
    els.openQuizDialog.addEventListener("click", openQuizDialog);
    els.launchQuiz.addEventListener("click", launchQuiz);

    if (adminPassword()) {
        setAdminUnlocked(true);
    } else {
        setAdminUnlocked(false);
    }

    socket.on("fantasposi:state", nextState => {
        state = nextState;
        render();
    });

    fetch("/api/fantasposi/state")
        .then(response => response.json())
        .then(nextState => {
            state = nextState;
            render();
        });

    fetch("/api/fantasposi/info")
        .then(response => response.json())
        .then(info => {
            els.guestQr.src = info.qr;
            els.guestUrl.href = info.guestUrl;
            els.guestUrl.textContent = info.guestUrl;
        });

    function adminPassword() {

        return sessionStorage.getItem(ADMIN_SESSION_KEY) || "";

    }

    function setAdminUnlocked(unlocked) {

        els.adminLogin.classList.toggle("hidden", unlocked);
        els.adminShell.classList.toggle("locked", !unlocked);

        if (!unlocked) {
            els.adminPassword.focus();
        }

    }

    function unlockAdmin(event) {

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
                if (!data || !data.ok) {
                    els.adminLoginHint.textContent =
                        "Password non corretta.";
                    return;
                }

                sessionStorage.setItem(ADMIN_SESSION_KEY, password);
                els.adminPassword.value = "";
                els.adminLoginHint.textContent = "";
                setAdminUnlocked(true);
            })
            .catch(() => {
                els.adminLoginHint.textContent =
                    "Non riesco a verificare la password.";
            });

    }

    function lockAdmin() {

        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAdminUnlocked(false);

    }

    function render() {

        if (!state) {
            return;
        }

        applyTheme(state.event);
        renderEvent();
        renderScores();
        renderTableOptions();
        renderAwardSummaries();
        renderTables();
        renderChallenges();
        renderQuiz();
        renderAwards();

    }

    function renderEvent() {

        els.eventTitle.value = state.event.title || "";
        els.eventSubtitle.value = state.event.subtitle || "";
        els.brideName.value = state.event.brideName || "";
        els.groomName.value = state.event.groomName || "";
        els.brideTeamName.value = state.event.brideTeamName || "";
        els.groomTeamName.value = state.event.groomTeamName || "";
        els.titleFont.value = state.event.titleFont || "Playfair Display";
        els.bodyFont.value = state.event.bodyFont || "Inter";
        els.brideColor.value = state.event.brideColor || "#b76e79";
        els.groomColor.value = state.event.groomColor || "#1f6f8b";
        els.accentColor.value = state.event.accentColor || "#c9a227";
        els.welcome.value = state.event.welcome || "";

    }

    function renderScores() {

        els.adminBrideLabel.textContent =
            state.event.brideTeamName || "Team Sposa";
        els.adminGroomLabel.textContent =
            state.event.groomTeamName || "Team Sposo";
        els.adminBrideScore.textContent =
            state.scores.bride || 0;
        els.adminGroomScore.textContent =
            state.scores.groom || 0;

        const topTable =
            [...state.tables].sort((a, b) =>
                (b.score || 0) - (a.score || 0)
            )[0];

        els.topTableName.textContent =
            topTable ? topTable.name : "Nessun tavolo";
        els.topTableScore.textContent =
            topTable ? topTable.score || 0 : 0;

    }

    function renderTableOptions() {

        const current =
            els.awardTable.value;

        els.awardTable.innerHTML =
            "<option value=\"\">Scegli un tavolo</option>" +
            state.tables
                .map(table =>
                    `<option value="${table.id}">${escapeHtml(table.name)}</option>`
                )
                .join("");

        els.awardTable.value = current;

    }

    function renderAwardSummaries() {

        renderAwardFields();
        renderAwardSummary();
        renderAwardButtonState();

    }

    function renderAwardFields() {

        const target =
            els.awardTarget.value;

        els.tableAwardFields.classList.toggle(
            "hidden",
            target !== "table"
        );
        els.singleTeamFields.classList.toggle(
            "hidden",
            target !== "bride" && target !== "groom"
        );
        els.bothTeamsFields.classList.toggle(
            "hidden",
            target !== "both"
        );

    }

    function renderAwardSummary() {

        const target =
            els.awardTarget.value;
        const title =
            els.awardTitle.value.trim();

        if (!title || !target) {
            els.awardSummary.textContent =
                "Scrivi cosa e successo e scegli a chi assegnare i punti.";
            return;
        }

        if (target === "table") {
            renderTableAwardSummary(title);
            return;
        }

        if (target === "both") {
            renderBothTeamsAwardSummary(title);
            return;
        }

        renderSingleTeamAwardSummary(title, target);

    }

    function renderTableAwardSummary(title) {

        const tableId =
            Number(els.awardTable.value);
        const tablePoints =
            Number(els.tablePoints.value || 0);

        if (!tableId || !tablePoints) {
            els.awardSummary.textContent =
                "Scegli il tavolo e inserisci i punti da dare al tavolo.";
            return;
        }

        const table =
            state.tables.find(item =>
                item.id === tableId
            );

        const composition =
            table && table.composition || {
                bride: 0,
                groom: 0,
                total: 0
            };

        if (!table) {
            els.awardSummary.textContent =
                "Tavolo non trovato. Scegli un tavolo dalla lista.";
            return;
        }

        const brideShare =
            els.applyTableShares.checked ? composition.bride : 0;
        const groomShare =
            els.applyTableShares.checked ? composition.groom : 0;

        const shareText =
            composition.total && els.applyTableShares.checked ?
                `${state.event.brideTeamName} +${brideShare}, ` +
                `${state.event.groomTeamName} +${groomShare}` :
                "nessuna quota team automatica";

        els.awardSummary.textContent =
            `Conferma: "${title}" assegna Tavolo ${table.name} +${tablePoints}. ` +
            `Quote team: ${shareText}.`;

    }

    function renderSingleTeamAwardSummary(title, target) {

        const teamPoints =
            Number(els.teamPoints.value || 0);

        if (!teamPoints) {
            els.awardSummary.textContent =
                "Inserisci i punti da dare al team scelto.";
            return;
        }

        const teamName =
            target === "bride" ?
                state.event.brideTeamName :
                state.event.groomTeamName;

        els.awardSummary.textContent =
            `Conferma: "${title}" assegna ${teamName} +${teamPoints}. Nessun tavolo riceve punti.`;

    }

    function renderBothTeamsAwardSummary(title) {

        const bridePoints =
            Number(els.teamPointsBride.value || 0);
        const groomPoints =
            Number(els.teamPointsGroom.value || 0);

        if (!bridePoints && !groomPoints) {
            els.awardSummary.textContent =
                "Inserisci almeno un punteggio per Team Sposa o Team Sposo.";
            return;
        }

        els.awardSummary.textContent =
            `Conferma: "${title}" assegna ${state.event.brideTeamName} +${bridePoints}, ` +
            `${state.event.groomTeamName} +${groomPoints}. Nessun tavolo riceve punti.`;

    }

    function renderAwardButtonState() {

        const hasTitle =
            !!els.awardTitle.value.trim();
        const target =
            els.awardTarget.value;
        const hasTable =
            !!Number(els.awardTable.value);
        const hasTablePoints =
            !!Number(els.tablePoints.value);
        const hasTeamPoints =
            !!Number(els.teamPoints.value);
        const hasBridePoints =
            !!Number(els.teamPointsBride.value);
        const hasGroomPoints =
            !!Number(els.teamPointsGroom.value);

        els.confirmAwardButton.disabled =
            !hasTitle ||
            !target ||
            (
                target === "table" &&
                (!hasTable || !hasTablePoints)
            ) ||
            (
                (target === "bride" || target === "groom") &&
                !hasTeamPoints
            ) ||
            (
                target === "both" &&
                !hasBridePoints &&
                !hasGroomPoints
            );

    }

    function renderTables() {

        if (!state.tables.length) {
            els.tablesList.innerHTML =
                "<div class=\"metaLine\">Nessun tavolo inserito.</div>";
            return;
        }

        const sorted =
            [...state.tables].sort((a, b) => b.score - a.score);

        els.tablePodium.innerHTML =
            sorted
                .slice(0, 3)
                .map((table, index) => `
                    <div>
                        <span>${index + 1}</span>
                        <strong>${escapeHtml(table.name)}</strong>
                        <em>${table.score || 0} pt</em>
                    </div>
                `)
                .join("");

        els.tablesList.innerHTML =
            sorted.map(table => {
                const composition =
                    table.composition || { bride: 0, groom: 0, total: 0 };
                const participants =
                    state.participants.filter(participant =>
                        participant.tableId === table.id
                    );
                return `
                    <div class="listItem">
                        <strong>${escapeHtml(table.name)} · ${table.score || 0} pt</strong>
                        <div class="metaLine">
                            ${escapeHtml(state.event.brideTeamName)}: ${composition.bride}
                            · ${escapeHtml(state.event.groomTeamName)}: ${composition.groom}
                            · iscritti: ${composition.total}
                        </div>
                        <div class="participantList">
                            ${
                                participants.length ?
                                    participants.map(participant => {
                                        const nextTeam =
                                            participant.team === "bride" ?
                                                "groom" :
                                                "bride";
                                        const teamName =
                                            participant.team === "bride" ?
                                                state.event.brideTeamName :
                                                state.event.groomTeamName;
                                        const nextTeamName =
                                            nextTeam === "bride" ?
                                                state.event.brideTeamName :
                                                state.event.groomTeamName;
                                        return `
                                            <div>
                                                <span>
                                                    ${escapeHtml(participant.name || "Invitato")}
                                                    · ${escapeHtml(teamName)}
                                                </span>
                                                <button
                                                    class="listButton"
                                                    data-switch-participant="${participant.id}"
                                                    data-next-team="${nextTeam}">
                                                    Sposta a ${escapeHtml(nextTeamName)}
                                                </button>
                                            </div>
                                        `;
                                    }).join("") :
                                    "<div class=\"metaLine\">Nessun iscritto.</div>"
                            }
                        </div>
                        <div class="itemActions">
                            <button class="listButton dangerButton" data-delete-table="${table.id}">
                                Elimina tavolo
                            </button>
                        </div>
                    </div>
                `;
            }).join("");

        els.tablesList.querySelectorAll("[data-delete-table]").forEach(button => {
            button.addEventListener("click", () => {
                deleteTable(button.dataset.deleteTable);
            });
        });

        els.tablesList.querySelectorAll("[data-switch-participant]").forEach(button => {
            button.addEventListener("click", () => {
                switchParticipantTeam(
                    button.dataset.switchParticipant,
                    button.dataset.nextTeam
                );
            });
        });

    }

    function switchParticipantTeam(participantId, team) {

        adminRequest(
            `/api/fantasposi/participants/${participantId}`,
            {
                method: "PATCH",
                headers: jsonHeaders(),
                body: JSON.stringify({
                    team
                })
            }
        )
            .then(response => response.json())
            .then(data => {
                if (data && data.error) {
                    window.alert(data.error);
                    return;
                }
                if (data && data.event) {
                    state = data;
                    render();
                }
            });

    }

    function renderChallenges() {

        const active =
            state.challenges.filter(challenge =>
                challenge.status === "active"
            );

        if (!active.length) {
            els.activeChallenges.innerHTML =
                "<div class=\"metaLine\">Nessuna sfida attiva.</div>";
            return;
        }

        els.activeChallenges.innerHTML =
            active.map(challenge => `
                <div class="listItem">
                    <strong>${escapeHtml(challenge.title)}</strong>
                    <div class="metaLine">${escapeHtml(challenge.description)}</div>
                    <div class="challengeAwardBox">
                        <label>Tavolo che ha completato
                            <select data-challenge-table="${challenge.id}">
                                <option value="">Scegli un tavolo</option>
                                ${state.tables.map(table => `
                                    <option value="${table.id}">
                                        ${escapeHtml(table.name)}
                                    </option>
                                `).join("")}
                            </select>
                        </label>
                        <label>Punti al tavolo
                            <input
                                type="number"
                                data-challenge-points="${challenge.id}"
                                value="${challenge.tablePoints || ""}"
                                placeholder="Es. 20">
                        </label>
                        <div
                            class="awardSummary"
                            data-challenge-summary="${challenge.id}">
                            Scegli tavolo e punti per vedere il riepilogo.
                        </div>
                    </div>
                    <div class="itemActions">
                        <button class="listButton tableMiniAction" data-award-challenge="${challenge.id}">
                            Assegna e chiudi
                        </button>
                        <button class="listButton" data-close-challenge="${challenge.id}">
                            Chiudi senza punti
                        </button>
                    </div>
                </div>
            `).join("");

        els.activeChallenges.querySelectorAll("[data-challenge-table]")
            .forEach(select => {
                select.addEventListener("change", () => {
                    renderChallengeAwardSummary(select.dataset.challengeTable);
                });
            });

        els.activeChallenges.querySelectorAll("[data-challenge-points]")
            .forEach(input => {
                input.addEventListener("input", () => {
                    renderChallengeAwardSummary(input.dataset.challengePoints);
                });
            });

        els.activeChallenges.querySelectorAll("[data-award-challenge]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    awardChallengeToTable(button.dataset.awardChallenge);
                });
            });

        els.activeChallenges.querySelectorAll("[data-close-challenge]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    post(`/api/fantasposi/challenges/${button.dataset.closeChallenge}/close`, {});
                });
            });

    }

    function renderChallengeAwardSummary(challengeId) {

        const challenge =
            state.challenges.find(item =>
                item.id === Number(challengeId)
            );

        const tableSelect =
            els.activeChallenges.querySelector(
                `[data-challenge-table="${challengeId}"]`
            );

        const pointsInput =
            els.activeChallenges.querySelector(
                `[data-challenge-points="${challengeId}"]`
            );

        const summary =
            els.activeChallenges.querySelector(
                `[data-challenge-summary="${challengeId}"]`
            );

        if (!challenge || !tableSelect || !pointsInput || !summary) {
            return;
        }

        const table =
            state.tables.find(item =>
                item.id === Number(tableSelect.value)
            );

        const points =
            Number(pointsInput.value || 0);

        if (!table || !points) {
            summary.textContent =
                "Scegli tavolo e punti per vedere il riepilogo.";
            return;
        }

        const composition =
            table.composition || {
                bride: 0,
                groom: 0,
                total: 0
            };

        const shares =
            composition.total ?
                `${state.event.brideTeamName} +${composition.bride}, ` +
                `${state.event.groomTeamName} +${composition.groom}` :
                "nessuna quota team, tavolo senza iscritti";

        summary.textContent =
            `Conferma: "${challenge.title}" assegna Tavolo ${table.name} +${points}. ` +
            `Quote team automatiche: ${shares}.`;

    }

    function awardChallengeToTable(challengeId) {

        const challenge =
            state.challenges.find(item =>
                item.id === Number(challengeId)
            );

        const tableSelect =
            els.activeChallenges.querySelector(
                `[data-challenge-table="${challengeId}"]`
            );

        const pointsInput =
            els.activeChallenges.querySelector(
                `[data-challenge-points="${challengeId}"]`
            );

        const tableId =
            Number(tableSelect && tableSelect.value);

        const tablePoints =
            Number(pointsInput && pointsInput.value);

        if (!challenge || !tableId || !tablePoints) {
            window.alert("Scegli il tavolo e inserisci i punti da assegnare.");
            return;
        }

        post(
            "/api/fantasposi/awards",
            {
                title: challenge.title,
                note: challenge.description,
                type: "improvvisa",
                tableId,
                tablePoints,
                applyTableShares: true
            }
        ).then(data => {

            if (data && data.error) {
                return;
            }

            post(
                `/api/fantasposi/challenges/${challengeId}/close`,
                {}
            );

        });

    }

    function renderQuiz() {

        const activeQuiz =
            state.quizzes.find(quiz =>
                quiz.status === "active"
            );

        if (!activeQuiz) {
            els.activeQuizBox.innerHTML =
                "<div class=\"metaLine\">Nessun quiz attivo.</div>";
        } else {
            const answers =
                state.quizAnswers.filter(answer =>
                    answer.quizId === activeQuiz.id
                );

            els.activeQuizBox.innerHTML = `
                <div class="listItem">
                    <strong>${escapeHtml(activeQuiz.question)}</strong>
                    <div class="metaLine">
                        Quiz in corso · risposte ricevute: ${answers.length}
                    </div>
                    <div class="awardSummary">
                        Alla chiusura: ogni risposta esatta vale +3 al tavolo e +3 al team dell'invitato.
                    </div>
                    <div class="quizAnswerPreview">
                        ${activeQuiz.answers.map((answer, index) => `
                            <div>
                                <span>${index + 1}</span>
                                <strong>${escapeHtml(answer)}</strong>
                                ${index === activeQuiz.correctIndex ? "<em>Corretta</em>" : ""}
                            </div>
                        `).join("")}
                    </div>
                    <div class="itemActions">
                        <button class="listButton tableMiniAction" data-close-quiz="${activeQuiz.id}">
                            Chiudi quiz e mostra risposta
                        </button>
                    </div>
                </div>
            `;

            els.activeQuizBox.querySelector("[data-close-quiz]")
                .addEventListener("click", event => {
                    post(
                        `/api/fantasposi/quizzes/${event.target.dataset.closeQuiz}/close`,
                        {}
                    );
                });
        }

        renderQuizLibrary();

    }

    function renderQuizLibrary() {

        const drafts =
            state.quizzes.filter(quiz =>
                quiz.status === "draft"
            );

        if (!drafts.length) {
            els.quizLibraryBox.innerHTML =
                "<div class=\"metaLine\">Nessuna domanda salvata.</div>";
            return;
        }

        els.quizLibraryBox.innerHTML =
            drafts.map(quiz => `
                <div class="listItem">
                    <strong>${escapeHtml(quiz.question)}</strong>
                    <div class="metaLine">
                        Risposta corretta: ${escapeHtml(quiz.answers[quiz.correctIndex])}
                    </div>
                    <div class="itemActions">
                        <button class="listButton tableMiniAction" data-launch-quiz="${quiz.id}">
                            Lancia
                        </button>
                        <button class="listButton dangerButton" data-delete-quiz="${quiz.id}">
                            Elimina
                        </button>
                    </div>
                </div>
            `).join("");

        els.quizLibraryBox.querySelectorAll("[data-launch-quiz]").forEach(button => {
            button.addEventListener("click", () => {
                post(
                    `/api/fantasposi/quizzes/${button.dataset.launchQuiz}/launch`,
                    {}
                );
            });
        });

        els.quizLibraryBox.querySelectorAll("[data-delete-quiz]").forEach(button => {
            button.addEventListener("click", () => {
                adminRequest(
                    `/api/fantasposi/quizzes/${button.dataset.deleteQuiz}`,
                    {
                        method: "DELETE"
                    }
                )
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.event) {
                            state = data;
                            render();
                        }
                    });
            });
        });

    }

    function openQuizDialog() {

        els.quizDialog.showModal();

    }

    function launchQuiz(event) {

        event.preventDefault();

        const answers = [
            els.quizAnswer0.value,
            els.quizAnswer1.value,
            els.quizAnswer2.value,
            els.quizAnswer3.value
        ];

        post(
            "/api/fantasposi/quizzes/draft",
            {
                question: els.quizQuestion.value,
                answers,
                correctIndex: Number(els.quizCorrectIndex.value)
            }
        ).then(data => {

            if (data && data.error) {
                window.alert(data.error);
                return;
            }

            els.quizQuestion.value = "";
            els.quizAnswer0.value = "";
            els.quizAnswer1.value = "";
            els.quizAnswer2.value = "";
            els.quizAnswer3.value = "";
            els.quizCorrectIndex.value = "";
            els.quizDialog.close();

        });

    }

    function renderAwards() {

        const awards =
            state.awards.slice(0, 30);

        if (!awards.length) {
            els.awardsList.innerHTML =
                "<div class=\"metaLine\">Nessun punto assegnato.</div>";
            return;
        }

        els.awardsList.innerHTML =
            awards.map(award => `
                <div class="listItem">
                    <strong>${escapeHtml(award.title)}${award.voided ? " · annullata" : ""}</strong>
                    <div class="metaLine">
                        ${escapeHtml(award.tableName || "Team")}
                        · tavolo +${award.tablePoints}
                        · ${escapeHtml(state.event.brideTeamName)} +${award.teamPointsBride}
                        · ${escapeHtml(state.event.groomTeamName)} +${award.teamPointsGroom}
                    </div>
                    ${award.voided ? "" : `
                        <div class="itemActions">
                            <button class="listButton" data-void="${award.id}">
                                Annulla
                            </button>
                        </div>
                    `}
                </div>
            `).join("");

        els.awardsList.querySelectorAll("[data-void]").forEach(button => {
            button.addEventListener("click", () => {
                post(`/api/fantasposi/awards/${button.dataset.void}/void`, {});
            });
        });

    }

    function saveEvent() {

        post(
            "/api/fantasposi/event",
            {
                title: els.eventTitle.value,
                subtitle: els.eventSubtitle.value,
                brideName: els.brideName.value,
                groomName: els.groomName.value,
                brideTeamName: els.brideTeamName.value,
                groomTeamName: els.groomTeamName.value,
                titleFont: els.titleFont.value,
                bodyFont: els.bodyFont.value,
                brideColor: els.brideColor.value,
                groomColor: els.groomColor.value,
                accentColor: els.accentColor.value,
                welcome: els.welcome.value
            }
        );

    }

    function resetGame() {

        const confirmed =
            window.confirm(
                "Vuoi davvero ricominciare da zero? Verranno cancellati tavoli, iscritti, sfide, storico e punteggi."
            );

        if (!confirmed) {
            return;
        }

        post(
            "/api/fantasposi/reset-game",
            {}
        );

    }

    function addTable() {

        const name =
            els.newTableName.value.trim();

        if (!name) {
            return;
        }

        post(
            "/api/fantasposi/tables",
            { name }
        ).then(() => {
            els.newTableName.value = "";
        });

    }

    function createAward() {

        const title =
            els.awardTitle.value.trim() || "Fantasfida";
        const target =
            els.awardTarget.value;
        const teamPoints =
            Number(els.teamPoints.value || 0);

        if (
            target === "table" &&
            !Number(els.awardTable.value)
        ) {
            window.alert("Scegli prima il tavolo da premiare.");
            return;
        }

        if (
            target === "table" &&
            !Number(els.tablePoints.value)
        ) {
            window.alert("Inserisci i punti da dare al tavolo.");
            return;
        }

        if (
            (target === "bride" || target === "groom") &&
            !Number(els.teamPoints.value)
        ) {
            window.alert("Inserisci i punti da dare al team.");
            return;
        }

        if (
            target === "both" &&
            !Number(els.teamPointsBride.value) &&
            !Number(els.teamPointsGroom.value)
        ) {
            window.alert("Inserisci almeno un punteggio per un team.");
            return;
        }

        const payload = {
            title,
            note: els.awardNote.value,
            type: els.awardType.value,
            tablePoints: 0,
            teamPoints: 0,
            teamPointsBride: 0,
            teamPointsGroom: 0,
            applyTableShares: target === "table" && els.applyTableShares.checked
        };

        if (target === "table") {
            payload.tableId = Number(els.awardTable.value);
            payload.tablePoints = Number(els.tablePoints.value || 0);
        }

        if (target === "bride") {
            payload.team = "bride";
            payload.teamPoints = teamPoints;
        }

        if (target === "groom") {
            payload.team = "groom";
            payload.teamPoints = teamPoints;
        }

        if (target === "both") {
            payload.teamPointsBride =
                Number(els.teamPointsBride.value || 0);
            payload.teamPointsGroom =
                Number(els.teamPointsGroom.value || 0);
        }

        post(
            "/api/fantasposi/awards",
            payload
        ).then(data => {

            if (data && data.error) {
                return;
            }

            els.awardTitle.value = "";
            els.awardTarget.value = "";
            els.tablePoints.value = "";
            els.teamPoints.value = "";
            els.teamPointsBride.value = "";
            els.teamPointsGroom.value = "";
            renderAwardSummaries();

        });

    }

    function deleteTable(tableId) {

        adminRequest(
            `/api/fantasposi/tables/${tableId}`,
            {
                method: "DELETE"
            }
        )
            .then(response => response.json())
            .then(data => {
                if (data && data.error) {
                    window.alert(data.error);
                    return;
                }
                if (data && data.event) {
                    state = data;
                    render();
                }
            });

    }

    function launchChallenge() {

        post(
            "/api/fantasposi/challenges",
            {
                title: els.challengeTitleInput.value,
                description: els.challengeDescriptionInput.value,
                reward: els.challengeRewardInput.value,
                tablePoints: Number(els.challengeTablePoints.value || 0),
                teamPoints: Number(els.challengeTeamPoints.value || 0)
            }
        );

    }

    function post(url, payload) {

        return adminRequest(
            url,
            {
                method: "POST",
                headers: jsonHeaders(),
                body: JSON.stringify(payload)
            }
        )
            .then(response => response.json())
            .then(data => {
                if (data && data.event) {
                    state = data;
                    render();
                }
                if (data && data.state) {
                    state = data.state;
                    render();
                }
                return data;
            });

    }

    function adminRequest(url, options = {}) {

        const headers = {
            ...(options.headers || {}),
            "X-Fantasposi-Admin-Password": adminPassword()
        };

        return fetch(
            url,
            {
                ...options,
                headers
            }
        ).then(response => {
            if (response.status === 401) {
                lockAdmin();
                window.alert("Password admin richiesta o non valida.");
            }
            return response;
        });

    }

    function jsonHeaders() {

        return {
            "Content-Type": "application/json"
        };

    }

    function applyTheme(event) {

        document.documentElement.style.setProperty(
            "--bride",
            event.brideColor || "#b76e79"
        );
        document.documentElement.style.setProperty(
            "--groom",
            event.groomColor || "#1f6f8b"
        );
        document.documentElement.style.setProperty(
            "--accent",
            event.accentColor || "#c9a227"
        );
        document.documentElement.style.setProperty(
            "--title-font",
            `"${event.titleFont || "Playfair Display"}", Georgia, serif`
        );
        document.documentElement.style.setProperty(
            "--body-font",
            `"${event.bodyFont || "Inter"}", Arial, sans-serif`
        );

    }

    function escapeHtml(value) {

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    }

}());
