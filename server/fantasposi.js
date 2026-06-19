const fs = require("fs");
const path = require("path");
const os = require("os");
const QRCode = require("qrcode");
const {
    APP_FOLDER
} = require("../shared/paths");

const DATA_FOLDER =
    path.join(APP_FOLDER, "Fantasposi");

const DATA_FILE =
    path.join(DATA_FOLDER, "evento.json");

const DEFAULT_EVENT = {
    title: "Daniele & Sara",
    subtitle: "Fantasposi",
    date: "",
    venue: "",
    welcome: "Scegli il tuo team e il tuo tavolo.",
    brideName: "Sara",
    groomName: "Daniele",
    brideTeamName: "Team Sara",
    groomTeamName: "Team Daniele",
    theme: "elegante",
    titleFont: "Playfair Display",
    bodyFont: "Inter",
    brideColor: "#b76e79",
    groomColor: "#1f6f8b",
    accentColor: "#c9a227"
};

function createInitialState() {

    return {
        event: {
            ...DEFAULT_EVENT
        },
        tables: [],
        participants: [],
        awards: [],
        challenges: [],
        claims: [],
        quizzes: [],
        quizAnswers: [],
        scores: {
            bride: 0,
            groom: 0
        },
        nextIds: {
            table: 1,
            participant: 1,
            award: 1,
            challenge: 1,
            claim: 1,
            quiz: 1,
            quizAnswer: 1
        }
    };

}

function ensureDataFolder() {

    fs.mkdirSync(
        DATA_FOLDER,
        { recursive: true }
    );

}

function loadState() {

    ensureDataFolder();

    if (!fs.existsSync(DATA_FILE)) {
        return createInitialState();
    }

    try {

        const parsed =
            JSON.parse(
                fs.readFileSync(DATA_FILE, "utf8")
            );

        return normalizeState(parsed);

    } catch (err) {

        return createInitialState();

    }

}

function saveState(state) {

    ensureDataFolder();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(state, null, 2)
    );

}

function normalizeState(state) {

    const next =
        createInitialState();

    if (state && typeof state === "object") {

        next.event = {
            ...next.event,
            ...safeObject(state.event)
        };
        next.tables = Array.isArray(state.tables) ? state.tables : [];
        next.participants =
            Array.isArray(state.participants) ? state.participants : [];
        next.awards = Array.isArray(state.awards) ? state.awards : [];
        next.challenges =
            Array.isArray(state.challenges) ? state.challenges : [];
        next.claims = Array.isArray(state.claims) ? state.claims : [];
        next.quizzes = Array.isArray(state.quizzes) ? state.quizzes : [];
        next.quizAnswers =
            Array.isArray(state.quizAnswers) ? state.quizAnswers : [];
        next.scores = {
            ...next.scores,
            ...safeObject(state.scores)
        };
        next.nextIds = {
            ...next.nextIds,
            ...safeObject(state.nextIds)
        };

    }

    return next;

}

function safeObject(value) {

    return value && typeof value === "object" ? value : {};

}

function cleanText(value, fallback = "") {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim().slice(0, 160);

}

function cleanLongText(value, fallback = "") {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim().slice(0, 800);

}

function cleanColor(value, fallback) {

    if (
        typeof value === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(value)
    ) {
        return value.toLowerCase();
    }

    return fallback;

}

function cleanPoints(value) {

    const points =
        Number(value);

    if (!Number.isFinite(points)) {
        return 0;
    }

    return Math.max(
        -999,
        Math.min(
            999,
            Math.round(points)
        )
    );

}

function teamKey(value) {

    if (value === "bride" || value === "groom") {
        return value;
    }

    return "";

}

function findTable(state, tableId) {

    const id =
        Number(tableId);

    return state.tables.find(table =>
        table.id === id
    ) || null;

}

function tableComposition(state, tableId) {

    const id =
        Number(tableId);

    return state.participants.reduce(
        (composition, participant) => {

            if (participant.tableId !== id) {
                return composition;
            }

            if (participant.team === "bride") {
                composition.bride += 1;
            }

            if (participant.team === "groom") {
                composition.groom += 1;
            }

            composition.total += 1;
            return composition;

        },
        {
            bride: 0,
            groom: 0,
            total: 0
        }
    );

}

function publicState(state) {

    return {
        event: state.event,
        tables: state.tables.map(table => ({
            ...table,
            composition: tableComposition(state, table.id)
        })),
        participants: state.participants,
        awards: state.awards,
        challenges: state.challenges,
        claims: state.claims,
        quizzes: state.quizzes,
        quizAnswers: state.quizAnswers,
        scores: state.scores
    };

}

function recalculateScores(state) {

    const scores = {
        bride: 0,
        groom: 0
    };

    state.tables.forEach(table => {
        table.score = 0;
    });

    state.awards
        .filter(award => !award.voided)
        .forEach(award => {

            scores.bride += cleanPoints(award.teamPointsBride);
            scores.groom += cleanPoints(award.teamPointsGroom);

            if (award.tableId) {

                const table =
                    findTable(state, award.tableId);

                if (table) {
                    table.score += cleanPoints(award.tablePoints);
                }

            }

        });

    state.scores = scores;

}

function awardQuizPoints(state, quiz) {

    if (!quiz || quiz.awardedAt) {
        return;
    }

    const correctAnswers =
        state.quizAnswers.filter(answer =>
            answer.quizId === quiz.id &&
            answer.isCorrect
        );

    if (!correctAnswers.length) {
        quiz.awardedAt = new Date().toISOString();
        return;
    }

    const grouped =
        new Map();

    correctAnswers.forEach(answer => {

        const tableId =
            Number(answer.tableId);

        if (!grouped.has(tableId)) {
            grouped.set(
                tableId,
                {
                    tableId,
                    tableName: answer.tableName || "",
                    correctCount: 0,
                    brideCount: 0,
                    groomCount: 0
                }
            );
        }

        const group =
            grouped.get(tableId);

        group.correctCount += 1;

        if (answer.team === "bride") {
            group.brideCount += 1;
        }

        if (answer.team === "groom") {
            group.groomCount += 1;
        }

    });

    grouped.forEach(group => {

        const table =
            findTable(state, group.tableId);

        const award = {
            id: state.nextIds.award++,
            title: `Quiz: ${quiz.question}`,
            note: `${group.correctCount} risposta/e corretta/e`,
            type: "quiz",
            tableId: table ? table.id : group.tableId,
            tableName: table ? table.name : group.tableName,
            tablePoints: group.correctCount * 3,
            teamPointsBride: group.brideCount * 3,
            teamPointsGroom: group.groomCount * 3,
            createdAt: new Date().toISOString(),
            voided: false
        };

        state.awards.unshift(award);

    });

    quiz.awardedAt =
        new Date().toISOString();

    recalculateScores(state);

}

function emitState(io, state) {

    io.emit(
        "fantasposi:state",
        publicState(state)
    );

}

function getLocalAddress() {

    const interfaces =
        os.networkInterfaces();

    for (const entries of Object.values(interfaces)) {

        for (const entry of entries || []) {

            if (
                entry.family === "IPv4" &&
                !entry.internal
            ) {
                return entry.address;
            }

        }

    }

    return "localhost";

}

function publicBaseUrl(req) {

    const host =
        req.get("host") || "localhost:3000";

    const port =
        host.includes(":") ?
            host.split(":").pop() :
            "3000";

    const hostName =
        host.split(":")[0];

    if (
        hostName === "localhost" ||
        hostName === "127.0.0.1" ||
        hostName === "::1"
    ) {
        return `${req.protocol}://${getLocalAddress()}:${port}`;
    }

    return `${req.protocol}://${host}`;

}

function installFantasposi(app, io) {

    const state =
        loadState();
    const adminPassword =
        process.env.FANTASPOSI_ADMIN_PASSWORD || "admin1234@1234";

    function requireAdmin(req, res, next) {

        const provided =
            String(req.get("x-fantasposi-admin-password") || "");

        if (provided !== adminPassword) {
            return res.status(401).json({
                error: "Password admin non valida"
            });
        }

        next();

    }

    recalculateScores(state);
    saveState(state);

    app.get("/api/fantasposi/state", (req, res) => {

        res.json(publicState(state));

    });

    app.get("/api/fantasposi/info", async (req, res) => {

        const baseUrl =
            publicBaseUrl(req);

        const guestUrl =
            `${baseUrl}/fantasposi.html`;

        const adminUrl =
            `${baseUrl}/fantasposi-admin.html`;

        const qr =
            await QRCode.toDataURL(
                guestUrl,
                {
                    margin: 1,
                    width: 160
                }
            );

        res.json({
            guestUrl,
            adminUrl,
            qr
        });

    });

    app.post("/api/fantasposi/admin-login", (req, res) => {

        const body =
            safeObject(req.body);

        res.json({
            ok: String(body.password || "") === adminPassword
        });

    });

    app.post("/api/fantasposi/event", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);

        state.event = {
            ...state.event,
            title: cleanText(body.title, state.event.title),
            subtitle: cleanText(body.subtitle, state.event.subtitle),
            date: cleanText(body.date, state.event.date),
            venue: cleanText(body.venue, state.event.venue),
            welcome: cleanLongText(body.welcome, state.event.welcome),
            brideName: cleanText(body.brideName, state.event.brideName),
            groomName: cleanText(body.groomName, state.event.groomName),
            brideTeamName:
                cleanText(body.brideTeamName, state.event.brideTeamName),
            groomTeamName:
                cleanText(body.groomTeamName, state.event.groomTeamName),
            theme: cleanText(body.theme, state.event.theme),
            titleFont: cleanText(body.titleFont, state.event.titleFont),
            bodyFont: cleanText(body.bodyFont, state.event.bodyFont),
            brideColor:
                cleanColor(body.brideColor, state.event.brideColor),
            groomColor:
                cleanColor(body.groomColor, state.event.groomColor),
            accentColor:
                cleanColor(body.accentColor, state.event.accentColor)
        };

        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/reset-game", requireAdmin, (req, res) => {

        state.tables = [];
        state.participants = [];
        state.awards = [];
        state.challenges = [];
        state.claims = [];
        state.quizzes = [];
        state.quizAnswers = [];
        state.scores = {
            bride: 0,
            groom: 0
        };
        state.nextIds = {
            table: 1,
            participant: 1,
            award: 1,
            challenge: 1,
            claim: 1,
            quiz: 1,
            quizAnswer: 1
        };

        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/tables", requireAdmin, (req, res) => {

        const name =
            cleanText(req.body && req.body.name);

        if (!name) {
            return res.status(400).json({
                error: "Nome tavolo mancante"
            });
        }

        const existing =
            state.tables.find(table =>
                table.name.toLowerCase() === name.toLowerCase()
            );

        if (existing) {
            return res.json(existing);
        }

        const table = {
            id: state.nextIds.table++,
            name,
            score: 0
        };

        state.tables.push(table);
        saveState(state);
        emitState(io, state);
        res.json(table);

    });

    app.patch("/api/fantasposi/tables/:id", requireAdmin, (req, res) => {

        const table =
            findTable(state, req.params.id);

        if (!table) {
            return res.status(404).json({
                error: "Tavolo non trovato"
            });
        }

        table.name =
            cleanText(req.body && req.body.name, table.name);

        saveState(state);
        emitState(io, state);
        res.json(table);

    });

    app.delete("/api/fantasposi/tables/:id", requireAdmin, (req, res) => {

        const table =
            findTable(state, req.params.id);

        if (!table) {
            return res.status(404).json({
                error: "Tavolo non trovato"
            });
        }

        const hasParticipants =
            state.participants.some(participant =>
                participant.tableId === table.id
            );

        const hasAwards =
            state.awards.some(award =>
                !award.voided &&
                award.tableId === table.id
            );

        if (hasParticipants || hasAwards) {
            return res.status(400).json({
                error: "Puoi eliminare solo tavoli senza iscritti e senza punti."
            });
        }

        state.tables =
            state.tables.filter(item =>
                item.id !== table.id
            );

        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/register", (req, res) => {

        const body =
            safeObject(req.body);

        const team =
            teamKey(body.team);

        if (!team) {
            return res.status(400).json({
                error: "Team non valido"
            });
        }

        let table =
            findTable(state, body.tableId);

        const tableName =
            cleanText(body.tableName);

        if (!table && tableName) {

            table =
                state.tables.find(item =>
                    item.name.toLowerCase() === tableName.toLowerCase()
                );

            if (!table) {
                table = {
                    id: state.nextIds.table++,
                    name: tableName,
                    score: 0
                };
                state.tables.push(table);
            }

        }

        if (!table) {
            return res.status(400).json({
                error: "Tavolo mancante"
            });
        }

        const participant = {
            id: state.nextIds.participant++,
            name: cleanText(body.name, "Invitato"),
            team,
            tableId: table.id,
            createdAt: new Date().toISOString()
        };

        state.participants.push(participant);
        saveState(state);
        emitState(io, state);
        res.json({
            participant,
            state: publicState(state)
        });

    });

    app.patch("/api/fantasposi/participants/:id", requireAdmin, (req, res) => {

        const participant =
            state.participants.find(item =>
                item.id === Number(req.params.id)
            );

        if (!participant) {
            return res.status(404).json({
                error: "Partecipante non trovato"
            });
        }

        const nextTeam =
            teamKey(req.body && req.body.team);

        if (!nextTeam) {
            return res.status(400).json({
                error: "Team non valido"
            });
        }

        participant.team = nextTeam;
        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/awards", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);

        const table =
            body.tableId ? findTable(state, body.tableId) : null;

        const directTeam =
            teamKey(body.team);

        let teamPointsBride =
            cleanPoints(body.teamPointsBride);

        let teamPointsGroom =
            cleanPoints(body.teamPointsGroom);

        if (directTeam === "bride") {
            teamPointsBride += cleanPoints(body.teamPoints);
        }

        if (directTeam === "groom") {
            teamPointsGroom += cleanPoints(body.teamPoints);
        }

        if (table && body.applyTableShares) {

            const composition =
                tableComposition(state, table.id);

            teamPointsBride += composition.bride;
            teamPointsGroom += composition.groom;

        }

        const award = {
            id: state.nextIds.award++,
            title: cleanText(body.title, "Fantasfida"),
            note: cleanLongText(body.note),
            type: cleanText(body.type, "manuale"),
            tableId: table ? table.id : null,
            tableName: table ? table.name : "",
            tablePoints: table ? cleanPoints(body.tablePoints) : 0,
            teamPointsBride,
            teamPointsGroom,
            createdAt: new Date().toISOString(),
            voided: false
        };

        state.awards.unshift(award);
        recalculateScores(state);
        saveState(state);
        emitState(io, state);
        res.json({
            award,
            state: publicState(state)
        });

    });

    app.post("/api/fantasposi/awards/:id/void", requireAdmin, (req, res) => {

        const award =
            state.awards.find(item =>
                item.id === Number(req.params.id)
            );

        if (!award) {
            return res.status(404).json({
                error: "Fantasfida non trovata"
            });
        }

        award.voided = true;
        recalculateScores(state);
        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/challenges", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);

        const challenge = {
            id: state.nextIds.challenge++,
            title: cleanText(body.title, "Sfida improvvisa"),
            description: cleanLongText(body.description),
            reward: cleanText(body.reward, ""),
            tablePoints: cleanPoints(body.tablePoints),
            teamPoints: cleanPoints(body.teamPoints),
            status: "active",
            createdAt: new Date().toISOString(),
            winnerClaimId: null
        };

        state.challenges.unshift(challenge);
        saveState(state);
        emitState(io, state);
        io.emit("fantasposi:challenge", challenge);
        res.json(challenge);

    });

    app.post("/api/fantasposi/challenges/:id/close", requireAdmin, (req, res) => {

        const challenge =
            state.challenges.find(item =>
                item.id === Number(req.params.id)
            );

        if (!challenge) {
            return res.status(404).json({
                error: "Sfida non trovata"
            });
        }

        challenge.status = "closed";
        saveState(state);
        emitState(io, state);
        res.json(challenge);

    });

    app.post("/api/fantasposi/challenges/:id/claim", (req, res) => {

        const challenge =
            state.challenges.find(item =>
                item.id === Number(req.params.id)
            );

        if (!challenge || challenge.status !== "active") {
            return res.status(400).json({
                error: "Sfida non attiva"
            });
        }

        const participant =
            state.participants.find(item =>
                item.id === Number(req.body && req.body.participantId)
            );

        if (!participant) {
            return res.status(400).json({
                error: "Partecipante non trovato"
            });
        }

        const table =
            findTable(state, participant.tableId);

        const claim = {
            id: state.nextIds.claim++,
            challengeId: challenge.id,
            participantId: participant.id,
            team: participant.team,
            tableId: participant.tableId,
            tableName: table ? table.name : "",
            note: cleanLongText(req.body && req.body.note),
            status: "pending",
            createdAt: new Date().toISOString()
        };

        state.claims.unshift(claim);
        saveState(state);
        emitState(io, state);
        res.json(claim);

    });

    app.post("/api/fantasposi/claims/:id/approve", requireAdmin, (req, res) => {

        const claim =
            state.claims.find(item =>
                item.id === Number(req.params.id)
            );

        if (!claim || claim.status !== "pending") {
            return res.status(400).json({
                error: "Richiesta non valida"
            });
        }

        const challenge =
            state.challenges.find(item =>
                item.id === claim.challengeId
            );

        if (!challenge || challenge.status !== "active") {
            return res.status(400).json({
                error: "Sfida gia chiusa"
            });
        }

        claim.status = "approved";
        challenge.status = "won";
        challenge.winnerClaimId = claim.id;

        const award = {
            id: state.nextIds.award++,
            title: challenge.title,
            note: `Sfida improvvisa: ${challenge.description}`,
            type: "improvvisa",
            tableId: claim.tableId,
            tableName: claim.tableName,
            tablePoints: challenge.tablePoints,
            teamPointsBride:
                claim.team === "bride" ? challenge.teamPoints : 0,
            teamPointsGroom:
                claim.team === "groom" ? challenge.teamPoints : 0,
            createdAt: new Date().toISOString(),
            voided: false
        };

        state.awards.unshift(award);
        recalculateScores(state);
        saveState(state);
        emitState(io, state);
        res.json({
            claim,
            award,
            state: publicState(state)
        });

    });

    app.post("/api/fantasposi/claims/:id/reject", requireAdmin, (req, res) => {

        const claim =
            state.claims.find(item =>
                item.id === Number(req.params.id)
            );

        if (!claim || claim.status !== "pending") {
            return res.status(400).json({
                error: "Richiesta non valida"
            });
        }

        claim.status = "rejected";
        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.post("/api/fantasposi/quizzes", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);

        const answers =
            Array.isArray(body.answers) ?
                body.answers.slice(0, 4).map(answer =>
                    cleanText(answer)
                ) :
                [];

        if (
            !cleanText(body.question) ||
            answers.length !== 4 ||
            answers.some(answer => !answer)
        ) {
            return res.status(400).json({
                error: "Domanda e 4 risposte sono obbligatorie"
            });
        }

        const correctIndex =
            Number(body.correctIndex);

        if (
            !Number.isInteger(correctIndex) ||
            correctIndex < 0 ||
            correctIndex > 3
        ) {
            return res.status(400).json({
                error: "Risposta corretta non valida"
            });
        }

        state.quizzes.forEach(quiz => {
            if (quiz.status === "active") {
                quiz.status = "closed";
            }
        });

        const quiz = {
            id: state.nextIds.quiz++,
            question: cleanLongText(body.question),
            answers,
            correctIndex,
            status: "active",
            createdAt: new Date().toISOString(),
            closedAt: null,
            awardedAt: null
        };

        state.quizzes.unshift(quiz);
        saveState(state);
        emitState(io, state);
        io.emit("fantasposi:quiz", quiz);
        res.json(quiz);

    });

    app.post("/api/fantasposi/quizzes/draft", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);

        const answers =
            Array.isArray(body.answers) ?
                body.answers.slice(0, 4).map(answer =>
                    cleanText(answer)
                ) :
                [];

        if (
            !cleanText(body.question) ||
            answers.length !== 4 ||
            answers.some(answer => !answer)
        ) {
            return res.status(400).json({
                error: "Domanda e 4 risposte sono obbligatorie"
            });
        }

        const correctIndex =
            Number(body.correctIndex);

        if (
            !Number.isInteger(correctIndex) ||
            correctIndex < 0 ||
            correctIndex > 3
        ) {
            return res.status(400).json({
                error: "Risposta corretta non valida"
            });
        }

        const quiz = {
            id: state.nextIds.quiz++,
            question: cleanLongText(body.question),
            answers,
            correctIndex,
            status: "draft",
            createdAt: new Date().toISOString(),
            closedAt: null,
            awardedAt: null
        };

        state.quizzes.unshift(quiz);
        saveState(state);
        emitState(io, state);
        res.json(quiz);

    });

    app.post("/api/fantasposi/quizzes/:id/launch", requireAdmin, (req, res) => {

        const quiz =
            state.quizzes.find(item =>
                item.id === Number(req.params.id)
            );

        if (!quiz) {
            return res.status(404).json({
                error: "Quiz non trovato"
            });
        }

        state.quizzes.forEach(item => {
            if (item.status === "active") {
                item.status = "closed";
                item.closedAt = new Date().toISOString();
            }
        });

        quiz.status = "active";
        quiz.closedAt = null;
        quiz.awardedAt = null;

        state.quizAnswers =
            state.quizAnswers.filter(answer =>
                answer.quizId !== quiz.id
            );

        saveState(state);
        emitState(io, state);
        io.emit("fantasposi:quiz", quiz);
        res.json(quiz);

    });

    app.post("/api/fantasposi/quizzes/:id/answer", (req, res) => {

        const quiz =
            state.quizzes.find(item =>
                item.id === Number(req.params.id)
            );

        if (!quiz || quiz.status !== "active") {
            return res.status(400).json({
                error: "Quiz non attivo"
            });
        }

        const participant =
            state.participants.find(item =>
                item.id === Number(req.body && req.body.participantId)
            );

        if (!participant) {
            return res.status(400).json({
                error: "Partecipante non trovato"
            });
        }

        const answerIndex =
            Number(req.body && req.body.answerIndex);

        if (
            !Number.isInteger(answerIndex) ||
            answerIndex < 0 ||
            answerIndex > 3
        ) {
            return res.status(400).json({
                error: "Risposta non valida"
            });
        }

        const existing =
            state.quizAnswers.find(answer =>
                answer.quizId === quiz.id &&
                answer.participantId === participant.id
            );

        if (existing) {
            existing.answerIndex = answerIndex;
            existing.isCorrect = answerIndex === quiz.correctIndex;
            existing.updatedAt = new Date().toISOString();
            saveState(state);
            emitState(io, state);
            return res.json(existing);
        }

        const table =
            findTable(state, participant.tableId);

        const answer = {
            id: state.nextIds.quizAnswer++,
            quizId: quiz.id,
            participantId: participant.id,
            team: participant.team,
            tableId: participant.tableId,
            tableName: table ? table.name : "",
            answerIndex,
            isCorrect: answerIndex === quiz.correctIndex,
            createdAt: new Date().toISOString()
        };

        state.quizAnswers.unshift(answer);
        saveState(state);
        emitState(io, state);
        res.json(answer);

    });

    app.post("/api/fantasposi/quizzes/:id/close", requireAdmin, (req, res) => {

        const quiz =
            state.quizzes.find(item =>
                item.id === Number(req.params.id)
            );

        if (!quiz) {
            return res.status(404).json({
                error: "Quiz non trovato"
            });
        }

        quiz.status = "closed";
        quiz.closedAt = new Date().toISOString();
        awardQuizPoints(state, quiz);
        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    app.delete("/api/fantasposi/quizzes/:id", requireAdmin, (req, res) => {

        const quizId =
            Number(req.params.id);

        state.quizzes =
            state.quizzes.filter(quiz =>
                quiz.id !== quizId
            );

        state.quizAnswers =
            state.quizAnswers.filter(answer =>
                answer.quizId !== quizId
            );

        saveState(state);
        emitState(io, state);
        res.json(publicState(state));

    });

    io.on("connection", socket => {

        socket.emit(
            "fantasposi:state",
            publicState(state)
        );

    });

}

module.exports = {
    installFantasposi
};
