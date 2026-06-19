const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");
const musicMetadata = require("music-metadata");
const QRCode = require("qrcode");
const {
    MUSIC_FOLDER,
    resolveLibraryFile
} = require("../shared/paths");
const {
    loadPublicScreenSettings,
    savePublicScreenSettings
} = require("../shared/settings");
const {
    installFantasposi
} = require("./fantasposi");
const {
    installKaraokeRevolution
} = require("./karaoke-revolution");
const PUBLIC_FOLDER = path.join(
    __dirname,
    "../public"
);
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const publicScreenSettings =
    loadPublicScreenSettings();

if (!fs.existsSync(MUSIC_FOLDER)) {

    fs.mkdirSync(
        MUSIC_FOLDER,
        { recursive: true }
    );

}
const playerState = {
    currentSong: "",
    isPlaying: false,
    volume: 1,
    queue: [],
    playlist: [],
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    lyricsOffset: 0,
    ...publicScreenSettings
};

app.use(express.json({ limit: "2mb" }));
app.use(
    express.static(
        PUBLIC_FOLDER,
        {
            setHeaders: (res, filePath) => {
                if(
                    filePath.endsWith(".html") ||
                    filePath.endsWith(".js") ||
                    filePath.endsWith(".css")
                ){
                    res.setHeader(
                        "Cache-Control",
                        "no-store, no-cache, must-revalidate, proxy-revalidate"
                    );
                }
            }
        }
    )
);
app.use("/music", express.static(MUSIC_FOLDER));

installFantasposi(app, io);
installKaraokeRevolution(app);

app.get("/api/songs", (req, res) => {

    fs.readdir(
        MUSIC_FOLDER,
        { withFileTypes: true },
        (err, files) => {

        if (err) {
            return res.status(500).json([]);
        }

        const songs = files
            .filter(file =>
                file.isFile() &&
                !file.name.startsWith(".") &&
                !file.name.toLowerCase().endsWith(".cdg") &&
                !file.name.endsWith(".source.json") &&
                !file.name.endsWith(".karaoke.json")
            )
            .map(file => file.name);

        res.json(songs);

    });

});

app.get("/api/status", (req, res) => {

    res.json(playerState);

});

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

app.get("/api/remote-info", async (req, res) => {

    const remoteUrl =
        `http://${getLocalAddress()}:3000/remote.html`;

    try {

        const qr =
            await QRCode.toDataURL(
                remoteUrl,
                {
                    margin: 1,
                    width: 140
                }
            );

        res.json({
            url: remoteUrl,
            qr
        });

    } catch (err) {

        res.json({
            url: remoteUrl,
            qr: ""
        });

    }

});

function normalisePlaylist(songs) {

    if (!Array.isArray(songs)) {
        return [];
    }

    return songs
        .filter(song =>
            typeof song === "string" &&
            song.trim() !== ""
        )
        .map(song => path.basename(song));

}

function decodeSyncedLyricsText(encoding, data) {

    if (!data || data.length === 0) {
        return "";
    }

    if (encoding === 1) {

        if (data[0] === 0xff && data[1] === 0xfe) {
            return data.slice(2).toString("utf16le");
        }

        if (data[0] === 0xfe && data[1] === 0xff) {

            const swapped =
                Buffer.alloc(data.length - 2);

            for (
                let i = 2;
                i + 1 < data.length;
                i += 2
            ) {
                swapped[i - 2] = data[i + 1];
                swapped[i - 1] = data[i];
            }

            return swapped.toString("utf16le");

        }

        return data.toString("utf16le");

    }

    if (encoding === 2) {
        return data.toString("utf16le");
    }

    if (encoding === 3) {
        return cleanLyricsText(data.toString("utf8"));
    }

    return decodeLegacyLyricsText(data);

}

function countTextEncodingIssues(text) {

    const value =
        String(text || "");

    return (
        (value.match(/\uFFFD/g) || []).length * 3 +
        (value.match(/[ÃÂ]/g) || []).length +
        (value.match(/[\u0080-\u009F]/g) || []).length
    );

}

function cleanLyricsText(text) {

    const value =
        String(text || "");

    if (!value) {
        return "";
    }

    const repaired =
        Buffer
        .from(value, "latin1")
        .toString("utf8");

    if (
        repaired &&
        countTextEncodingIssues(repaired) <
        countTextEncodingIssues(value)
    ) {
        return repaired.normalize("NFC");
    }

    return value.normalize("NFC");

}

function decodeLegacyLyricsText(data) {

    const latinText =
        data.toString("latin1");

    const utf8Text =
        data.toString("utf8");

    if (
        utf8Text &&
        countTextEncodingIssues(utf8Text) <
        countTextEncodingIssues(latinText)
    ) {
        return cleanLyricsText(utf8Text);
    }

    return cleanLyricsText(latinText);

}

function normaliseSyncText(syncText) {

    const lines = [];
    let currentLine = null;

    function pushCurrentLine() {

        if (
            currentLine &&
            currentLine.text.trim() !== ""
        ) {
            const repairedLine =
                repairCompactSyncLine(currentLine);

            lines.push({
                time: currentLine.time,
                text: repairedLine.text.trim(),
                words: repairedLine.words
            });
        }

    }

    syncText.forEach(entry => {

        if (
            !entry ||
            typeof entry.text !== "string" ||
            typeof entry.timestamp !== "number"
        ) {
            return;
        }

        const parts =
            entry.text.split("\n");

        parts.forEach((part, index) => {

            const startsNewLine =
                index > 0 ||
                entry.text.startsWith("\n") ||
                !currentLine;

            if (startsNewLine) {

                pushCurrentLine();

                currentLine = {
                    time: entry.timestamp,
                    text: "",
                    words: []
                };

            }

            if (part) {

                const cleanPart =
                    cleanLyricsText(part);

                currentLine.text += cleanPart;

                currentLine.words.push({
                    time: entry.timestamp,
                    text: cleanPart
                });

            }

        });

    });

    if (
        currentLine
    ) {
        pushCurrentLine();
    }

    return lines;

}

function isLyricWordPart(text) {

    return /[\p{L}\p{N}]/u.test(
        String(text || "")
    );

}

function shouldInferSpaceBetweenParts(previous, current) {

    const previousText =
        String(previous && previous.text || "").trim();

    const currentText =
        String(current && current.text || "").trim();

    if (
        !previousText ||
        !currentText ||
        !isLyricWordPart(previousText) ||
        !isLyricWordPart(currentText) ||
        /^[,.;:!?')\]-]/.test(currentText) ||
        /[(\['-]$/.test(previousText)
    ) {
        return false;
    }

    const gap =
        Number(current && current.time) -
        Number(previous && previous.time);

    if (!Number.isFinite(gap)) {
        return false;
    }

    if (gap >= 260) {
        return true;
    }

    return (
        gap >= 180 &&
        previousText.length >= 3 &&
        currentText.length >= 3
    );

}

function repairCompactSyncLine(line) {

    if (
        !line ||
        /\s/.test(line.text || "") ||
        !Array.isArray(line.words) ||
        line.words.length < 3
    ) {
        return line;
    }

    let inferredSpaces = 0;

    const text =
        line.words
        .map((word, index) => {

            const cleanText =
                String(word && word.text || "").trim();

            if (index === 0) {
                return cleanText;
            }

            const shouldAddSpace =
                shouldInferSpaceBetweenParts(
                    line.words[index - 1],
                    word
                );

            if (shouldAddSpace) {
                inferredSpaces += 1;
                return " " + cleanText;
            }

            return cleanText;

        })
        .join("");

    if (inferredSpaces === 0) {
        return line;
    }

    return {
        ...line,
        text
    };

}

function parseSyncedLyricsFrame(data) {

    const encoding =
        data[0];

    const headerShift =
        data[1] === 0 &&
        /[A-Z]/.test(
            String.fromCharCode(data[2])
        )
        ? 1
        : 0;

    let position =
        6 + headerShift;

    let descriptorEnd = -1;

    if (encoding === 0 || encoding === 3) {

        descriptorEnd =
            data.indexOf(0, position);

        position =
            descriptorEnd >= 0
            ? descriptorEnd + 1
            : position;

    } else {

        for (
            let i = position;
            i + 1 < data.length;
            i += 2
        ) {
            if (data[i] === 0 && data[i + 1] === 0) {
                descriptorEnd = i;
                position = i + 2;
                break;
            }
        }

    }

    const syncText = [];

    while (position < data.length - 4) {

        let textEnd = -1;

        if (encoding === 0 || encoding === 3) {

            textEnd =
                data.indexOf(0, position);

            if (
                textEnd < 0 ||
                textEnd + 5 > data.length
            ) {
                break;
            }

        } else {

            for (
                let i = position;
                i + 1 < data.length;
                i += 2
            ) {
                if (data[i] === 0 && data[i + 1] === 0) {
                    textEnd = i;
                    break;
                }
            }

            if (
                textEnd < 0 ||
                textEnd + 6 > data.length
            ) {
                break;
            }

        }

        const text =
            decodeSyncedLyricsText(
                encoding,
                data.slice(position, textEnd)
            );

        position =
            textEnd +
            (
                encoding === 0 ||
                encoding === 3
                ? 1
                : 2
            );

        const timestamp =
            data.readUInt32BE(position);

        position += 4;

        syncText.push({
            text,
            timestamp
        });

    }

    return syncText;

}

function readSyncTextFromId3(filePath) {

    const buffer =
        fs.readFileSync(filePath);

    if (
        buffer.slice(0, 3)
        .toString("latin1") !== "ID3"
    ) {
        return [];
    }

    const tagSize =
        (
            buffer[6] << 21
        ) |
        (
            buffer[7] << 14
        ) |
        (
            buffer[8] << 7
        ) |
        buffer[9];

    let offset = 10;

    while (offset + 10 <= 10 + tagSize) {

        const frameId =
            buffer
            .slice(offset, offset + 4)
            .toString("latin1");

        const frameSize =
            buffer.readUInt32BE(offset + 4);

        if (
            !/^[A-Z0-9]{4}$/.test(frameId) ||
            frameSize <= 0
        ) {
            break;
        }

        if (frameId === "SYLT") {

            return parseSyncedLyricsFrame(
                buffer.slice(
                    offset + 10,
                    offset + 10 + frameSize
                )
            );

        }

        offset += 10 + frameSize;

    }

    return [];

}

function getKaraokeProjectPath(filePath) {

    return filePath + ".karaoke.json";

}

function getSongSourcePath(filePath) {

    return filePath + ".source.json";

}

function readSongSource(filePath) {

    const sourcePath =
        getSongSourcePath(filePath);

    if (!fs.existsSync(sourcePath)) {
        return null;
    }

    try {

        const data =
            JSON.parse(
                fs.readFileSync(sourcePath, "utf8")
            );

        return data && typeof data === "object"
            ? data
            : null;

    } catch (err) {
        return null;
    }

}

function findAssociatedCdgForSong(filePath) {

    const source =
        readSongSource(filePath);

    const candidates = [];

    if (
        source &&
        typeof source.originalPath === "string" &&
        path.isAbsolute(source.originalPath)
    ) {

        const originalExtension =
            path.extname(source.originalPath);

        const originalBase =
            source.originalPath.slice(
                0,
                source.originalPath.length - originalExtension.length
            );

        candidates.push(
            originalBase + ".cdg",
            originalBase + ".CDG"
        );

    }

    const libraryExtension =
        path.extname(filePath);

    const libraryBase =
        filePath.slice(
            0,
            filePath.length - libraryExtension.length
        );

    candidates.push(
        libraryBase + ".cdg",
        libraryBase + ".CDG"
    );

    return candidates.find(candidate =>
        typeof candidate === "string" &&
        path.isAbsolute(candidate) &&
        path.extname(candidate).toLowerCase() === ".cdg" &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
    ) || null;

}

function toTimestamp(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? Math.round(number)
        : null;

}

function normaliseProjectLine(line) {

    const text =
        cleanLyricsText(line && line.text || "");

    const rawWords =
        Array.isArray(line && line.words)
        ? line.words
        : [];

    const words =
        rawWords
        .map(word => ({
            text: cleanLyricsText(word && word.text || ""),
            time: toTimestamp(word && word.time)
        }))
        .filter(word => word.text.length > 0);

    const lineTime =
        toTimestamp(line && line.time);

    return {
        text,
        time: lineTime,
        words
    };

}

function normaliseKaraokeProject(data, song) {

    const lines =
        Array.isArray(data && data.lines)
        ? data.lines.map(normaliseProjectLine)
        : [];

    return {
        version: 1,
        song,
        updatedAt: new Date().toISOString(),
        startOffset:
            toTimestamp(data && data.startOffset) !== null
            ? Math.max(0, toTimestamp(data.startOffset))
            : 0,
        lines
    };

}

function projectToLyrics(project) {

    return (project.lines || [])
        .map(line => {

            const timedWords =
                (line.words || [])
                .map(word => ({
                    text: word.text,
                    time: toTimestamp(word.time)
                }));

            const wordTimes =
                timedWords
                .map(word => word.time)
                .filter(time => Number.isFinite(time));

            const lineTime =
                toTimestamp(line.time) !== null
                ? toTimestamp(line.time)
                : (
                    wordTimes.length > 0
                    ? Math.min(...wordTimes)
                    : null
                );

            if (!Number.isFinite(lineTime)) {
                return null;
            }

            const words =
                timedWords.length > 0
                ? timedWords.map(word => ({
                    text: word.text,
                    time: Number.isFinite(word.time)
                        ? word.time
                        : lineTime
                }))
                : [{ text: line.text, time: lineTime }];

            return {
                time: lineTime,
                text: line.text,
                words
            };

        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

}

function readKaraokeProject(filePath, song) {

    const projectPath =
        getKaraokeProjectPath(filePath);

    if (!fs.existsSync(projectPath)) {
        return null;
    }

    const data =
        JSON.parse(
            fs.readFileSync(projectPath, "utf8")
        );

    return normaliseKaraokeProject(data, song);

}

function safeExportName(name) {

    return String(name || "karaoke")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "karaoke";

}

function formatLrcTime(milliseconds) {

    const total =
        Math.max(0, Number(milliseconds) || 0);

    const minutes =
        Math.floor(total / 60000);

    const seconds =
        Math.floor((total % 60000) / 1000);

    const centiseconds =
        Math.floor((total % 1000) / 10);

    return (
        "[" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(centiseconds).padStart(2, "0") +
        "]"
    );

}

function projectToLrc(project) {

    return (project.lines || [])
        .map(line => {

            const wordTimes =
                (line.words || [])
                .map(word => toTimestamp(word.time))
                .filter(time => time !== null);

            const lineTime =
                toTimestamp(line.time) !== null
                ? toTimestamp(line.time)
                : (
                    wordTimes.length > 0
                    ? Math.min(...wordTimes)
                    : null
                );

            if (lineTime === null) {
                return null;
            }

            return (
                formatLrcTime(lineTime) +
                (line.text || "")
            );

        })
        .filter(Boolean)
        .join("\n") + "\n";

}

function projectToPlainText(project) {

    return (project.lines || [])
        .map(line => line.text || "")
        .join("\n") + "\n";

}

async function extractLyrics(filePath) {

    try {

        const metadata =
            await musicMetadata.parseFile(
                filePath,
                { duration: true }
            );

        const syncedLyrics =
            (metadata.common.lyrics || [])
            .find(lyrics =>
                Array.isArray(lyrics.syncText)
            );

        if (syncedLyrics) {
            return normaliseSyncText(
                syncedLyrics.syncText
            );
        }

    } catch (err) {
        console.log(
            "Metadata lyrics fallback:",
            err.message
        );
    }

    const id3Lines =
        normaliseSyncText(
            readSyncTextFromId3(filePath)
        );

    if (id3Lines.length > 0) {
        return id3Lines;
    }

    return [];

}

app.get("/api/karaoke-project", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        try {

            const project =
                readKaraokeProject(filePath, song);

            res.json({
                song,
                hasProject: !!project,
                project: project || {
                    version: 1,
                    song,
                    updatedAt: null,
                    startOffset: 0,
                    lines: []
                }
            });

        } catch (err) {

            res
                .status(500)
                .json({ error: "Progetto non leggibile" });

        }

    });

});

app.put("/api/karaoke-project", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        try {

            const project =
                normaliseKaraokeProject(req.body || {}, song);

            fs.writeFileSync(
                getKaraokeProjectPath(filePath),
                JSON.stringify(project, null, 2),
                "utf8"
            );

            io.emit("lyricsChanged", song);
            broadcastStatus();

            res.json({
                song,
                saved: true,
                project
            });

        } catch (err) {

            res
                .status(500)
                .json({ error: "Progetto non salvabile" });

        }

    });

});

app.post("/api/karaoke-export", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        try {

            const project =
                readKaraokeProject(filePath, song);

            if (!project) {
                return res
                    .status(404)
                    .json({ error: "Nessun progetto karaoke salvato" });
            }

            const desktopFolder =
                path.join(
                    os.homedir(),
                    "Desktop",
                    "Giorgio Karaoke Export"
                );

            const baseName =
                safeExportName(
                    path.basename(
                        song,
                        path.extname(song)
                    )
                );

            const exportFolder =
                path.join(
                    desktopFolder,
                    baseName
                );

            fs.mkdirSync(
                exportFolder,
                { recursive: true }
            );

            const mp3Name =
                safeExportName(song);

            fs.copyFileSync(
                filePath,
                path.join(exportFolder, mp3Name)
            );

            fs.writeFileSync(
                path.join(exportFolder, baseName + ".karaoke.json"),
                JSON.stringify(project, null, 2),
                "utf8"
            );

            fs.writeFileSync(
                path.join(exportFolder, baseName + ".lrc"),
                projectToLrc(project),
                "utf8"
            );

            fs.writeFileSync(
                path.join(exportFolder, baseName + ".txt"),
                projectToPlainText(project),
                "utf8"
            );

            execFile(
                "open",
                [exportFolder],
                (openErr) => {
                    if (openErr) {
                        console.log(
                            "Export folder open failed:",
                            openErr.message
                        );
                    }
                }
            );

            res.json({
                exported: true,
                folder: exportFolder
            });

        } catch (err) {

            res
                .status(500)
                .json({ error: "Esportazione non riuscita" });

        }

    });

});

app.get("/api/lyrics", async (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, async (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        try {

            const project =
                readKaraokeProject(filePath, song);

            if (project) {

                const lines =
                    projectToLyrics(project);

                return res.json({
                    song,
                    source: "project",
                    startOffset: project.startOffset || 0,
                    hasLyrics: lines.length > 0,
                    lines
                });

            }

            const lines =
                await extractLyrics(filePath);

            res.json({
                song,
                source: "mp3",
                startOffset: 0,
                hasLyrics: lines.length > 0,
                lines
            });

        } catch (err) {

            res
                .status(500)
                .json({ error: "Testo non leggibile" });

        }

    });

});

app.get("/api/cdg-info", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        const cdgPath =
            findAssociatedCdgForSong(filePath);

        res.json({
            song,
            hasCdg: !!cdgPath
        });

    });

});

app.get("/api/cdg", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        const cdgPath =
            findAssociatedCdgForSong(filePath);

        if (!cdgPath) {
            return res
                .status(404)
                .json({ error: "CDG non trovato" });
        }

        res.sendFile(cdgPath);

    });

});

app.delete("/api/songs", (req, res) => {

    const song =
        req.query.name;

    const filePath =
        resolveLibraryFile(song);

    if (!filePath) {
        return res
            .status(400)
            .json({ error: "Nome file non valido" });
    }

    fs.stat(filePath, (statErr, stat) => {

        if (statErr || !stat.isFile()) {
            return res
                .status(404)
                .json({ error: "File non trovato" });
        }

        fs.unlink(filePath, (deleteErr) => {

            if (deleteErr) {
                return res
                    .status(500)
                    .json({ error: "Eliminazione non riuscita" });
            }

            const projectPath =
                getKaraokeProjectPath(filePath);

            if (fs.existsSync(projectPath)) {
                try {
                    fs.unlinkSync(projectPath);
                } catch (err) {
                    console.log(
                        "Karaoke project delete failed:",
                        err.message
                    );
                }
            }

            const sourcePath =
                getSongSourcePath(filePath);

            if (fs.existsSync(sourcePath)) {
                try {
                    fs.unlinkSync(sourcePath);
                } catch (err) {
                    console.log(
                        "Song source delete failed:",
                        err.message
                    );
                }
            }

            playerState.queue =
                playerState.queue.filter(
                    queuedSong => queuedSong !== song
                );

            playerState.playlist =
                playerState.playlist.filter(
                    playlistSong => playlistSong !== song
                );

            if (playerState.currentSong === song) {

                playerState.currentSong = "";
                playerState.isPlaying = false;
                playerState.currentTime = 0;
                playerState.duration = 0;

                io.emit("stopSong");

            }

            io.emit("libraryChanged");

            broadcastStatus();

            res.json({ deleted: song });

        });

    });

});

function broadcastStatus() {

    io.emit("status", playerState);

}

function savePublicScreenState() {

    savePublicScreenSettings({
        karaokeHighlightColor: playerState.karaokeHighlightColor,
        karaokeShowNextLine: playerState.karaokeShowNextLine,
        karaokeFontFamily: playerState.karaokeFontFamily
    });

}

function getNextPlaylistSong() {

    if (!Array.isArray(playerState.playlist)) {
        return "";
    }

    const currentIndex =
        playerState.playlist.indexOf(
            playerState.currentSong
        );

    if (
        currentIndex >= 0 &&
        currentIndex + 1 < playerState.playlist.length
    ) {
        return playerState.playlist[currentIndex + 1];
    }

    if (
        !playerState.currentSong &&
        playerState.playlist.length > 0
    ) {
        return playerState.playlist[0];
    }

    return "";

}

io.on("connection", (socket) => {

    console.log("Client connesso");

    socket.emit("status", playerState);

    socket.on("play", (song) => {

        playerState.currentSong = song;
        playerState.isPlaying = true;
        playerState.currentTime = 0;
        playerState.duration = 0;

        console.log("PLAY:", song);

        io.emit("playSong", song);

        broadcastStatus();

    });

    socket.on("crossfadeToNext", () => {

        const song =
            getNextPlaylistSong();

        if (!song) {
            return;
        }

        playerState.currentSong = song;
        playerState.isPlaying = true;
        playerState.currentTime = 0;
        playerState.duration = 0;
        playerState.lyricsOffset = 0;

        io.emit(
            "crossfadeToSong",
            { song, duration: 4000 }
        );

        broadcastStatus();

    });

    socket.on("addToQueue", (song) => {

        playerState.queue.push(song);

        console.log("QUEUE +", song);

        broadcastStatus();

    });

    socket.on("setPlaylist", (songs) => {

        playerState.playlist =
            normalisePlaylist(songs);

        io.emit("libraryChanged");

        broadcastStatus();

    });

    socket.on("movePlaylistItem", (data) => {

        if (!data) {
            return;
        }

        const from =
            Number(data.from);

        const to =
            Number(data.to);

        if (
            !Number.isInteger(from) ||
            !Number.isInteger(to) ||
            from < 0 ||
            to < 0 ||
            from >= playerState.playlist.length ||
            to >= playerState.playlist.length
        ) {
            return;
        }

        const item =
            playerState.playlist.splice(
                from,
                1
            )[0];

        playerState.playlist.splice(
            to,
            0,
            item
        );

        broadcastStatus();

    });

    socket.on("removeFromPlaylist", (index) => {

        if (
            index >= 0 &&
            index < playerState.playlist.length
        ) {

            const removedSong =
                playerState.playlist[index];

            playerState.playlist.splice(
                index,
                1
            );

            broadcastStatus();

        }

    });

    socket.on("clearPlaylist", () => {

        playerState.playlist = [];

        broadcastStatus();

    });

    socket.on("playNextFromQueue", () => {

        if (playerState.queue.length === 0) {
            return;
        }

        const nextSong =
            playerState.queue.shift();

        playerState.currentSong =
            nextSong;

        playerState.isPlaying = true;
        playerState.currentTime = 0;
        playerState.duration = 0;

        console.log(
            "NEXT FROM QUEUE:",
            nextSong
        );

        io.emit(
            "playSong",
            nextSong
        );

        broadcastStatus();

    });

    socket.on("removeFromQueue", (index) => {

        if (
            index >= 0 &&
            index < playerState.queue.length
        ) {

            playerState.queue.splice(
                index,
                1
            );

            broadcastStatus();

        }

    });

    socket.on("clearQueue", () => {

        playerState.queue = [];

        console.log("QUEUE CLEARED");

        broadcastStatus();

    });

    socket.on("stop", () => {

        console.log("STOP");

        playerState.currentSong = "";
        playerState.isPlaying = false;
        playerState.currentTime = 0;
        playerState.duration = 0;
        playerState.lyricsOffset = 0;

        io.emit("stopSong");

        broadcastStatus();

    });

    socket.on("setVolume", (volume) => {

        playerState.volume = volume;

        console.log("VOLUME:", volume);

        io.emit(
            "volumeChanged",
            volume
        );

        broadcastStatus();

    });

    socket.on("setPlaybackRate", (rate) => {

        const nextRate =
            Number(rate);

        if (!Number.isFinite(nextRate)) {
            return;
        }

        playerState.playbackRate =
            Math.max(
                0.8,
                Math.min(
                    1.2,
                    Math.round(nextRate * 100) / 100
                )
            );

        broadcastStatus();

    });

    socket.on("setLyricsOffset", (offset) => {

        const nextOffset =
            Number(offset);

        if (!Number.isFinite(nextOffset)) {
            return;
        }

        playerState.lyricsOffset =
            Math.max(
                -5000,
                Math.min(
                    5000,
                    Math.round(nextOffset)
                )
            );

        broadcastStatus();

    });

    socket.on("setKaraokeHighlightColor", (color) => {

        if(
            typeof color !== "string" ||
            !/^#[0-9a-fA-F]{6}$/.test(color)
        ){
            return;
        }

        playerState.karaokeHighlightColor =
            color.toLowerCase();

        savePublicScreenState();
        broadcastStatus();

    });

    socket.on("setKaraokeShowNextLine", (showNextLine) => {

        playerState.karaokeShowNextLine =
            !!showNextLine;

        savePublicScreenState();
        broadcastStatus();

    });

    socket.on("setKaraokeFontFamily", (fontFamily) => {

        const allowedFonts = [
            "System",
            "Arial",
            "Verdana",
            "Georgia",
            "Courier New"
        ];

        if(!allowedFonts.includes(fontFamily)){
            return;
        }

        playerState.karaokeFontFamily =
            fontFamily;

        savePublicScreenState();
        broadcastStatus();

    });

    socket.on("playbackTime", (data) => {

        if (
            !data ||
            data.song !== playerState.currentSong
        ) {
            return;
        }

        playerState.currentTime =
            data.currentTime || 0;

        playerState.duration =
            data.duration || 0;

        if (Number.isFinite(Number(data.playbackRate))) {
            playerState.playbackRate =
                Math.max(
                    0.8,
                    Math.min(
                        1.2,
                        Math.round(Number(data.playbackRate) * 100) / 100
                    )
                );
        }

        if (typeof data.isPlaying === "boolean") {
            playerState.isPlaying =
                data.isPlaying;
        }

        io.emit(
            "playbackTime",
            {
                song: playerState.currentSong,
                currentTime: playerState.currentTime,
                duration: playerState.duration,
                playbackRate: playerState.playbackRate,
                isPlaying: playerState.isPlaying
            }
        );

    });

});

const PORT =
    Number(process.env.PORT) || 3000;

server.listen(PORT, () => {

    console.log(
        "Giorgio Remote Player avviato"
    );

    console.log(
        `http://localhost:${PORT}`
    );

});
