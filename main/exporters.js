const fs = require("fs");
const path = require("path");

function safeExportName(name) {

    return String(name || "karaoke")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "karaoke";

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

function hasUsableWordSync(project) {

    const times =
        [];

    for (const line of project.lines || []) {

        for (const word of line.words || []) {

            const time =
                toTimestamp(word.time);

            if (
                time !== null &&
                time > 0
            ) {
                times.push(time);
            }

        }

    }

    return new Set(times).size >= 2;

}

function encodeSyncSafeInteger(value) {

    const number =
        Math.max(0, Number(value) || 0);

    return Buffer.from([
        (number >> 21) & 0x7F,
        (number >> 14) & 0x7F,
        (number >> 7) & 0x7F,
        number & 0x7F
    ]);

}

function decodeSyncSafeInteger(buffer) {

    return (
        ((buffer[0] & 0x7F) << 21) |
        ((buffer[1] & 0x7F) << 14) |
        ((buffer[2] & 0x7F) << 7) |
        (buffer[3] & 0x7F)
    );

}

function encodeUtf16Text(text, includeBom = true) {

    const content =
        Buffer.from(String(text || ""), "utf16le");

    return includeBom
        ? Buffer.concat([
            Buffer.from([0xFF, 0xFE]),
            content
        ])
        : content;

}

function createTextFrame(id, text) {

    return createId3Frame(
        id,
        Buffer.concat([
            Buffer.from([0x01]),
            encodeUtf16Text(text)
        ])
    );

}

function createLatin1TextFrame(id, text) {

    return createId3Frame(
        id,
        Buffer.concat([
            Buffer.from([0x00]),
            Buffer.from(
                toLatin1Text(text),
                "latin1"
            )
        ])
    );

}

function createUserTextFrame(description, text) {

    return createId3Frame(
        "TXXX",
        Buffer.concat([
            Buffer.from([0x01]),
            encodeUtf16Text(description),
            Buffer.from([0x00, 0x00]),
            encodeUtf16Text(text)
        ])
    );

}

function createUnsyncedLyricsFrame(text) {

    return createId3Frame(
        "USLT",
        Buffer.concat([
            Buffer.from([0x01]),
            Buffer.from("ita", "ascii"),
            Buffer.from([0x00, 0x00]),
            encodeUtf16Text(text)
        ])
    );

}

function createSyncedLyricsFrame(project) {

    const chunks = [
        Buffer.from([0x01]),
        Buffer.from("ita", "ascii"),
        Buffer.from([0x02]),
        Buffer.from([0x01]),
        Buffer.from([0x00, 0x00])
    ];

    for (const line of project.lines || []) {

        for (const word of line.words || []) {

            const time =
                toTimestamp(word.time);

            const text =
                String(word.text || "").trim();

            if (
                time === null ||
                !text
            ) {
                continue;
            }

            const timestamp =
                Buffer.alloc(4);

            timestamp.writeUInt32BE(
                Math.max(0, time),
                0
            );

            chunks.push(
                encodeUtf16Text(text, false),
                Buffer.from([0x00, 0x00]),
                timestamp
            );

        }

    }

    if (chunks.length === 5) {
        return null;
    }

    return createId3Frame(
        "SYLT",
        Buffer.concat(chunks)
    );

}

function toLatin1Text(value) {

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x00-\xFF]/g, "'");

}

function createMliveSyncedLyricsFrame(project, song) {

    const chunks = [
        Buffer.from([0x00, 0x00]),
        Buffer.from("XXX", "latin1"),
        Buffer.from([0x02, 0x01]),
        Buffer.from("Sincro by M-live", "latin1"),
        Buffer.from([0x00])
    ];

    const baseName =
        path.basename(
            song,
            path.extname(song)
        );

    const titleEntry =
        Buffer.from(
            "\"" + toLatin1Text(baseName).toUpperCase() + "\"",
            "latin1"
        );

    chunks.push(
        titleEntry,
        Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00])
    );

    for (const line of project.lines || []) {

        let isFirstWord =
            true;

        for (const word of line.words || []) {

            const time =
                toTimestamp(word.time);

            const text =
                toLatin1Text(word.text).trim();

            if (
                time === null ||
                !text
            ) {
                continue;
            }

            const timestamp =
                Buffer.alloc(4);

            timestamp.writeUInt32BE(
                Math.max(0, time),
                0
            );

            const prefix =
                isFirstWord
                ? "\n"
                : " ";

            chunks.push(
                Buffer.from(prefix + text, "latin1"),
                Buffer.from([0x00]),
                timestamp
            );

            isFirstWord =
                false;

        }

    }

    return createId3Frame(
        "SYLT",
        Buffer.concat(chunks)
    );

}

function createId3Frame(id, payload) {

    const header =
        Buffer.alloc(10);

    header.write(id, 0, 4, "ascii");
    header.writeUInt32BE(payload.length, 4);

    return Buffer.concat([
        header,
        payload
    ]);

}

function stripId3v2Tag(buffer) {

    if (
        buffer.length < 10 ||
        buffer.toString("latin1", 0, 3) !== "ID3"
    ) {
        return buffer;
    }

    const size =
        decodeSyncSafeInteger(
            buffer.subarray(6, 10)
        );

    const hasFooter =
        !!(buffer[5] & 0x10);

    const totalSize =
        10 + size + (hasFooter ? 10 : 0);

    return buffer.subarray(
        Math.min(totalSize, buffer.length)
    );

}

function createKaraokeId3Tag(project, song) {

    const baseName =
        path.basename(
            song,
            path.extname(song)
        );

    const frames = [
        createTextFrame("TIT2", baseName),
        createUnsyncedLyricsFrame(
            projectToPlainText(project)
        ),
        createUserTextFrame(
            "Giorgio Karaoke LRC",
            projectToLrc(project)
        ),
        createUserTextFrame(
            "Giorgio Karaoke Project",
            JSON.stringify(project)
        )
    ];

    const syncedFrame =
        createSyncedLyricsFrame(project);

    if (syncedFrame) {
        frames.push(syncedFrame);
    }

    const body =
        Buffer.concat(frames);

    const header =
        Buffer.alloc(10);

    header.write("ID3", 0, 3, "ascii");
    header[3] = 0x03;
    header[4] = 0x00;
    header[5] = 0x00;
    encodeSyncSafeInteger(body.length)
        .copy(header, 6);

    return Buffer.concat([
        header,
        body
    ]);

}

function createMliveKaraokeId3Tag(project, song) {

    const baseName =
        path.basename(
            song,
            path.extname(song)
        );

    const frames = [
        createLatin1TextFrame(
            "TIT2",
            baseName.toUpperCase()
        ),
        createLatin1TextFrame(
            "TPE1",
            "GIORGIO REMOTE PLAYER"
        ),
        createLatin1TextFrame(
            "TPUB",
            "M-LIVE"
        ),
        createLatin1TextFrame(
            "TALB",
            "M-Live MP3 library"
        ),
        createLatin1TextFrame(
            "TCOP",
            "(C) Export Giorgio Remote Player"
        ),
        createMliveSyncedLyricsFrame(project, song)
    ];

    const body =
        Buffer.concat(frames);

    const header =
        Buffer.alloc(10);

    header.write("ID3", 0, 3, "ascii");
    header[3] = 0x03;
    header[4] = 0x00;
    header[5] = 0x00;
    encodeSyncSafeInteger(body.length)
        .copy(header, 6);

    return Buffer.concat([
        header,
        body
    ]);

}

function writeKaraokeMp3(sourcePath, destinationPath, project, song) {

    const source =
        fs.readFileSync(sourcePath);

    const audioData =
        stripId3v2Tag(source);

    const tag =
        createKaraokeId3Tag(project, song);

    fs.writeFileSync(
        destinationPath,
        Buffer.concat([
            tag,
            audioData
        ])
    );

}

function writeMliveKaraokeMp3(sourcePath, destinationPath, project, song) {

    const source =
        fs.readFileSync(sourcePath);

    const audioData =
        stripId3v2Tag(source);

    const tag =
        createMliveKaraokeId3Tag(project, song);

    fs.writeFileSync(
        destinationPath,
        Buffer.concat([
            tag,
            audioData
        ])
    );

}

module.exports = {
    hasUsableWordSync,
    projectToLrc,
    projectToPlainText,
    safeExportName,
    writeKaraokeMp3,
    writeMliveKaraokeMp3
};
