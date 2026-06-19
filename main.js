const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { fork } = require("child_process");
const {
    hasUsableWordSync,
    projectToLrc,
    projectToPlainText,
    safeExportName,
    writeKaraokeMp3,
    writeMliveKaraokeMp3
} = require("./main/exporters");
const {
    MUSIC_FOLDER
} = require("./shared/paths");

let serverProcess;
let karaokeWindow;
let previewWindow;
let editorWindow;

ipcMain.handle("select-mp3-files", async () => {

    const result = await dialog.showOpenDialog({

        title: "Importa audio/video",

        properties: [
            "openFile",
            "multiSelections"
        ],

        filters: [
            {
                name: "Audio e video",
                extensions: ["mp3", "mp4"]
            }
        ]

    });

    return result.filePaths;

});
ipcMain.handle(
    "import-mp3-files",
    async (event, files) => {

        const musicFolder =
        MUSIC_FOLDER;

        fs.mkdirSync(
            musicFolder,
            { recursive: true }
        );

        const imported = [];
        const failed = [];

        for(const file of files){

            if (
                typeof file !== "string" ||
                !isImportableMediaFile(file)
            ) {
                failed.push({
                    file,
                    error: "File non supportato"
                });
                continue;
            }

            try {

                const fileName =
                path.basename(file);

                const destination =
                path.join(
                    musicFolder,
                    fileName
                );

                fs.copyFileSync(
                    file,
                    destination
                );

                writeImportedSongSource(
                    file,
                    destination
                );

                imported.push(fileName);

            } catch (err) {

                failed.push({
                    file,
                    error: err.message
                });

            }

        }

        return {
            imported,
            failed
        };

    }
);

function isImportableMediaFile(file) {

    return (
        typeof file === "string" &&
        (
            file.toLowerCase().endsWith(".mp3") ||
            file.toLowerCase().endsWith(".mp4")
        )
    );

}

function findAssociatedCdgFile(sourceMp3) {

    const sourceBase =
        sourceMp3.slice(
            0,
            sourceMp3.length - path.extname(sourceMp3).length
        );

    const candidates = [
        sourceBase + ".cdg",
        sourceBase + ".CDG"
    ];

    return candidates.find(candidate =>
        fs.existsSync(candidate)
    ) || "";

}

function writeImportedSongSource(sourceMp3, destinationMp3) {

    const metadataPath =
        destinationMp3 + ".source.json";

    const data = {
        originalPath: sourceMp3,
        cdgPath: findAssociatedCdgFile(sourceMp3)
    };

    fs.writeFileSync(
        metadataPath,
        JSON.stringify(data, null, 2)
    );

}

ipcMain.handle(
    "export-karaoke-project",
    async (event, data) => {

        const song =
            data && data.song;

        const project =
            data && data.project;

        const format =
            data && data.format || "mp3-mlive";

        if(
            typeof song !== "string" ||
            !project
        ){
            return {
                canceled: false,
                error: "Dati export non validi"
            };
        }

        const musicFolder =
            MUSIC_FOLDER;

        const filePath =
            path.resolve(
                musicFolder,
                song
            );

        if(
            !filePath.startsWith(
                musicFolder + path.sep
            ) ||
            !fs.existsSync(filePath)
        ){
            return {
                canceled: false,
                error: "MP3 non trovato"
            };
        }

        const baseName =
            safeExportName(
                path.basename(
                    song,
                    path.extname(song)
                )
            );

        if (format === "folder") {

            const result =
                await dialog.showOpenDialog({
                    title: "Esporta cartella karaoke",
                    defaultPath: path.join(
                        os.homedir(),
                        "Desktop"
                    ),
                    properties: [
                        "openDirectory",
                        "createDirectory"
                    ]
                });

            if(
                result.canceled ||
                !result.filePaths ||
                result.filePaths.length === 0
            ){
                return { canceled: true };
            }

            const exportFolder =
                path.join(
                    result.filePaths[0],
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

            return {
                canceled: false,
                folder: exportFolder,
                message: "Cartella esportata: " + exportFolder
            };

        }

        const result =
            await dialog.showSaveDialog({
                title: "Esporta MP3 karaoke",
                defaultPath: path.join(
                    os.homedir(),
                    "Desktop",
                    (
                        format === "mp3-mlive"
                        ? baseName + " MidiCo"
                        :
                        format === "mp3-lrc"
                        ? baseName
                        : baseName + " karaoke"
                    ) + ".mp3"
                ),
                filters: [
                    {
                        name:
                            format === "mp3-mlive"
                            ? "MP3 MidiCo / M-Live"
                            :
                            format === "mp3-lrc"
                            ? "MP3 + LRC"
                            : "MP3 con testo karaoke",
                        extensions: ["mp3"]
                    }
                ]
            });

        if(
            result.canceled ||
            !result.filePath
        ){
            return { canceled: true };
        }

        const exportPath =
            result.filePath.toLowerCase().endsWith(".mp3")
            ? result.filePath
            : result.filePath + ".mp3";

        if (format === "mp3-lrc") {

            fs.copyFileSync(
                filePath,
                exportPath
            );

            const lrcPath =
                exportPath.replace(
                    /\.mp3$/i,
                    ".lrc"
                );

            fs.writeFileSync(
                lrcPath,
                projectToLrc(project),
                "utf8"
            );

            return {
                canceled: false,
                file: exportPath,
                lrc: lrcPath,
                message:
                    "MP3 + LRC esportati: " +
                    exportPath
            };

        }

        if (format === "mp3-mlive") {

            if (!hasUsableWordSync(project)) {
                return {
                    canceled: false,
                    error:
                        "Per l'export MidiCo / M-Live devi prima sincronizzare almeno alcune parole"
                };
            }

            writeMliveKaraokeMp3(
                filePath,
                exportPath,
                project,
                song
            );

            return {
                canceled: false,
                file: exportPath,
                message:
                    "MP3 MidiCo / M-Live esportato: " +
                    exportPath
            };

        }

        writeKaraokeMp3(
            filePath,
            exportPath,
            project,
            song
        );

        return {
            canceled: false,
            file: exportPath,
            message: "MP3 esportato: " + exportPath
        };

    }
);

ipcMain.handle("open-karaoke-screen", () => {

    if(
        karaokeWindow &&
        !karaokeWindow.isDestroyed()
    ){
        karaokeWindow.focus();
        return;
    }

    karaokeWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: "#05060c",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    karaokeWindow.loadURL(
        "http://localhost:3000/karaoke.html"
    );

    karaokeWindow.on("closed", () => {
        karaokeWindow = null;
    });

});

ipcMain.handle("open-karaoke-preview", () => {

    if(
        previewWindow &&
        !previewWindow.isDestroyed()
    ){
        previewWindow.focus();
        return;
    }

    previewWindow = new BrowserWindow({
        width: 960,
        height: 540,
        minWidth: 520,
        minHeight: 300,
        title: "Anteprima Live",
        backgroundColor: "#05060c",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    previewWindow.loadURL(
        "http://localhost:3000/karaoke.html?preview=1"
    );

    previewWindow.on("closed", () => {
        previewWindow = null;
    });

});

ipcMain.handle("open-karaoke-editor", () => {

    if(
        editorWindow &&
        !editorWindow.isDestroyed()
    ){
        editorWindow.focus();
        return;
    }

    editorWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        backgroundColor: "#101214",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    editorWindow.loadURL(
        "http://localhost:3000/editor.html"
    );

    editorWindow.on("closed", () => {
        editorWindow = null;
    });

});

function startServer() {

    const serverPath =
        app.isPackaged
        ? path.join(
            process.resourcesPath,
            "app.asar",
            "server",
            "server.js"
        )
        : path.join(
            __dirname,
            "server",
            "server.js"
        );

    serverProcess = fork(serverPath);

}

function createWindow() {

    const win = new BrowserWindow({
    width: 1400,
    height: 900,

    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
    }
});

    win.loadURL(
        "http://localhost:3000/player.html"
    );

}

app.whenReady().then(() => {

    startServer();

    setTimeout(() => {

        createWindow();

    }, 2000);

});

app.on("window-all-closed", () => {

    if (serverProcess) {
        serverProcess.kill();
    }

    app.quit();

});
