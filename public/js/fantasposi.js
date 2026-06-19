(function () {

    const socket =
        io();

    let state = null;
    let selectedTeam = "";
    let participant =
        loadParticipant();
    let activeChallenge = null;

    const els = {
        guestSubtitle: document.getElementById("guestSubtitle"),
        guestTitle: document.getElementById("guestTitle"),
        guestWelcome: document.getElementById("guestWelcome"),
        brideTeamButton: document.getElementById("brideTeamButton"),
        groomTeamButton: document.getElementById("groomTeamButton"),
        tableSelect: document.getElementById("tableSelect"),
        guestName: document.getElementById("guestName"),
        joinButton: document.getElementById("joinButton"),
        joinMessage: document.getElementById("joinMessage"),
        joinPanel: document.getElementById("joinPanel"),
        homePanel: document.getElementById("homePanel"),
        identityTeam: document.getElementById("identityTeam"),
        identityTable: document.getElementById("identityTable"),
        guestBrideTeamLabel: document.getElementById("guestBrideTeamLabel"),
        guestGroomTeamLabel: document.getElementById("guestGroomTeamLabel"),
        guestBrideScore: document.getElementById("guestBrideScore"),
        guestGroomScore: document.getElementById("guestGroomScore"),
        guestTableScores: document.getElementById("guestTableScores"),
        challengeBox: document.getElementById("challengeBox"),
        activeChallenge: document.getElementById("activeChallenge"),
        challengeTitle: document.getElementById("challengeTitle"),
        challengeDescription: document.getElementById("challengeDescription"),
        challengeReward: document.getElementById("challengeReward"),
        quizPanel: document.getElementById("quizPanel"),
        quizKicker: document.getElementById("quizKicker"),
        quizQuestionText: document.getElementById("quizQuestionText"),
        quizAnswers: document.getElementById("quizAnswers"),
        quizMessage: document.getElementById("quizMessage"),
        latestAward: document.getElementById("latestAward")
    };

    document.querySelectorAll(".teamChoice").forEach(button => {
        button.addEventListener("click", () => {
            selectedTeam = button.dataset.team;
            document.querySelectorAll(".teamChoice").forEach(item => {
                item.classList.toggle(
                    "selected",
                    item === button
                );
            });
        });
    });

    els.joinButton.addEventListener("click", join);

    socket.on("fantasposi:state", nextState => {
        state = nextState;
        render();
    });

    socket.on("fantasposi:challenge", challenge => {
        activeChallenge = challenge;
        renderChallenge();
    });

    socket.on("fantasposi:quiz", () => {
        renderQuiz();
    });

    fetch("/api/fantasposi/state")
        .then(response => response.json())
        .then(nextState => {
            state = nextState;
            render();
        });

    function render() {

        if (!state) {
            return;
        }

        applyTheme(state.event);
        validateParticipant();

        els.guestSubtitle.textContent =
            state.event.subtitle || "Fantasposi";
        els.guestTitle.textContent =
            state.event.title || "Fantasposi";
        els.guestWelcome.textContent =
            state.event.welcome || "";
        els.brideTeamButton.textContent =
            state.event.brideTeamName || "Team Sposa";
        els.groomTeamButton.textContent =
            state.event.groomTeamName || "Team Sposo";

        renderTables();
        renderIdentity();
        renderScores();
        renderLatestAward();
        renderChallenge();
        renderQuiz();

    }

    function renderTables() {

        const current =
            els.tableSelect.value;

        els.tableSelect.innerHTML =
            "<option value=\"\">Scegli dalla lista</option>" +
            state.tables
                .map(table =>
                    `<option value="${table.id}">${escapeHtml(table.name)}</option>`
                )
                .join("");

        els.tableSelect.value = current;

    }

    function validateParticipant() {

        if (!participant) {
            return;
        }

        const stillExists =
            state.participants.some(item =>
                item.id === participant.id
            );

        if (stillExists) {
            return;
        }

        participant = null;
        localStorage.removeItem("fantasposiParticipant");
        selectedTeam = "";
        document.querySelectorAll(".teamChoice").forEach(item => {
            item.classList.remove("selected");
        });

    }

    function renderIdentity() {

        if (!participant) {
            els.joinPanel.classList.remove("hidden");
            els.homePanel.classList.add("hidden");
            return;
        }

        els.joinPanel.classList.add("hidden");
        els.homePanel.classList.remove("hidden");

        const table =
            state.tables.find(item =>
                item.id === participant.tableId
            );

        els.identityTeam.textContent =
            participant.team === "bride" ?
                state.event.brideTeamName :
                state.event.groomTeamName;
        els.identityTable.textContent =
            table ? table.name : "Tavolo";

    }

    function renderScores() {

        els.guestBrideTeamLabel.textContent =
            state.event.brideTeamName || "Team Sposa";
        els.guestGroomTeamLabel.textContent =
            state.event.groomTeamName || "Team Sposo";
        els.guestBrideScore.textContent =
            state.scores && state.scores.bride || 0;
        els.guestGroomScore.textContent =
            state.scores && state.scores.groom || 0;

        const rankedTables =
            [...state.tables]
                .sort((a, b) =>
                    (b.score || 0) - (a.score || 0)
                )
                .slice(0, 5);

        if (!rankedTables.length) {
            els.guestTableScores.textContent =
                "Nessun tavolo in classifica.";
            return;
        }

        els.guestTableScores.innerHTML =
            rankedTables
                .map((table, index) => `
                    <div class="guestTableRow">
                        <span>${index + 1}</span>
                        <strong>${escapeHtml(table.name)}</strong>
                        <em>${table.score || 0}</em>
                    </div>
                `)
                .join("");

    }

    function renderLatestAward() {

        const award =
            state.awards.find(item => !item.voided);

        if (!award) {
            els.latestAward.textContent =
                "Ancora nessun punto assegnato.";
            return;
        }

        els.latestAward.textContent =
            `${award.title}: ${award.tableName || "Team"} premiato.`;

    }

    function renderChallenge() {

        if (!state) {
            return;
        }

        activeChallenge =
            state.challenges.find(challenge =>
                challenge.status === "active"
            ) || activeChallenge;

        if (!activeChallenge || activeChallenge.status !== "active") {
            els.challengeBox.classList.remove("hidden");
            els.activeChallenge.classList.add("hidden");
            return;
        }

        els.challengeBox.classList.add("hidden");
        els.activeChallenge.classList.remove("hidden");
        els.challengeTitle.textContent =
            activeChallenge.title;
        els.challengeDescription.textContent =
            activeChallenge.description;
        els.challengeReward.textContent =
            activeChallenge.reward;
    }

    function renderQuiz() {

        if (!state || !participant) {
            return;
        }

        const activeQuiz =
            state.quizzes.find(quiz =>
                quiz.status === "active"
            );

        const latestClosedQuiz =
            state.quizzes.find(quiz =>
                quiz.status === "closed"
            );

        const quiz =
            activeQuiz || latestClosedQuiz;

        if (!quiz) {
            els.quizPanel.classList.add("hidden");
            return;
        }

        const myAnswer =
            state.quizAnswers.find(answer =>
                answer.quizId === quiz.id &&
                answer.participantId === participant.id
            );

        els.quizPanel.classList.remove("hidden");
        els.quizQuestionText.textContent =
            quiz.question;

        if (quiz.status === "active") {
            els.quizKicker.textContent =
                "Quiz live";
            els.quizMessage.textContent =
                myAnswer ?
                    "Risposta inviata. Puoi cambiarla finche il quiz e aperto." :
                    "Scegli una risposta.";
            els.quizMessage.className =
                "hint";
        } else {
            els.quizKicker.textContent =
                "Risposta quiz";
            els.quizMessage.textContent =
                myAnswer ?
                    (
                        myAnswer.isCorrect ?
                            "😊 Hai indovinato!" :
                            "😔 Non hai indovinato."
                    ) :
                    "Non hai risposto.";
            els.quizMessage.className =
                "hint quizResult " +
                (
                    myAnswer && myAnswer.isCorrect ?
                        "correct" :
                        "wrong"
                );
        }

        els.quizAnswers.innerHTML =
            quiz.answers.map((answer, index) => {

                const selected =
                    myAnswer && myAnswer.answerIndex === index;
                const correct =
                    quiz.status === "closed" &&
                    quiz.correctIndex === index;

                return `
                    <button
                        class="quizAnswerButton ${selected ? "selected" : ""} ${correct ? "correct" : ""}"
                        data-quiz-answer="${index}"
                        ${quiz.status === "closed" ? "disabled" : ""}>
                        <span>${index + 1}</span>
                        <strong>${escapeHtml(answer)}</strong>
                    </button>
                `;

            }).join("");

        els.quizAnswers.querySelectorAll("[data-quiz-answer]").forEach(button => {
            button.addEventListener("click", () => {
                answerQuiz(quiz.id, Number(button.dataset.quizAnswer));
            });
        });

    }

    function answerQuiz(quizId, answerIndex) {

        if (!participant) {
            return;
        }

        fetch(
            `/api/fantasposi/quizzes/${quizId}/answer`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    participantId: participant.id,
                    answerIndex
                })
            }
        )
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    els.quizMessage.textContent = data.error;
                }
            });

    }

    function join() {

        const tableId =
            Number(els.tableSelect.value);
        const name =
            els.guestName.value.trim();

        if (!selectedTeam) {
            els.joinMessage.textContent =
                "Scegli prima il team.";
            return;
        }

        if (!tableId) {
            els.joinMessage.textContent =
                "Scegli il tavolo dalla lista.";
            return;
        }

        if (!name) {
            els.joinMessage.textContent =
                "Scrivi il tuo nome.";
            return;
        }

        fetch(
            "/api/fantasposi/register",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    team: selectedTeam,
                    tableId
                })
            }
        )
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    els.joinMessage.textContent = data.error;
                    return;
                }
                participant = data.participant;
                localStorage.setItem(
                    "fantasposiParticipant",
                    JSON.stringify(participant)
                );
                state = data.state || state;
                render();
            });

    }

    function loadParticipant() {

        try {
            return JSON.parse(
                localStorage.getItem("fantasposiParticipant") || "null"
            );
        } catch (err) {
            return null;
        }

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
