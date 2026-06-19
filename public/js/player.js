const socket = io();
let ipcRenderer = null;
let webUtils = null;

try {

    const electron =
        require("electron");

    ipcRenderer =
        electron.ipcRenderer;

    webUtils =
        electron.webUtils;

} catch(err) {

    console.log(
        "Electron API non disponibile"
    );

}
const audio =
document.getElementById("audio");
const nextAudio =
document.getElementById("nextAudio");
const currentSong =
document.getElementById("currentSong");
const nextSong =
document.getElementById("nextSong");

const progress =
document.getElementById("progress");

const currentTime =
document.getElementById("currentTime");

const totalTime =
document.getElementById("totalTime");

const volume =
document.getElementById("volume");
const tempoControl =
document.getElementById("tempoControl");
const tempoValue =
document.getElementById("tempoValue");
const pitchDown =
document.getElementById("pitchDown");
const pitchUp =
document.getElementById("pitchUp");
const pitchValue =
document.getElementById("pitchValue");

const panicStop =
document.getElementById("panicStop");
const importMp3 =
document.getElementById("importMp3");
const openKaraokeScreen =
document.getElementById("openKaraokeScreen");
const openKaraokePreview =
document.getElementById("openKaraokePreview");
const openKaraokeEditor =
document.getElementById("openKaraokeEditor");
const clearPlaylist =
document.getElementById("clearPlaylist");
const dropZone =
document.getElementById("dropZone");
const playlistDiv =
document.getElementById("playlist");
const playlistStats =
document.getElementById("playlistStats");
const playSelected =
document.getElementById("playSelected");
const queueSelected =
document.getElementById("queueSelected");
const nextSelected =
document.getElementById("nextSelected");
const stopSelected =
document.getElementById("stopSelected");
const lyricsBox =
document.getElementById("lyricsBox");
const lyricsOffset =
document.getElementById("lyricsOffset");
const lyricsOffsetValue =
document.getElementById("lyricsOffsetValue");
const karaokeHighlightColor =
document.getElementById("karaokeHighlightColor");
const karaokeHighlightColorValue =
document.getElementById("karaokeHighlightColorValue");
const karaokeFontFamily =
document.getElementById("karaokeFontFamily");
const karaokeShowNextLine =
document.getElementById("karaokeShowNextLine");
const remoteQr =
document.getElementById("remoteQr");
const remoteUrl =
document.getElementById("remoteUrl");
let currentKaraokeHighlightColor = "#0608d1";
let currentKaraokeFontFamily = "System";
let currentKaraokeShowNextLine = true;
let playlistController = null;
let lyricsPreviewController = null;
let mediaController = null;

document.addEventListener("dragover", (event) => {

    event.preventDefault();

});

document.addEventListener("drop", (event) => {

    event.preventDefault();

});

lyricsPreviewController =
    createLyricsPreviewController({
        socket,
        box: lyricsBox,
        offsetInput: lyricsOffset,
        offsetValue: lyricsOffsetValue,
        getCurrentTimeMs: () =>
            mediaController
            ? Math.round(mediaController.getActivePlaybackTime() * 1000)
            : 0
    });

mediaController =
    createMediaController({
        socket,
        elements: {
            audio,
            currentSong,
            currentTime,
            nextAudio,
            pitchValue,
            progress,
            tempoControl,
            tempoValue,
            totalTime,
            volume
        },
        clearLyrics: () => lyricsPreviewController.clear(),
        loadLyrics: song => lyricsPreviewController.load(song),
        onCrossfadeComplete: () => playlistController.render(),
        onCurrentSongChange: (song, shouldRenderPlaylist) => {
            if(shouldRenderPlaylist){
                playlistController.setCurrentSong();
            }
        },
        updateLyrics: time => lyricsPreviewController.update(time)
    });

playlistController =
    createPlaylistController({
        socket,
        elements: {
            clearButton: clearPlaylist,
            dropZone,
            nextSong,
            playButton: playSelected,
            playlist: playlistDiv,
            queueButton: queueSelected,
            stats: playlistStats
        },
        beforePlay: () => {},
        getCurrentSong: () => mediaController.getCurrentSong(),
        getFilePath,
        importFiles: ipcRenderer
        ? files => ipcRenderer.invoke(
            "import-mp3-files",
            files
        )
        : null,
        isImportableMediaFile
    });

fetch("/api/status")
.then(res => res.json())
.then(state => {

    applyStatusState(state);

});

fetch("/api/remote-info")
.then(res => res.json())
.then(info => {

    if(info.qr){
        remoteQr.src = info.qr;
    }

    remoteUrl.textContent =
    info.url || "";

});

function applyStatusState(state){

    if(!state){
        return;
    }

    mediaController.applyStatus(state);

    if(
        Array.isArray(state.playlist) &&
        playlistController
    ){
        playlistController.setPlaylist(state.playlist);
    }

    lyricsPreviewController.setOffset(
        state.lyricsOffset || 0,
        false
    );

    setKaraokeHighlightColorValue(
        state.karaokeHighlightColor || "#0608d1",
        false
    );

    setKaraokeFontFamilyValue(
        state.karaokeFontFamily || "System",
        false
    );

    setKaraokeShowNextLineValue(
        state.karaokeShowNextLine !== false,
        false
    );

}

socket.on("status", (state) => {

    applyStatusState(state);

});

socket.on("playSong", async (song) => {

    await mediaController.playSong(song);

});

socket.on("crossfadeToSong", async (data) => {

    const song =
        data && data.song;

    if(!song){
        return;
    }

    await mediaController.crossfadeToSong(
        song,
        Number(data.duration) || 4000
    );

});

socket.on("stopSong", () => {

    mediaController.stop();
    lyricsPreviewController.setOffset(0, false);

});

socket.on("volumeChanged", (newVolume) => {

    mediaController.setVolume(
        newVolume,
        false
    );

});

socket.on("lyricsChanged", async (song) => {

    await lyricsPreviewController.reloadIfCurrent(song);

});

progress.addEventListener("input", () => {

    mediaController.seekByProgress(
        Number(progress.value)
    );

});

volume.addEventListener("input", () => {

    mediaController.setVolume(
        Number(volume.value) / 100,
        true
    );

});

tempoControl.addEventListener("input", () => {

    mediaController.setPlaybackRate(
        Number(tempoControl.value) / 100,
        true
    );

});

pitchDown.addEventListener("click", async () => {

    await mediaController.changePitch(-1);

});

pitchUp.addEventListener("click", async () => {

    await mediaController.changePitch(1);

});

lyricsOffset.addEventListener("input", () => {

    lyricsPreviewController.setOffset(
        Number(lyricsOffset.value),
        true
    );

});

karaokeHighlightColor.addEventListener("input", () => {

    setKaraokeHighlightColorValue(
        karaokeHighlightColor.value,
        true
    );

});

karaokeFontFamily.addEventListener("change", () => {

    setKaraokeFontFamilyValue(
        karaokeFontFamily.value,
        true
    );

});

karaokeShowNextLine.addEventListener("change", () => {

    setKaraokeShowNextLineValue(
        karaokeShowNextLine.checked,
        true
    );

});

panicStop.addEventListener("click", () => {

    socket.emit("stop");

});
importMp3.addEventListener(
"click",
async () => {

    if(!ipcRenderer){
        return;
    }

    const files =
    await ipcRenderer.invoke(
        "select-mp3-files"
    );

    if(!files || files.length === 0){
        return;
    }

    await playlistController.importToPlaylist(files);

}
);

openKaraokeScreen.addEventListener("click", () => {

    if(
        ipcRenderer &&
        typeof ipcRenderer.invoke === "function"
    ){
        ipcRenderer.invoke("open-karaoke-screen");
        return;
    }

    window.open(
        "/karaoke.html",
        "karaoke-screen",
        "width=1280,height=720"
    );

});

openKaraokePreview.addEventListener("click", () => {

    if(
        ipcRenderer &&
        typeof ipcRenderer.invoke === "function"
    ){
        ipcRenderer.invoke("open-karaoke-preview");
        return;
    }

    window.open(
        "/karaoke.html?preview=1",
        "karaoke-preview",
        "width=960,height=540"
    );

});

openKaraokeEditor.addEventListener("click", () => {

    if(
        ipcRenderer &&
        typeof ipcRenderer.invoke === "function"
    ){
        ipcRenderer.invoke("open-karaoke-editor");
        return;
    }

    window.open(
        "/editor.html",
        "karaoke-editor",
        "width=1280,height=900"
    );

});

nextSelected.addEventListener("click", () => {

    mediaController.ensureRubberBandEngine();

    if(mediaController.isCrossfading()){
        return;
    }

    socket.emit("crossfadeToNext");

});

stopSelected.addEventListener("click", () => {

    socket.emit("stop");

});

function getFilePath(file){

    if(
        webUtils &&
        typeof webUtils.getPathForFile === "function"
    ){
        return webUtils.getPathForFile(file);
    }

    return file.path || "";

}

function isImportableMediaFile(file){

    const value =
        String(file || "").toLowerCase();

    return (
        value.endsWith(".mp3") ||
        value.endsWith(".mp4")
    );

}

function setKaraokeHighlightColorValue(color, notifyServer){

    currentKaraokeHighlightColor =
        /^#[0-9a-fA-F]{6}$/.test(color)
        ? color.toLowerCase()
        : "#0608d1";

    karaokeHighlightColor.value =
        currentKaraokeHighlightColor;

    karaokeHighlightColorValue.textContent =
        currentKaraokeHighlightColor;

    if(notifyServer){
        socket.emit(
            "setKaraokeHighlightColor",
            currentKaraokeHighlightColor
        );
    }

}

function setKaraokeFontFamilyValue(fontFamily, notifyServer){

    const allowedFonts = [
        "System",
        "Arial",
        "Verdana",
        "Georgia",
        "Courier New"
    ];

    currentKaraokeFontFamily =
        allowedFonts.includes(fontFamily)
        ? fontFamily
        : "System";

    karaokeFontFamily.value =
        currentKaraokeFontFamily;

    if(notifyServer){
        socket.emit(
            "setKaraokeFontFamily",
            currentKaraokeFontFamily
        );
    }

}

function setKaraokeShowNextLineValue(showNextLine, notifyServer){

    currentKaraokeShowNextLine =
        !!showNextLine;

    karaokeShowNextLine.checked =
        currentKaraokeShowNextLine;

    if(notifyServer){
        socket.emit(
            "setKaraokeShowNextLine",
            currentKaraokeShowNextLine
        );
    }

}
