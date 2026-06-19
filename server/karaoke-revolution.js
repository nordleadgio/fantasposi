const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
    APP_FOLDER
} = require("../shared/paths");

const DATA_FOLDER =
    path.join(APP_FOLDER, "Karaoke R-Evolution");

const DATA_FILE =
    path.join(DATA_FOLDER, "site.json");

const ADMIN_PASSWORD =
    process.env.KRE_ADMIN_PASSWORD || "karaoke-revolution-admin";

const sessions =
    new Map();

const DEFAULT_STATE = {
    settings: {
        instagramUrl: "https://www.instagram.com/karaokerevolution/",
        whatsappUrl: "https://wa.me/390000000000",
        email: "info@karaokerevolution.it",
        appUrl: "/karaoke.html"
    },
    events: [
        {
            id: 1,
            date: "2026-07-03",
            time: "21:30",
            venue: "Live Club",
            city: "Milano",
            address: "Via della Musica 12, Milano",
            mapsUrl: "https://www.google.com/maps",
            description: "Serata karaoke live con quiz, giochi e classifica.",
            imageUrl: "",
            visible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ],
    partners: [
        {
            id: 1,
            name: "Live Club",
            city: "Milano",
            recurringDay: "Venerdì",
            mapsUrl: "https://www.google.com/maps",
            visible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ],
    nextIds: {
        event: 2,
        partner: 2
    }
};

function installKaraokeRevolution(app) {

    const state =
        loadState();

    saveState(state);

    app.get("/", (req, res) => {
        res.sendFile(
            path.join(__dirname, "../public/karaoke-revolution.html")
        );
    });

    app.get("/admin", (req, res) => {
        res.sendFile(
            path.join(__dirname, "../public/karaoke-revolution-admin.html")
        );
    });

    app.get("/api/karaoke-revolution/public", (req, res) => {
        res.json(publicState(state));
    });

    app.post("/api/karaoke-revolution/login", (req, res) => {

        const password =
            String(req.body && req.body.password || "");

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({
                error: "Password non valida"
            });
        }

        const token =
            crypto.randomBytes(32).toString("hex");

        sessions.set(
            token,
            Date.now() + 1000 * 60 * 60 * 12
        );

        res.json({
            token
        });

    });

    app.get(
        "/api/karaoke-revolution/admin/state",
        requireAdmin,
        (req, res) => {
            res.json(state);
        }
    );

    app.put(
        "/api/karaoke-revolution/admin/settings",
        requireAdmin,
        (req, res) => {

            state.settings = {
                ...state.settings,
                instagramUrl:
                    cleanUrl(req.body.instagramUrl, state.settings.instagramUrl),
                whatsappUrl:
                    cleanUrl(req.body.whatsappUrl, state.settings.whatsappUrl),
                email:
                    cleanEmail(req.body.email, state.settings.email),
                appUrl:
                    cleanUrl(req.body.appUrl, state.settings.appUrl)
            };

            saveState(state);
            res.json(state);

        }
    );

    app.post(
        "/api/karaoke-revolution/admin/events",
        requireAdmin,
        (req, res) => {

            const event =
                normalizeEvent(req.body, state.nextIds.event++);

            state.events.unshift(event);
            sortEvents(state);
            saveState(state);
            res.json(state);

        }
    );

    app.put(
        "/api/karaoke-revolution/admin/events/:id",
        requireAdmin,
        (req, res) => {

            const event =
                findById(state.events, req.params.id);

            if (!event) {
                return res.status(404).json({
                    error: "Evento non trovato"
                });
            }

            Object.assign(
                event,
                normalizeEvent(req.body, event.id, event),
                {
                    updatedAt: new Date().toISOString()
                }
            );

            sortEvents(state);
            saveState(state);
            res.json(state);

        }
    );

    app.delete(
        "/api/karaoke-revolution/admin/events/:id",
        requireAdmin,
        (req, res) => {

            state.events =
                state.events.filter(event =>
                    event.id !== Number(req.params.id)
                );

            saveState(state);
            res.json(state);

        }
    );

    app.post(
        "/api/karaoke-revolution/admin/events/:id/duplicate",
        requireAdmin,
        (req, res) => {

            const event =
                findById(state.events, req.params.id);

            if (!event) {
                return res.status(404).json({
                    error: "Evento non trovato"
                });
            }

            const copy = {
                ...event,
                id: state.nextIds.event++,
                date: cleanDate(req.body && req.body.date, event.date),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            state.events.unshift(copy);
            sortEvents(state);
            saveState(state);
            res.json(state);

        }
    );

    app.post(
        "/api/karaoke-revolution/admin/events/recurring",
        requireAdmin,
        (req, res) => {

            const count =
                clampInteger(req.body && req.body.count, 2, 30, 4);

            const intervalDays =
                clampInteger(req.body && req.body.intervalDays, 1, 31, 7);

            const base =
                normalizeEvent(req.body && req.body.event, state.nextIds.event);

            const start =
                parseDate(base.date);

            if (!start) {
                return res.status(400).json({
                    error: "Data di partenza non valida"
                });
            }

            for (let index = 0; index < count; index++) {

                const date =
                    new Date(start.getTime());

                date.setDate(start.getDate() + intervalDays * index);

                state.events.unshift({
                    ...base,
                    id: state.nextIds.event++,
                    date: toDateInputValue(date),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

            }

            sortEvents(state);
            saveState(state);
            res.json(state);

        }
    );

    app.post(
        "/api/karaoke-revolution/admin/partners",
        requireAdmin,
        (req, res) => {

            state.partners.unshift(
                normalizePartner(req.body, state.nextIds.partner++)
            );

            sortPartners(state);
            saveState(state);
            res.json(state);

        }
    );

    app.put(
        "/api/karaoke-revolution/admin/partners/:id",
        requireAdmin,
        (req, res) => {

            const partner =
                findById(state.partners, req.params.id);

            if (!partner) {
                return res.status(404).json({
                    error: "Locale non trovato"
                });
            }

            Object.assign(
                partner,
                normalizePartner(req.body, partner.id, partner),
                {
                    updatedAt: new Date().toISOString()
                }
            );

            sortPartners(state);
            saveState(state);
            res.json(state);

        }
    );

    app.delete(
        "/api/karaoke-revolution/admin/partners/:id",
        requireAdmin,
        (req, res) => {

            state.partners =
                state.partners.filter(partner =>
                    partner.id !== Number(req.params.id)
                );

            saveState(state);
            res.json(state);

        }
    );

}

function requireAdmin(req, res, next) {

    const header =
        String(req.headers.authorization || "");

    const token =
        header.startsWith("Bearer ") ? header.slice(7) : "";

    const expiresAt =
        sessions.get(token);

    if (!expiresAt || expiresAt < Date.now()) {
        sessions.delete(token);
        return res.status(401).json({
            error: "Accesso richiesto"
        });
    }

    next();

}

function ensureDataFolder() {
    fs.mkdirSync(DATA_FOLDER, {
        recursive: true
    });
}

function loadState() {

    ensureDataFolder();

    if (!fs.existsSync(DATA_FILE)) {
        return normalizeState(DEFAULT_STATE);
    }

    try {
        return normalizeState(
            JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
        );
    } catch (err) {
        return normalizeState(DEFAULT_STATE);
    }

}

function saveState(state) {

    ensureDataFolder();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(state, null, 2)
    );

}

function normalizeState(value) {

    const state = {
        settings: {
            ...DEFAULT_STATE.settings,
            ...(safeObject(value).settings || {})
        },
        events:
            Array.isArray(safeObject(value).events) ?
                safeObject(value).events.map((event, index) =>
                    normalizeEvent(event, Number(event.id) || index + 1)
                ) :
                DEFAULT_STATE.events,
        partners:
            Array.isArray(safeObject(value).partners) ?
                safeObject(value).partners.map((partner, index) =>
                    normalizePartner(partner, Number(partner.id) || index + 1)
                ) :
                DEFAULT_STATE.partners,
        nextIds: {
            event: 1,
            partner: 1,
            ...(safeObject(value).nextIds || {})
        }
    };

    const maxEventId =
        Math.max(0, ...state.events.map(event => event.id));

    const maxPartnerId =
        Math.max(0, ...state.partners.map(partner => partner.id));

    state.nextIds.event =
        Math.max(Number(state.nextIds.event) || 1, maxEventId + 1);

    state.nextIds.partner =
        Math.max(Number(state.nextIds.partner) || 1, maxPartnerId + 1);

    sortEvents(state);
    sortPartners(state);

    return state;

}

function publicState(state) {

    return {
        settings: state.settings,
        events: state.events.filter(event => event.visible),
        partners: state.partners.filter(partner => partner.visible)
    };

}

function normalizeEvent(value, id, previous = {}) {

    const body =
        safeObject(value);

    const now =
        new Date().toISOString();

    return {
        id: Number(id),
        date: cleanDate(body.date, previous.date || toDateInputValue(new Date())),
        time: cleanTime(body.time, previous.time || "21:30"),
        venue: cleanText(body.venue, previous.venue || "", 90),
        city: cleanText(body.city, previous.city || "", 70),
        address: cleanText(body.address, previous.address || "", 180),
        mapsUrl: cleanUrl(body.mapsUrl, previous.mapsUrl || ""),
        description:
            cleanText(body.description, previous.description || "", 260),
        imageUrl: cleanUrl(body.imageUrl, previous.imageUrl || ""),
        visible:
            typeof body.visible === "boolean" ?
                body.visible :
                previous.visible !== false,
        createdAt: previous.createdAt || now,
        updatedAt: now
    };

}

function normalizePartner(value, id, previous = {}) {

    const body =
        safeObject(value);

    const now =
        new Date().toISOString();

    return {
        id: Number(id),
        name: cleanText(body.name, previous.name || "", 90),
        city: cleanText(body.city, previous.city || "", 70),
        recurringDay:
            cleanText(body.recurringDay, previous.recurringDay || "", 60),
        mapsUrl: cleanUrl(body.mapsUrl, previous.mapsUrl || ""),
        visible:
            typeof body.visible === "boolean" ?
                body.visible :
                previous.visible !== false,
        createdAt: previous.createdAt || now,
        updatedAt: now
    };

}

function sortEvents(state) {
    state.events.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    );
}

function sortPartners(state) {
    state.partners.sort((a, b) =>
        `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`)
    );
}

function safeObject(value) {
    return value && typeof value === "object" ? value : {};
}

function cleanText(value, fallback = "", maxLength = 160) {

    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim().slice(0, maxLength);

}

function cleanDate(value, fallback) {

    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return value;
    }

    return fallback;

}

function cleanTime(value, fallback) {

    if (
        typeof value === "string" &&
        /^\d{2}:\d{2}$/.test(value)
    ) {
        return value;
    }

    return fallback;

}

function cleanUrl(value, fallback = "") {

    if (typeof value !== "string") {
        return fallback;
    }

    const trimmed =
        value.trim().slice(0, 500);

    if (
        trimmed === "" ||
        trimmed.startsWith("/") ||
        /^https?:\/\//i.test(trimmed) ||
        /^mailto:/i.test(trimmed)
    ) {
        return trimmed;
    }

    return fallback;

}

function cleanEmail(value, fallback = "") {

    const text =
        cleanText(value, fallback, 120);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : fallback;

}

function clampInteger(value, min, max, fallback) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(number)));

}

function findById(items, id) {
    return items.find(item => item.id === Number(id)) || null;
}

function parseDate(value) {

    const date =
        new Date(`${value}T12:00:00`);

    return Number.isNaN(date.getTime()) ? null : date;

}

function toDateInputValue(date) {
    return date.toISOString().slice(0, 10);
}

module.exports = {
    installKaraokeRevolution
};
