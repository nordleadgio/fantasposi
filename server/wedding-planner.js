const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const QRCode = require("qrcode");
const {
    APP_FOLDER
} = require("../shared/paths");

const DATA_FOLDER =
    path.join(APP_FOLDER, "WeddingPlanner");

const DATA_FILE =
    path.join(DATA_FOLDER, "schede.json");

function createInitialState() {

    return {
        events: [],
        nextIds: {
            event: 1
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

        return normalizeState(
            JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
        );

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
        next.events =
            Array.isArray(state.events) ? state.events.map(normalizeEvent) : [];
        next.nextIds = {
            ...next.nextIds,
            ...safeObject(state.nextIds)
        };
    }

    const maxId =
        next.events.reduce(
            (highest, event) => Math.max(highest, Number(event.id) || 0),
            0
        );

    next.nextIds.event =
        Math.max(Number(next.nextIds.event) || 1, maxId + 1);

    return next;

}

function safeObject(value) {

    return value && typeof value === "object" ? value : {};

}

function cleanText(value, fallback = "", max = 180) {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim().slice(0, max);

}

function cleanLongText(value, fallback = "", max = 1600) {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim().slice(0, max);

}

function cleanBoolean(value) {

    return value === true;

}

function cleanUrl(value) {

    const text =
        cleanText(value, "", 500);

    if (!text) {
        return "";
    }

    try {

        const url =
            new URL(text);

        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.toString();
        }

    } catch (err) {

        return "";

    }

    return "";

}

function cleanSong(value) {

    const song =
        safeObject(value);

    return {
        title: cleanText(song.title, "", 220),
        artist: cleanText(song.artist, "", 220),
        youtubeUrl: cleanUrl(song.youtubeUrl)
    };

}

function cleanSongList(value) {

    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .slice(0, 12)
        .map(cleanSong)
        .filter(song =>
            song.title || song.artist || song.youtubeUrl
        );

}

function createEmptyAnswers() {

    return {
        couple: {
            groomFullName: "",
            brideFullName: "",
            groomAge: "",
            brideAge: "",
            hasChildren: false,
            childrenNames: ""
        },
        ceremony: {
            type: "",
            civilSeparateEntrances: true,
            groomEntranceSong: cleanSong({}),
            brideEntranceSong: cleanSong({}),
            jointEntranceSong: cleanSong({}),
            ceremonyClosingSong: cleanSong({}),
            ceremonyExitSong: cleanSong({}),
            religiousNotes: ""
        },
        reception: {
            arrivalSong: cleanSong({}),
            entranceSong: cleanSong({}),
            firstDanceSong: cleanSong({}),
            cakeMainSong: cleanSong({}),
            cakeExtraSongs: []
        },
        specialMoments: {
            parentDance: false,
            parentDanceSong: cleanSong({}),
            siblingDance: false,
            siblingDanceSong: cleanSong({}),
            childrenDance: false,
            childrenDanceSong: cleanSong({}),
            dedications: "",
            otherRequests: ""
        }
    };

}

function cleanAnswers(value) {

    const body =
        safeObject(value);
    const current =
        createEmptyAnswers();
    const couple =
        safeObject(body.couple);
    const ceremony =
        safeObject(body.ceremony);
    const reception =
        safeObject(body.reception);
    const specialMoments =
        safeObject(body.specialMoments);

    current.couple = {
        groomFullName: cleanText(couple.groomFullName, "", 180),
        brideFullName: cleanText(couple.brideFullName, "", 180),
        groomAge: cleanText(couple.groomAge, "", 8),
        brideAge: cleanText(couple.brideAge, "", 8),
        hasChildren: cleanBoolean(couple.hasChildren),
        childrenNames: cleanLongText(couple.childrenNames, "", 500)
    };

    current.ceremony = {
        type: ["civil", "religious"].includes(ceremony.type) ?
            ceremony.type :
            "",
        civilSeparateEntrances:
            ceremony.civilSeparateEntrances !== false,
        groomEntranceSong: cleanSong(ceremony.groomEntranceSong),
        brideEntranceSong: cleanSong(ceremony.brideEntranceSong),
        jointEntranceSong: cleanSong(ceremony.jointEntranceSong),
        ceremonyClosingSong: cleanSong(ceremony.ceremonyClosingSong),
        ceremonyExitSong: cleanSong(ceremony.ceremonyExitSong),
        religiousNotes: cleanLongText(ceremony.religiousNotes, "", 1000)
    };

    current.reception = {
        arrivalSong: cleanSong(reception.arrivalSong),
        entranceSong: cleanSong(reception.entranceSong),
        firstDanceSong: cleanSong(reception.firstDanceSong),
        cakeMainSong: cleanSong(reception.cakeMainSong),
        cakeExtraSongs: cleanSongList(reception.cakeExtraSongs)
    };

    current.specialMoments = {
        parentDance: cleanBoolean(specialMoments.parentDance),
        parentDanceSong: cleanSong(specialMoments.parentDanceSong),
        siblingDance: cleanBoolean(specialMoments.siblingDance),
        siblingDanceSong: cleanSong(specialMoments.siblingDanceSong),
        childrenDance: cleanBoolean(specialMoments.childrenDance),
        childrenDanceSong: cleanSong(specialMoments.childrenDanceSong),
        dedications: cleanLongText(specialMoments.dedications, "", 1600),
        otherRequests: cleanLongText(specialMoments.otherRequests, "", 1600)
    };

    return current;

}

function normalizeEvent(event) {

    const source =
        safeObject(event);

    return {
        id: Number(source.id) || 0,
        token: cleanText(source.token, randomToken(), 64),
        title: cleanText(source.title, "La vostra colonna sonora", 220),
        groomName: cleanText(source.groomName, "", 120),
        brideName: cleanText(source.brideName, "", 120),
        weddingDate: cleanText(source.weddingDate, "", 40),
        venue: cleanText(source.venue, "", 180),
        introMessage: cleanLongText(
            source.introMessage,
            "Compilate con calma i momenti musicali piu importanti. Potrete inviare la scheda quando vi sembrera completa.",
            800
        ),
        status: cleanText(source.status, "bozza", 40),
        adminCeremonyNotes: cleanLongText(source.adminCeremonyNotes, "", 1600),
        answers: cleanAnswers(source.answers),
        createdAt: cleanText(source.createdAt, new Date().toISOString(), 80),
        updatedAt: cleanText(source.updatedAt, new Date().toISOString(), 80),
        submittedAt: cleanText(source.submittedAt, "", 80)
    };

}

function randomToken() {

    return crypto.randomBytes(12).toString("hex");

}

function publicEvent(event) {

    return {
        token: event.token,
        title: event.title,
        groomName: event.groomName,
        brideName: event.brideName,
        weddingDate: event.weddingDate,
        venue: event.venue,
        introMessage: event.introMessage,
        adminCeremonyNotes: event.adminCeremonyNotes,
        answers: event.answers,
        status: event.status,
        submittedAt: event.submittedAt
    };

}

function findEventByToken(state, token) {

    return state.events.find(event =>
        event.token === token
    ) || null;

}

function getLocalAddress() {

    const interfaces =
        os.networkInterfaces();

    for (const entries of Object.values(interfaces)) {
        for (const entry of entries || []) {
            if (entry.family === "IPv4" && !entry.internal) {
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
        host.includes(":") ? host.split(":").pop() : "3000";
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

function withLinks(req, event) {

    const baseUrl =
        publicBaseUrl(req);
    const publicUrl =
        `${baseUrl}/scheda-musicale/${event.token}`;

    return {
        ...event,
        publicUrl
    };

}

function songLabel(label, song) {

    if (!song || (!song.title && !song.artist && !song.youtubeUrl)) {
        return "";
    }

    const title =
        [song.title, song.artist].filter(Boolean).join(" - ");

    return `${label}: ${title}${song.youtubeUrl ? ` (${song.youtubeUrl})` : ""}`;

}

function summaryLines(event) {

    const answers =
        event.answers || createEmptyAnswers();
    const couple =
        answers.couple || {};
    const ceremony =
        answers.ceremony || {};
    const reception =
        answers.reception || {};
    const special =
        answers.specialMoments || {};
    const sections = [
        {
            title: "Sposi",
            rows: [
                couple.groomFullName && `Sposo: ${couple.groomFullName}`,
                couple.brideFullName && `Sposa: ${couple.brideFullName}`,
                couple.groomAge && `Eta sposo: ${couple.groomAge}`,
                couple.brideAge && `Eta sposa: ${couple.brideAge}`,
                couple.hasChildren && `Figli: ${couple.childrenNames || "si"}`
            ]
        },
        {
            title: "Rito",
            rows: [
                ceremony.type === "civil" ? "Rito civile" : "",
                ceremony.type === "religious" ? "Rito religioso" : "",
                songLabel("Ingresso sposo", ceremony.groomEntranceSong),
                songLabel("Ingresso sposa", ceremony.brideEntranceSong),
                songLabel("Ingresso insieme", ceremony.jointEntranceSong),
                songLabel("Conclusione rito", ceremony.ceremonyClosingSong),
                songLabel("Uscita sposi", ceremony.ceremonyExitSong),
                ceremony.religiousNotes && `Note rito: ${ceremony.religiousNotes}`
            ]
        },
        {
            title: "Best Moment",
            rows: [
                songLabel("Arrivo location", reception.arrivalSong),
                songLabel("Ingresso", reception.entranceSong),
                songLabel("Ballo sposi", reception.firstDanceSong),
                songLabel("Taglio torta", reception.cakeMainSong),
                ...((reception.cakeExtraSongs || []).map((song, index) =>
                    songLabel(`Brano extra ${index + 1}`, song)
                ))
            ]
        },
        {
            title: "Momenti speciali",
            rows: [
                special.parentDance && songLabel("Ballo genitori", special.parentDanceSong),
                special.siblingDance && songLabel("Ballo fratelli/sorelle", special.siblingDanceSong),
                special.childrenDance && songLabel("Ballo figli", special.childrenDanceSong),
                special.dedications && `Dediche: ${special.dedications}`,
                special.otherRequests && `Altre richieste: ${special.otherRequests}`
            ]
        }
    ];

    return sections
        .map(section => ({
            title: section.title,
            rows: section.rows.filter(Boolean)
        }))
        .filter(section => section.rows.length);

}

function pdfEscape(value) {

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7e]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");

}

function wrapPdfText(text, maxChars) {

    const words =
        String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    words.forEach(word => {
        const next =
            current ? `${current} ${word}` : word;

        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
            return;
        }

        current = next;
    });

    if (current) {
        lines.push(current);
    }

    return lines.length ? lines : [""];

}

function createPdfBuffer(event) {

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 54;
    const bottom = 54;
    const normalSize = 11;
    const titleSize = 22;
    const headingSize = 14;
    const lineHeight = 17;
    const pages = [];
    let commands = [];
    let y = pageHeight - margin;

    function addPage() {
        if (commands.length) {
            pages.push(commands.join("\n"));
        }
        commands = [];
        y = pageHeight - margin;
    }

    function ensureSpace(height) {
        if (y - height < bottom) {
            addPage();
        }
    }

    function textLine(text, x, size, font) {
        commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);
        y -= size + 6;
    }

    textLine(event.title || "Scheda sposi", margin, titleSize, "F2");

    [
        event.weddingDate && `Data: ${event.weddingDate}`,
        event.venue && `Location: ${event.venue}`,
        event.status && `Stato: ${event.status}`
    ]
        .filter(Boolean)
        .forEach(row => textLine(row, margin, normalSize, "F1"));

    y -= 10;

    summaryLines(event).forEach(section => {
        ensureSpace(headingSize + 30);
        textLine(section.title, margin, headingSize, "F2");

        section.rows.forEach(row => {
            wrapPdfText(row, 92).forEach((line, index) => {
                ensureSpace(lineHeight);
                textLine(index === 0 ? line : `  ${line}`, margin + 12, normalSize, "F1");
            });
        });

        y -= 8;
    });

    if (!summaryLines(event).length) {
        textLine("Gli sposi non hanno ancora compilato la scheda.", margin, normalSize, "F1");
    }

    addPage();

    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Kids [${pages.map((_, index) => `${index + 3} 0 R`).join(" ")}] /Count ${pages.length} >>`
    ];
    const contentStart =
        3 + pages.length;

    pages.forEach((_, index) => {
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${contentStart + pages.length} 0 R /F2 ${contentStart + pages.length + 1} 0 R >> >> /Contents ${contentStart + index} 0 R >>`);
    });

    pages.forEach(page => {
        objects.push(`<< /Length ${Buffer.byteLength(page, "latin1")} >>\nstream\n${page}\nendstream`);
    });

    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    let pdf =
        "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf, "latin1"));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset =
        Buffer.byteLength(pdf, "latin1");

    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    offsets.slice(1).forEach(offset => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "latin1");

}

function installWeddingPlanner(app) {

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

    app.get("/api/wedding-planner/events", requireAdmin, (req, res) => {

        res.json(
            state.events.map(event => withLinks(req, event))
        );

    });

    app.post("/api/wedding-planner/events", requireAdmin, (req, res) => {

        const body =
            safeObject(req.body);
        const now =
            new Date().toISOString();
        const event =
            normalizeEvent({
                id: state.nextIds.event++,
                token: randomToken(),
                title: cleanText(body.title, "La vostra colonna sonora", 220),
                groomName: cleanText(body.groomName, "", 120),
                brideName: cleanText(body.brideName, "", 120),
                weddingDate: cleanText(body.weddingDate, "", 40),
                venue: cleanText(body.venue, "", 180),
                introMessage: cleanLongText(body.introMessage, "", 800),
                status: "bozza",
                answers: createEmptyAnswers(),
                createdAt: now,
                updatedAt: now
            });

        if (!event.title && (event.groomName || event.brideName)) {
            event.title =
                `Il matrimonio di ${event.groomName} e ${event.brideName}`.trim();
        }

        state.events.unshift(event);
        saveState(state);
        res.json(withLinks(req, event));

    });

    app.put("/api/wedding-planner/events/:token", requireAdmin, (req, res) => {

        const event =
            findEventByToken(state, req.params.token);

        if (!event) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        const body =
            safeObject(req.body);

        event.title = cleanText(body.title, event.title, 220);
        event.groomName = cleanText(body.groomName, event.groomName, 120);
        event.brideName = cleanText(body.brideName, event.brideName, 120);
        event.weddingDate = cleanText(body.weddingDate, event.weddingDate, 40);
        event.venue = cleanText(body.venue, event.venue, 180);
        event.introMessage =
            cleanLongText(body.introMessage, event.introMessage, 800);
        event.status = cleanText(body.status, event.status, 40);
        event.adminCeremonyNotes =
            cleanLongText(body.adminCeremonyNotes, event.adminCeremonyNotes, 1600);

        if (body.answers) {
            event.answers =
                cleanAnswers(body.answers);
        }

        event.updatedAt =
            new Date().toISOString();

        saveState(state);
        res.json(withLinks(req, event));

    });

    app.delete("/api/wedding-planner/events/:token", requireAdmin, (req, res) => {

        const index =
            state.events.findIndex(event =>
                event.token === req.params.token
            );

        if (index === -1) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        const deleted =
            state.events.splice(index, 1)[0];

        saveState(state);
        res.json({
            ok: true,
            token: deleted.token
        });

    });

    app.get("/api/wedding-planner/public/:token", (req, res) => {

        const event =
            findEventByToken(state, req.params.token);

        if (!event) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        res.json(publicEvent(event));

    });

    app.post("/api/wedding-planner/public/:token", (req, res) => {

        const event =
            findEventByToken(state, req.params.token);

        if (!event) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        event.answers =
            cleanAnswers(req.body && req.body.answers);
        event.status =
            req.body && req.body.submit ? "compilata" : "in compilazione";
        event.updatedAt =
            new Date().toISOString();

        if (req.body && req.body.submit) {
            event.submittedAt =
                event.updatedAt;
        }

        saveState(state);
        res.json(publicEvent(event));

    });

    app.get("/api/wedding-planner/events/:token/qr", requireAdmin, async (req, res) => {

        const event =
            findEventByToken(state, req.params.token);

        if (!event) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        const qr =
            await QRCode.toDataURL(
                `${publicBaseUrl(req)}/scheda-musicale/${event.token}`,
                {
                    margin: 1,
                    width: 180
                }
            );

        res.json({
            qr
        });

    });

    app.get("/api/wedding-planner/events/:token/pdf", requireAdmin, (req, res) => {

        const event =
            findEventByToken(state, req.params.token);

        if (!event) {
            return res.status(404).json({
                error: "Scheda non trovata"
            });
        }

        const fileName =
            `${(event.title || "scheda-sposi")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "scheda-sposi"}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
        res.send(createPdfBuffer(event));

    });

}

module.exports = {
    installWeddingPlanner
};
