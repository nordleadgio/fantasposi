const socket = io();

const lyrics =
document.getElementById("lyrics");

const videoStage =
document.getElementById("videoStage");

const stageVideo =
document.getElementById("stageVideo");

const cdgStage =
document.getElementById("cdgStage");

const cdgCanvas =
document.getElementById("cdgCanvas");

const footer =
document.getElementById("footer");

let lyricsLines = [];
let activeCdgRenderer = null;
let displayMode = "lyrics";
let activeLyricsIndex = -1;
let currentLyricsOffset = 0;
let currentKaraokeHighlightColor = "#0608d1";
let currentKaraokeShowNextLine = true;
let currentKaraokeFontFamily = "System";
let currentLyricsSong = "";
let currentSong = "";
let currentTime = 0;
let playbackClockTime = 0;
let playbackClockStartedAt = Date.now();
let playbackRunning = false;
let currentPlaybackRate = 1;
let animationFrame = 0;
let renderedSlotIndexes = [];
let renderedSlotStateKeys = [];
let resizeFrame = 0;

fetch("/api/status")
.then(res => res.json())
.then(state => {
    applyState(state);
});

window.addEventListener("resize", () => {
    scheduleResponsiveLyricsUpdate();
});

if(window.ResizeObserver){
    const lyricsResizeObserver =
        new ResizeObserver(scheduleResponsiveLyricsUpdate);

    lyricsResizeObserver.observe(lyrics);
}

socket.on("status", (state) => {
    applyState(state);
});

socket.on("playSong", (song) => {

    currentSong = song || "";
    setPlaybackClock(0, true);
    loadSongDisplay(currentSong);

});

socket.on("crossfadeToSong", (data) => {

    const song =
        data && data.song || "";

    currentSong = song;
    setPlaybackClock(0, true);
    loadSongDisplay(currentSong);

});

socket.on("stopSong", () => {

    currentSong = "";
    setPlaybackClock(0, false);
    currentLyricsOffset = 0;
    clearVideo();
    clearCdg();
    clearLyrics("");

});

socket.on("playbackTime", (data) => {

    if(
        !data ||
        data.song !== currentSong
    ){
        return;
    }

    setPlaybackClock(
        data.currentTime || 0,
        data.isPlaying !== false
    );

    setPlaybackRate(
        data.playbackRate || 1
    );

});

socket.on("lyricsChanged", (song) => {

    if(song === currentLyricsSong){
        loadSongDisplay(song);
    }

});

function applyState(state){

    if(!state){
        return;
    }

    currentLyricsOffset =
        state.lyricsOffset || 0;

    setPlaybackRate(
        state.playbackRate || 1
    );

    setKaraokeHighlightColor(
        state.karaokeHighlightColor || "#0608d1"
    );

    setKaraokeShowNextLine(
        state.karaokeShowNextLine !== false
    );

    setKaraokeFontFamily(
        state.karaokeFontFamily || "System"
    );

    if(state.currentSong !== currentSong){

        currentSong =
            state.currentSong || "";

        if(currentSong){
            loadSongDisplay(currentSong);
        }else{
            clearVideo();
            clearCdg();
            clearLyrics("");
        }

    }

    if(Number.isFinite(state.currentTime)){
        setPlaybackClock(
            state.currentTime,
            !!state.isPlaying
        );
    }

}

function setPlaybackRate(rate){

    currentPlaybackRate =
        Math.max(
            0.8,
            Math.min(
                1.2,
                Number(rate || 1)
            )
        );

    stageVideo.playbackRate =
        currentPlaybackRate;

}

function setKaraokeHighlightColor(color){

    currentKaraokeHighlightColor =
        /^#[0-9a-fA-F]{6}$/.test(color)
        ? color.toLowerCase()
        : "#0608d1";

    document.body.style.setProperty(
        "--karaoke-highlight",
        currentKaraokeHighlightColor
    );

}

function setKaraokeShowNextLine(showNextLine){

    currentKaraokeShowNextLine =
        !!showNextLine;

    document.body.classList.toggle(
        "hideNextLine",
        !currentKaraokeShowNextLine
    );

}

function setKaraokeFontFamily(fontFamily){

    const fonts = {
        System: "-apple-system, BlinkMacSystemFont, Arial, sans-serif",
        Arial: "Arial, sans-serif",
        Verdana: "Verdana, Arial, sans-serif",
        Georgia: "Georgia, serif",
        "Courier New": "'Courier New', monospace"
    };

    currentKaraokeFontFamily =
        fonts[fontFamily]
        ? fontFamily
        : "System";

    document.body.style.setProperty(
        "--karaoke-font",
        fonts[currentKaraokeFontFamily]
    );

}

function scheduleResponsiveLyricsUpdate(){

    if(resizeFrame){
        return;
    }

    resizeFrame =
        requestAnimationFrame(() => {
            resizeFrame = 0;
            updateResponsiveLyricsSize();
            fitRenderedLyrics();
        });

}

function updateResponsiveLyricsSize(){

    const bounds =
        lyrics.getBoundingClientRect();

    const width =
        Math.max(1, bounds.width || window.innerWidth || 1);

    const height =
        Math.max(1, bounds.height || window.innerHeight || 1);

    const stageScale =
        Math.min(
            width / 1024,
            height / 576
        );

    const fontSize =
        Math.max(
            46,
            Math.min(
                124,
                104
            )
        );

    document.body.style.setProperty(
        "--karaoke-stage-scale",
        stageScale.toFixed(4)
    );

    document.body.style.setProperty(
        "--karaoke-base-font",
        fontSize.toFixed(2) + "px"
    );

}

async function loadSongDisplay(song){

    if(!song){
        clearVideo();
        clearCdg();
        clearLyrics();
        return;
    }

    lyrics.innerHTML =
        '<div class="idle">Caricamento karaoke...</div>';

    if(isVideoSong(song)){
        loadVideo(song);
        return;
    }

    try {

        const infoResponse =
            await fetch(
                "/api/cdg-info?name=" +
                encodeURIComponent(song)
            );

        if(infoResponse.ok){

            const info =
                await infoResponse.json();

            if(info.hasCdg){
                await loadCdg(song);
                return;
            }

        }

    } catch(err) {
        clearCdg();
    }

    await loadLyrics(song);

}

function loadVideo(song){

    clearCdg();
    currentLyricsSong = "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    renderedSlotIndexes = [];
    renderedSlotStateKeys = [];
    displayMode = "video";

    stageVideo.src =
        "/music/" + encodeURIComponent(song);

    stageVideo.currentTime =
        Math.max(0, getDisplayTime() / 1000);

    stageVideo.muted = true;
    stageVideo.playsInline = true;
    stageVideo.playbackRate =
        currentPlaybackRate;

    videoStage.hidden = false;
    document.body.classList.add("videoMode");
    lyrics.innerHTML = "";
    footer.textContent = "";

    syncStageVideo(getDisplayTime());

}

function clearVideo(){

    stageVideo.pause();
    stageVideo.removeAttribute("src");
    stageVideo.load();
    videoStage.hidden = true;
    document.body.classList.remove("videoMode");

    if(displayMode === "video"){
        displayMode = "lyrics";
    }

}

function syncStageVideo(time){

    if(displayMode !== "video"){
        return;
    }

    const seconds =
        Math.max(0, (Number(time) || 0) / 1000);

    if(
        Number.isFinite(stageVideo.duration) &&
        Math.abs(stageVideo.currentTime - seconds) > 0.18
    ){
        stageVideo.currentTime = seconds;
    }

    if(playbackRunning){
        const playPromise =
            stageVideo.play();

        if(playPromise && typeof playPromise.catch === "function"){
            playPromise.catch(() => {});
        }
    }else{
        stageVideo.pause();
    }

}

function isVideoSong(song){

    return String(song || "")
        .toLowerCase()
        .endsWith(".mp4");

}

async function loadCdg(song){

    clearVideo();
    currentLyricsSong = "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    renderedSlotIndexes = [];
    renderedSlotStateKeys = [];

    const response =
        await fetch(
            "/api/cdg?name=" +
            encodeURIComponent(song)
        );

    if(!response.ok){
        clearCdg();
        await loadLyrics(song);
        return;
    }

    const buffer =
        await response.arrayBuffer();

    if(song !== currentSong){
        return;
    }

    activeCdgRenderer =
        new CdgRenderer(cdgCanvas);

    activeCdgRenderer.load(buffer);
    activeCdgRenderer.renderToTime(
        getDisplayTime()
    );

    displayMode = "cdg";
    document.body.classList.add("cdgMode");
    cdgStage.hidden = false;
    lyrics.innerHTML = "";
    footer.textContent = "";

    if(playbackRunning){
        startAnimationLoop();
    }

}

function clearCdg(){

    if(activeCdgRenderer){
        activeCdgRenderer.clear();
    }

    activeCdgRenderer = null;
    displayMode = "lyrics";
    cdgStage.hidden = true;
    document.body.classList.remove("cdgMode");

}

async function loadLyrics(song){

    clearVideo();
    clearCdg();
    currentLyricsSong = song || "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    renderedSlotIndexes = [];
    renderedSlotStateKeys = [];
    lyrics.innerHTML =
        '<div class="idle">Caricamento testo...</div>';
    footer.textContent = "";

    if(!song){
        clearLyrics();
        return;
    }

    try {

        const response =
        await fetch(
            "/api/lyrics?name=" +
            encodeURIComponent(song)
        );

        if(!response.ok){
            clearLyrics("Testo non disponibile");
            return;
        }

        const data =
        await response.json();

        if(
            currentLyricsSong !== song ||
            !data.hasLyrics ||
            !Array.isArray(data.lines) ||
            data.lines.length === 0
        ){
            clearLyrics("Testo non disponibile");
            return;
        }

        lyricsLines =
            data.lines;

        renderLyricsLines();
        updateActiveLyrics(getDisplayTime());

    } catch(err) {

        clearLyrics("Testo non disponibile");

    }

}

function clearLyrics(message){

    currentLyricsSong = "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    renderedSlotIndexes = [];
    renderedSlotStateKeys = [];
    stopAnimationLoop();
    if(message === ""){
        lyrics.innerHTML = "";
    }else{
        lyrics.innerHTML =
            '<div class="idle">' +
            escapeHtml(message || "In attesa del brano") +
            "</div>";
    }

    footer.textContent = "";

}

function setPlaybackClock(time, isPlaying){

    currentTime =
        Math.round(time || 0);

    playbackClockTime =
        currentTime;

    playbackClockStartedAt =
        Date.now();

    playbackRunning =
        !!isPlaying;

    updateDisplay(getDisplayTime());

    if(playbackRunning){
        startAnimationLoop();
    }else{
        stopAnimationLoop();
    }

}

function getDisplayTime(){

    if(!playbackRunning){
        return currentTime;
    }

    return Math.round(
        playbackClockTime +
        (
            Date.now() -
            playbackClockStartedAt
        )
    );

}

function startAnimationLoop(){

    if(animationFrame){
        return;
    }

    animationFrame =
        requestAnimationFrame(animationLoop);

}

function stopAnimationLoop(){

    if(!animationFrame){
        return;
    }

    cancelAnimationFrame(animationFrame);
    animationFrame = 0;

}

function animationLoop(){

    animationFrame = 0;

    if(!playbackRunning){
        return;
    }

    updateDisplay(getDisplayTime());

    startAnimationLoop();

}

function updateDisplay(time){

    if(displayMode === "video"){
        syncStageVideo(time);
        return;
    }

    if(displayMode === "cdg" && activeCdgRenderer){
        activeCdgRenderer.renderToTime(time);
        return;
    }

    updateActiveLyrics(time);

}

function renderLyricsLines(){

    lyrics.innerHTML =
        '<div id="lyricStack" class="lyricStack">' +
        '<div class="lyricLine slot0"></div>' +
        '<div class="lyricLine slot1"></div>' +
        '<div class="lyricLine slot2"></div>' +
        '<div class="lyricLine slot3"></div>' +
        "</div>";

    renderedSlotIndexes = [];
    renderedSlotStateKeys = [];
    scheduleResponsiveLyricsUpdate();

}

function normaliseLyricsMatch(text){

    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’‘`´]/g, "'")
        .toLowerCase();

}

function findLyricsPart(fullText, part, cursor){

    const exactIndex =
        fullText.indexOf(part, cursor);

    if(exactIndex >= cursor){
        return {
            start: exactIndex,
            end: exactIndex + part.length
        };
    }

    const target =
        normaliseLyricsMatch(part).trim();

    if(!target){
        return null;
    }

    for(let start = cursor; start < fullText.length; start += 1){

        const maxEnd =
            Math.min(fullText.length, start + part.length + 8);

        for(let end = start + 1; end <= maxEnd; end += 1){

            const candidate =
                normaliseLyricsMatch(
                    fullText.slice(start, end)
                ).trim();

            if(candidate === target){
                return { start, end };
            }

        }

    }

    return null;

}

function renderLineInto(element, line, index){

    const nextIndexKey =
        String(index);

    element.dataset.pendingIndex =
        nextIndexKey;

    const previousIndex =
        element.dataset.index;

    const shouldFadeOut =
        element.classList.contains("visible") &&
        previousIndex !== String(index);

    element.classList.remove("visible");

    if(shouldFadeOut){
        window.setTimeout(() => {
            if(element.dataset.pendingIndex !== nextIndexKey){
                return;
            }
            populateLineInto(element, line, index);
        }, 260);
        return;
    }

    populateLineInto(element, line, index);

}

function populateLineInto(element, line, index){

    element.innerHTML = "";
    element.dataset.index =
        index;
    element.style.setProperty("--fit-scale", "1");

    if(!line){
        element.classList.remove("visible");
        return;
    }

    const content =
        document.createElement("span");

    content.className =
        "lyricLineText";

    element.appendChild(content);

    const words =
        Array.isArray(line.words) &&
        line.words.length > 0
        ? line.words
        : [{ time: line.time, text: line.text }];

    const fullText =
        String(line.text || "");

    let cursor = 0;
    let matchedAnyPart = false;
    let createdWordSpans = false;
    let usedFallbackPart = false;
    let currentWordGroup = null;
    let pendingWordGap = false;

    function createWordGroup(addGapBefore){

        if(addGapBefore && content.childNodes.length > 0){
            content.appendChild(
                document.createTextNode(" ")
            );
        }

        const group =
            document.createElement("span");

        group.className =
            "lyricWordGroup";

        content.appendChild(group);
        currentWordGroup = group;

        return group;

    }

    words.forEach((word, wordIndex)=>{

        const part =
            String(word.text || "");
        let displayPart = part;
        let shouldAddWordGap = false;
        let shouldAddGapAfter = false;

        if(fullText && part){

            const match =
                findLyricsPart(fullText, part, cursor);

            if(match){

                const gap =
                    fullText.slice(cursor, match.start);

                shouldAddWordGap =
                    /\s/.test(gap) ||
                    /^\s/.test(displayPart) ||
                    pendingWordGap;

                const visibleGap =
                    gap.replace(/\s+/g, "");

                if(visibleGap){
                    (
                        currentWordGroup ||
                        createWordGroup(false)
                    ).appendChild(
                        document.createTextNode(visibleGap)
                    );
                }

                cursor =
                    match.end;

                displayPart =
                    fullText.slice(match.start, match.end);

                shouldAddWordGap =
                    shouldAddWordGap ||
                    /^\s/.test(displayPart) ||
                    pendingWordGap;

                shouldAddGapAfter =
                    /\s$/.test(displayPart);

                displayPart =
                    displayPart.trim();

                matchedAnyPart = true;

            }else{
                usedFallbackPart = true;
                shouldAddWordGap = pendingWordGap;
                shouldAddGapAfter = /\s$/.test(displayPart);
                displayPart = displayPart.trim();
            }

        }else if(fullText){
            return;
        }

        const span =
        document.createElement("span");

        span.className =
        "lyricWord";

        span.dataset.lineIndex =
        index;

        span.dataset.wordIndex =
        wordIndex;

        span.dataset.time =
        word.time;

        span.dataset.text =
        displayPart;

        span.textContent =
        displayPart;

        const group =
            (
                wordIndex === 0 ||
                shouldAddWordGap ||
                !currentWordGroup
            )
            ? createWordGroup(wordIndex > 0 && shouldAddWordGap)
            : currentWordGroup;

        group.appendChild(span);
        createdWordSpans = true;
        pendingWordGap = shouldAddGapAfter;

    });

    if(fullText && !createdWordSpans){
        content.textContent =
            fullText;
    }else if(
        fullText &&
        matchedAnyPart &&
        !usedFallbackPart &&
        cursor < fullText.length
    ){
        content.appendChild(
            document.createTextNode(
                fullText.slice(cursor)
            )
        );
    }

    void element.offsetWidth;

    requestAnimationFrame(() => {
        fitLyricLine(element);
        element.classList.add("visible");
    });

}

function fitLyricLine(element){

    const content =
        element.querySelector(".lyricLineText");

    if(!content){
        return;
    }

    content.style.setProperty("--fit-scale", "1");

    const availableHeight =
        Math.max(1, element.clientHeight * 0.9);

    const availableWidth =
        Math.max(1, element.clientWidth * 0.98);

    const neededHeight =
        Math.max(1, content.scrollHeight);

    const neededWidth =
        Math.max(1, content.scrollWidth);

    const scale =
        Math.min(
            1,
            availableHeight / neededHeight,
            availableWidth / neededWidth
        );

    content.style.setProperty(
        "--fit-scale",
        String(Math.max(0.18, scale))
    );

}

function fitRenderedLyrics(){

    document
    .querySelectorAll(".lyricStack .lyricLine")
    .forEach(fitLyricLine);

}

function getDisplayLineIndexes(activeIndex){

    if(activeIndex < 0){
        return [
            0,
            1,
            2,
            3
        ];
    }

    return [
        activeIndex - 1,
        activeIndex,
        activeIndex + 1,
        activeIndex + 2
    ];

}

function getLineRenderState(lineIndex, activeIndex, syncedTime){

    const line =
        lyricsLines[lineIndex];

    const isNextLine =
        lineIndex === activeIndex + 1;

    const isPreviewLine =
        lineIndex > activeIndex + 1;

    const lineStartTime =
        Number(line && line.time);

    const previewLead =
        Number.isFinite(lineStartTime)
        ? lineStartTime - syncedTime
        : 0;

    const isHiddenCue =
        !line ||
        lineIndex < 0 ||
        (
            isNextLine &&
            !currentKaraokeShowNextLine
        ) ||
        (
            isPreviewLine &&
            (
                !currentKaraokeShowNextLine ||
                previewLead > 9000
            )
        );

    const isPreviewNear =
        isPreviewLine &&
        previewLead <= 6000;

    return {
        line,
        isNextLine,
        isPreviewLine,
        isHiddenCue,
        isPreviewNear,
        contentKey:
            lineIndex + ":" +
            (isHiddenCue ? "hidden" : "shown"),
        stateKey:
            lineIndex + ":" +
            (isHiddenCue ? "hidden" : "shown") + ":" +
            (isPreviewNear ? "near" : "far")
    };

}

function getDisplayLineStateKeys(activeIndex, syncedTime){

    return getDisplayLineIndexes(activeIndex)
        .map(lineIndex =>
            getLineRenderState(
                lineIndex,
                activeIndex,
                syncedTime
            ).stateKey
        );

}

function updateRenderedLines(activeIndex, syncedTime){

    const slots =
        Array.from(
            document.querySelectorAll(".lyricStack .lyricLine")
        );

    if(slots.length === 0){
        return;
    }

    const displayLineIndexes =
        getDisplayLineIndexes(activeIndex);

    slots.forEach((slot, slotIndex) => {

        const lineIndex =
            displayLineIndexes[slotIndex];

        const state =
            getLineRenderState(
                lineIndex,
                activeLyricsIndex,
                syncedTime
            );

        const isCurrentLine =
            lineIndex === activeLyricsIndex;

        const isPreviousLine =
            lineIndex >= 0 &&
            lineIndex < activeLyricsIndex;

        slot.classList.toggle(
            "activeLine",
            isCurrentLine
        );

        slot.classList.toggle(
            "previousLine",
            isPreviousLine
        );

        slot.classList.toggle(
            "upcomingLine",
            state.isPreviewLine
        );

        slot.classList.toggle(
            "nextLine",
            state.isNextLine
        );

        slot.classList.toggle(
            "hiddenCue",
            state.isHiddenCue
        );

        slot.classList.toggle(
            "previewNear",
            state.isPreviewNear
        );

        slot.classList.add("currentPairLine");

        renderedSlotStateKeys[slotIndex] =
            state.stateKey;

        if(renderedSlotIndexes[slotIndex] === state.contentKey){
            return;
        }

        renderedSlotIndexes[slotIndex] =
            state.contentKey;

        renderLineInto(
            slot,
            state.isHiddenCue ? null : state.line,
            lineIndex
        );

    });

}

function updateActiveLyrics(time){

    if(lyricsLines.length === 0){
        return;
    }

    const syncedTime =
        time +
        currentLyricsOffset;

    let nextIndex = -1;
    let nextWordIndex = -1;

    for(
        let i = 0;
        i < lyricsLines.length;
        i++
    ){
        if(lyricsLines[i].time <= syncedTime){
            nextIndex = i;
        }else{
            break;
        }
    }

    if(nextIndex >= 0){

        const words =
        Array.isArray(
            lyricsLines[nextIndex].words
        )
        ? lyricsLines[nextIndex].words
        : [];

        for(
            let i = 0;
            i < words.length;
            i++
        ){
            if(words[i].time <= syncedTime){
                nextWordIndex = i;
            }else{
                break;
            }
        }

    }

    const lineChanged =
        nextIndex !== activeLyricsIndex;

    activeLyricsIndex =
        nextIndex;

    const displayedStateKeys =
        getDisplayLineStateKeys(
            activeLyricsIndex,
            syncedTime
        );

    if(
        lineChanged ||
        displayedStateKeys.some(
            (stateKey, index) =>
                renderedSlotStateKeys[index] !== stateKey
        )
    ){
        updateRenderedLines(activeLyricsIndex, syncedTime);
    }

    document
    .querySelectorAll(".lyricWord")
    .forEach(word=>{

        const lineIndex =
            Number(word.dataset.lineIndex);

        const wordIndex =
            Number(word.dataset.wordIndex);

        const progress =
            getWordProgress(
                lineIndex,
                wordIndex,
                activeLyricsIndex,
                nextWordIndex,
                syncedTime
            );

        word.style.setProperty(
            "--word-progress",
            Math.round(progress * 1000) / 10 + "%"
        );

    });

    footer.textContent = "";

}

function getWordProgress(
    lineIndex,
    wordIndex,
    currentLineIndex,
    currentWordIndex,
    syncedTime
){

    if(lineIndex < currentLineIndex){
        return 1;
    }

    if(lineIndex > currentLineIndex){
        return 0;
    }

    if(wordIndex < currentWordIndex){
        return 1;
    }

    if(wordIndex > currentWordIndex){
        return 0;
    }

    if(currentWordIndex < 0){
        return 0;
    }

    const words =
        Array.isArray(lyricsLines[currentLineIndex]?.words)
        ? lyricsLines[currentLineIndex].words
        : [];

    const currentWord =
        words[currentWordIndex];

    const nextWord =
        words[currentWordIndex + 1];

    const start =
        Number(currentWord && currentWord.time);

    const end =
        Number(nextWord && nextWord.time);

    if(!Number.isFinite(start)){
        return 1;
    }

    if(!Number.isFinite(end) || end <= start){
        return 1;
    }

    return Math.max(
        0,
        Math.min(
            1,
            (syncedTime - start) / (end - start)
        )
    );

}

class CdgRenderer {

    constructor(canvas){

        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.packetSize = 24;
        this.packetRate = 300;
        this.screenWidth = 300;
        this.screenHeight = 216;
        this.visibleX = 6;
        this.visibleY = 12;
        this.visibleWidth = 288;
        this.visibleHeight = 192;
        this.bytes = new Uint8Array();
        this.packetCount = 0;
        this.currentPacket = 0;
        this.screen =
            new Uint8Array(
                this.screenWidth * this.screenHeight
            );
        this.colors =
            Array.from(
                { length: 16 },
                () => [0, 0, 0]
            );
        this.colors[1] = [255, 255, 255];
        this.imageData =
            this.context.createImageData(
                this.screenWidth,
                this.screenHeight
            );

    }

    load(buffer){

        this.bytes =
            new Uint8Array(buffer);

        this.packetCount =
            Math.floor(
                this.bytes.length / this.packetSize
            );

        this.reset();

    }

    reset(){

        this.currentPacket = 0;
        this.screen.fill(0);
        this.colors =
            Array.from(
                { length: 16 },
                () => [0, 0, 0]
            );
        this.colors[1] = [255, 255, 255];
        this.draw();

    }

    clear(){

        this.screen.fill(0);
        this.draw();

    }

    renderToTime(time){

        const targetPacket =
            Math.max(
                0,
                Math.min(
                    this.packetCount,
                    Math.floor(
                        (Number(time) || 0) *
                        this.packetRate /
                        1000
                    )
                )
            );

        if(targetPacket < this.currentPacket){
            this.reset();
        }

        if(targetPacket === this.currentPacket){
            return;
        }

        while(this.currentPacket < targetPacket){
            this.renderPacket(this.currentPacket);
            this.currentPacket += 1;
        }

        this.draw();

    }

    renderPacket(packetIndex){

        const offset =
            packetIndex * this.packetSize;

        if(offset + this.packetSize > this.bytes.length){
            return;
        }

        const command =
            this.bytes[offset] & 0x3f;

        const instruction =
            this.bytes[offset + 1] & 0x3f;

        if(command !== 9){
            return;
        }

        const payload =
            Array.from(
                this.bytes.slice(offset + 4, offset + 20),
                value => value & 0x3f
            );

        if(instruction === 1){
            this.screen.fill(payload[0] & 0x0f);
            return;
        }

        if(instruction === 2){
            this.fillBorder(payload[0] & 0x0f);
            return;
        }

        if(instruction === 6 || instruction === 38){
            this.renderTile(payload, instruction === 38);
            return;
        }

        if(instruction === 20 || instruction === 24){
            this.scroll(payload, instruction === 20);
            return;
        }

        if(instruction === 28){
            this.setTransparentColor(payload[0] & 0x0f);
            return;
        }

        if(instruction === 30 || instruction === 31){
            this.setColorTable(payload, instruction === 30 ? 0 : 8);
        }

    }

    fillBorder(color){

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){
                if(
                    x < this.visibleX ||
                    x >= this.visibleX + this.visibleWidth ||
                    y < this.visibleY ||
                    y >= this.visibleY + this.visibleHeight
                ){
                    this.screen[y * this.screenWidth + x] = color;
                }
            }
        }

    }

    renderTile(payload, xor){

        const color0 =
            payload[0] & 0x0f;

        const color1 =
            payload[1] & 0x0f;

        const row =
            payload[2] & 0x1f;

        const col =
            payload[3] & 0x3f;

        const x0 =
            col * 6;

        const y0 =
            row * 12;

        for(let y = 0; y < 12; y += 1){

            const line =
                payload[4 + y];

            for(let x = 0; x < 6; x += 1){

                const bit =
                    (line >> (5 - x)) & 1;

                this.setPixel(
                    x0 + x,
                    y0 + y,
                    bit ? color1 : color0,
                    xor
                );

            }

        }

    }

    scroll(payload, usePresetColor){

        const color =
            payload[0] & 0x0f;

        const hScroll =
            payload[1] & 0x3f;

        const vScroll =
            payload[2] & 0x3f;

        const horizontalCommand =
            (hScroll & 0x30) >> 4;

        const verticalCommand =
            (vScroll & 0x30) >> 4;

        let deltaX = 0;
        let deltaY = 0;

        if(horizontalCommand === 1){
            deltaX = 6;
        }else if(horizontalCommand === 2){
            deltaX = -6;
        }

        if(verticalCommand === 1){
            deltaY = 12;
        }else if(verticalCommand === 2){
            deltaY = -12;
        }

        if(deltaX === 0 && deltaY === 0){
            return;
        }

        const next =
            new Uint8Array(this.screen.length);

        next.fill(usePresetColor ? color : 0);

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){

                const sourceX =
                    x - deltaX;

                const sourceY =
                    y - deltaY;

                if(
                    sourceX >= 0 &&
                    sourceX < this.screenWidth &&
                    sourceY >= 0 &&
                    sourceY < this.screenHeight
                ){
                    next[y * this.screenWidth + x] =
                        this.screen[
                            sourceY * this.screenWidth + sourceX
                        ];
                }

            }
        }

        this.screen = next;

    }

    setTransparentColor(color){

        this.transparentColor =
            color;

    }

    setColorTable(payload, start){

        for(let index = 0; index < 8; index += 1){
            this.colors[start + index] =
                this.decodeColor(
                    payload[index * 2],
                    payload[index * 2 + 1]
                );
        }

    }

    decodeColor(first, second){

        const red =
            (first & 0x3c) >> 2;

        const green =
            ((first & 0x03) << 2) |
            ((second & 0x30) >> 4);

        const blue =
            second & 0x0f;

        return [
            red * 17,
            green * 17,
            blue * 17
        ];

    }

    setPixel(x, y, color, xor){

        if(
            x < 0 ||
            x >= this.screenWidth ||
            y < 0 ||
            y >= this.screenHeight
        ){
            return;
        }

        const index =
            y * this.screenWidth + x;

        this.screen[index] =
            xor
            ? this.screen[index] ^ color
            : color;

    }

    draw(){

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){

                const source =
                    y * this.screenWidth + x;

                const target =
                    source * 4;

                const colorIndex =
                    this.screen[source] & 0x0f;

                const color =
                    this.colors[colorIndex] || [0, 0, 0];

                this.imageData.data[target] =
                    color[0];

                this.imageData.data[target + 1] =
                    color[1];

                this.imageData.data[target + 2] =
                    color[2];

                this.imageData.data[target + 3] =
                    colorIndex === this.transparentColor
                    ? 0
                    : 255;

            }
        }

        this.context.putImageData(
            this.imageData,
            0,
            0
        );

    }

}

function escapeHtml(text){

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
