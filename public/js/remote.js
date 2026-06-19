const socket = io();

let songs = [];

const currentSong =
document.getElementById("currentSong");

const statusDiv =
document.getElementById("status");

const library =
document.getElementById("library");

const queueDiv =
document.getElementById("queue");

const playlistDiv =
document.getElementById("playlist");

const lyricsBox =
document.getElementById("lyricsBox");

const volume =
document.getElementById("volume");
const toggleLibrary =
document.getElementById("toggleLibrary");

const libraryContainer =
document.getElementById("libraryContainer");

let lyricsLines = [];
let currentLyricsSong = "";
let activeCdgRenderer = null;
let activeVideoPreview = null;
let lyricsDisplayMode = "lyrics";
let activeLyricsIndex = -1;
let activeWordKey = "";
let currentLyricsOffset = 0;

document
.querySelectorAll(".tabButton")
.forEach(button => {

    button.addEventListener("click", () => {

        const tab =
            button.dataset.tab;

        document
        .querySelectorAll(".tabButton")
        .forEach(item => {
            item.classList.toggle(
                "active",
                item === button
            );
        });

        document
        .querySelectorAll(".tabPanel")
        .forEach(panel => {
            panel.classList.toggle(
                "active",
                panel.id === tab
            );
        });

    });

});

toggleLibrary.onclick = () => {};
async function loadSongs(){

    const response =
    await fetch("/api/songs");

    songs =
    await response.json();

    const text =
    document
    .getElementById("search")
    .value
    .toLowerCase();

    const filtered =
    songs.filter(song =>
        song.toLowerCase()
        .includes(text)
    );

    renderSongs(filtered);

}

function renderSongs(list){

    library.innerHTML = "";

    list.forEach(song => {

        const div =
        document.createElement("div");

        div.className = "song";

        const safeSong =
        JSON.stringify(song)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/'/g, "\\u0027");

        div.innerHTML = `
            <div>${escapeHtml(song)}</div>

            <button
                class="playBtn"
                onclick='playNow(${safeSong})'>

                ▶ Play

            </button>

            <button
                class="queueBtn"
                onclick='addQueue(${safeSong})'>

                ➕ Coda

            </button>

            <button
                class="removeBtn"
                onclick='deleteSong(${safeSong})'>

                Elimina

            </button>
        `;

        library.appendChild(div);

    });

}

function playNow(song){

    socket.emit("play", song);

}

function addQueue(song){

    socket.emit(
        "addToQueue",
        song
    );

}

async function loadLyrics(song){

    currentLyricsSong = song || "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    clearVideoPreview();
    clearCdgPreview();

    if(!song){
        renderLyricsMessage(
            "Nessun brano in riproduzione"
        );
        return;
    }

    renderLyricsMessage(
        "Caricamento testo..."
    );

    try {

        if(isVideoSong(song)){
            loadVideoPreview(song);
            return;
        }

        const cdgLoaded =
            await loadCdgPreview(song);

        if(cdgLoaded){
            return;
        }

        const response =
        await fetch(
            "/api/lyrics?name=" +
            encodeURIComponent(song)
        );

        if(!response.ok){
            renderLyricsMessage(
                "Testo non disponibile"
            );
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
            renderLyricsMessage(
                "Testo non disponibile"
            );
            return;
        }

        lyricsLines =
        data.lines;

        renderLyricsLines();

    } catch(err) {

        renderLyricsMessage(
            "Testo non disponibile"
        );

    }

}

function renderLyricsMessage(message){

    lyricsBox.innerHTML =
    `<div id="lyricsEmpty">${escapeHtml(message)}</div>`;

}

function clearLyrics(){

    currentLyricsSong = "";
    lyricsLines = [];
    activeLyricsIndex = -1;
    activeWordKey = "";
    clearVideoPreview();
    clearCdgPreview();

    renderLyricsMessage(
        "Nessun testo caricato"
    );

}

function loadVideoPreview(song){

    clearCdgPreview();
    lyricsLines = [];
    activeLyricsIndex = -1;
    activeWordKey = "";
    lyricsDisplayMode = "video";

    lyricsBox.innerHTML =
        '<div class="videoPreview">' +
        '<video playsinline muted></video>' +
        '</div>';

    activeVideoPreview =
        lyricsBox.querySelector("video");

    activeVideoPreview.src =
        "/music/" + encodeURIComponent(song);

    activeVideoPreview.muted = true;
    activeVideoPreview.playsInline = true;

}

function clearVideoPreview(){

    if(activeVideoPreview){
        activeVideoPreview.pause();
        activeVideoPreview.removeAttribute("src");
        activeVideoPreview.load();
    }

    activeVideoPreview = null;

    if(lyricsDisplayMode === "video"){
        lyricsDisplayMode = "lyrics";
    }

}

function isVideoSong(song){

    return String(song || "")
        .toLowerCase()
        .endsWith(".mp4");

}

async function loadCdgPreview(song){

    try {

        const infoResponse =
            await fetch(
                "/api/cdg-info?name=" +
                encodeURIComponent(song)
            );

        if(!infoResponse.ok){
            return false;
        }

        const info =
            await infoResponse.json();

        if(!info.hasCdg){
            return false;
        }

        const cdgResponse =
            await fetch(
                "/api/cdg?name=" +
                encodeURIComponent(song)
            );

        if(!cdgResponse.ok){
            return false;
        }

        const buffer =
            await cdgResponse.arrayBuffer();

        if(currentLyricsSong !== song){
            return true;
        }

        lyricsBox.innerHTML =
            '<div class="cdgPreview">' +
            '<canvas width="300" height="216"></canvas>' +
            '</div>';

        const canvas =
            lyricsBox.querySelector("canvas");

        activeCdgRenderer =
            new CdgRenderer(canvas);

        activeCdgRenderer.load(buffer);
        lyricsDisplayMode = "cdg";

        return true;

    } catch(err) {
        clearCdgPreview();
        return false;
    }

}

function clearCdgPreview(){

    if(activeCdgRenderer){
        activeCdgRenderer.clear();
    }

    activeCdgRenderer = null;
    lyricsDisplayMode = "lyrics";

}

function renderLyricsLines(){

    lyricsBox.innerHTML = "";

    lyricsLines.forEach((line,index)=>{

        const div =
        document.createElement("div");

        div.className =
        "lyricLine";

        div.dataset.index =
        index;

        appendLyricWords(
            div,
            line,
            index
        );

        lyricsBox.appendChild(div);

    });

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

function appendLyricWords(element, line, index){

    const words =
        Array.isArray(line.words) &&
        line.words.length > 0
        ? line.words
        : [{ time: line.time, text: line.text }];

    const fullText =
        String(line.text || "");

    const hasCompactFullText =
        fullText &&
        !/\s/.test(fullText);

    let cursor = 0;
    let matchedAnyPart = false;
    let createdWordSpans = false;
    let usedFallbackPart = false;
    let currentWordGroup = null;
    let pendingWordGap = false;

    function createWordGroup(addGapBefore){

        if(addGapBefore && element.childNodes.length > 0){
            element.appendChild(
                document.createTextNode(" ")
            );
        }

        const group =
            document.createElement("span");

        group.className =
            "lyricWordGroup";

        element.appendChild(group);
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

                const needsSpace =
                    element.childNodes.length > 0 &&
                    !/^\s/.test(part);

                shouldAddWordGap =
                    shouldAddWordGap ||
                    needsSpace;
            }

        }else if(fullText){
            return;
        }else{
            displayPart =
                displayPart.trim();
        }

        if(
            wordIndex > 0 &&
            (
                !fullText ||
                hasCompactFullText
            ) &&
            shouldInferRemoteSpaceBetweenParts(
                words[wordIndex - 1],
                word
            )
        ){
            shouldAddWordGap = true;
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
        element.textContent =
            fullText;
    }else if(
        fullText &&
        matchedAnyPart &&
        !usedFallbackPart &&
        cursor < fullText.length
    ){
        element.appendChild(
            document.createTextNode(
                fullText.slice(cursor)
            )
        );
    }

}

function markPreviousLyricWordWithSpace(element){

    let node =
        element.lastChild;

    while(node){
        if(
            node.nodeType === Node.ELEMENT_NODE &&
            node.classList &&
            node.classList.contains("lyricWord")
        ){
            node.classList.add("spaceAfter");
            return;
        }

        node =
            node.previousSibling;
    }

}

function shouldInferRemoteSpaceBetweenParts(previous, current){

    const previousText =
        String(previous && previous.text || "").trim();

    const currentText =
        String(current && current.text || "").trim();

    if(
        !previousText ||
        !currentText ||
        !isRemoteLyricWordPart(previousText) ||
        !isRemoteLyricWordPart(currentText) ||
        /^[,.;:!?')\]-]/.test(currentText) ||
        /[(\['-]$/.test(previousText)
    ){
        return false;
    }

    const gap =
        Number(current && current.time) -
        Number(previous && previous.time);

    if(!Number.isFinite(gap)){
        return (
            previousText.length >= 3 ||
            currentText.length >= 3
        );
    }

    return (
        gap >= 260 ||
        (
            gap >= 180 &&
            previousText.length >= 3 &&
            currentText.length >= 3
        )
    );

}

function isRemoteLyricWordPart(text){

    return /[\p{L}\p{N}]/u.test(text);

}

function elementTextEndsWithSpace(element){

    const lastNode =
        element.lastChild;

    return (
        lastNode &&
        lastNode.nodeType === Node.TEXT_NODE &&
        /\s$/.test(lastNode.textContent || "")
    );

}

function updateActiveLyrics(currentTime, isPlaying = true){

    if(lyricsDisplayMode === "video" && activeVideoPreview){
        const seconds =
            Math.max(0, (Number(currentTime) || 0) / 1000);

        if(Math.abs(activeVideoPreview.currentTime - seconds) > 0.25){
            activeVideoPreview.currentTime = seconds;
        }

        if(isPlaying){
            const playPromise =
                activeVideoPreview.play();

            if(playPromise && typeof playPromise.catch === "function"){
                playPromise.catch(() => {});
            }
        }else{
            activeVideoPreview.pause();
        }

        return;
    }

    if(lyricsDisplayMode === "cdg" && activeCdgRenderer){
        activeCdgRenderer.renderToTime(currentTime);
        return;
    }

    if(lyricsLines.length === 0){
        return;
    }

    let nextIndex = -1;
    let nextWordIndex = -1;

    const syncedTime =
        currentTime +
        currentLyricsOffset;

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

    const nextWordKey =
        nextIndex + ":" + nextWordIndex;

    if(
        nextIndex === activeLyricsIndex &&
        nextWordKey === activeWordKey
    ){
        return;
    }

    activeLyricsIndex =
    nextIndex;

    activeWordKey =
    nextWordKey;

    document
    .querySelectorAll(".lyricLine")
    .forEach((line,index)=>{

        line.classList.toggle(
            "active",
            index === activeLyricsIndex
        );

        line.classList.toggle(
            "past",
            index < activeLyricsIndex
        );

    });

    document
    .querySelectorAll(".lyricWord")
    .forEach(word=>{

        const lineIndex =
            Number(word.dataset.lineIndex);

        const wordIndex =
            Number(word.dataset.wordIndex);

        word.classList.toggle(
            "sung",
            lineIndex < activeLyricsIndex ||
            (
                lineIndex === activeLyricsIndex &&
                wordIndex <= nextWordIndex
            )
        );

    });

    const activeLine =
    document.querySelector(
        ".lyricLine.active"
    );

    if(activeLine){
        activeLine.scrollIntoView({
            block:"center",
            behavior:"smooth"
        });
    }

}

function escapeHtml(text){

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

async function deleteSong(song){

    const confirmed =
    confirm(
        "Eliminare definitivamente \"" +
        song +
        "\" dalla libreria?"
    );

    if(!confirmed){
        return;
    }

    const response =
    await fetch(
        "/api/songs?name=" +
        encodeURIComponent(song),
        { method: "DELETE" }
    );

    if(!response.ok){

        alert(
            "Eliminazione non riuscita"
        );

        return;

    }

    await loadSongs();

}



function renderQueue(queue){

    const queueDiv =
        document.getElementById("queue");

    queueDiv.innerHTML = "";

    queue.forEach((song,index)=>{

        const div =
            document.createElement("div");

        div.className = "queueItem";

        div.innerHTML = `
            <strong>${index + 1}</strong> - ${escapeHtml(song)}
            <br><br>

            <button
                class="playBtn"
                onclick="playQueueNow(${index})">

                ▶ Play

            </button>

            <button
                class="removeBtn"
                onclick="removeQueue(${index})">

                Rimuovi

            </button>
        `;

        queueDiv.appendChild(div);

    });

}

function renderPlaylist(playlist){

    playlistDiv.innerHTML = "";

    if(
        !playlist ||
        playlist.length === 0
    ){
        playlistDiv.innerHTML =
        "<div class=\"emptyState\">Nessuna scaletta caricata<br>Aggiungi brani dal player</div>";
        return;
    }

    playlist.forEach((song,index)=>{

        const div =
        document.createElement("div");

        div.className =
        "playlistItem";

        const safeSong =
        JSON.stringify(song)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/'/g, "\\u0027");

        div.innerHTML = `
            <strong>${index + 1}</strong> - ${escapeHtml(song)}
            <br><br>

            <button
                class="playBtn"
                onclick='playNow(${safeSong})'>

                ▶ Play

            </button>

            <button
                class="queueBtn"
                onclick='addQueue(${safeSong})'>

                ➕ Coda

            </button>
        `;

        playlistDiv.appendChild(div);

    });

}

function removeQueue(index){

    socket.emit(
        "removeFromQueue",
        index
    );

}

function playQueueNow(index){

    fetch("/api/status")
    .then(res => res.json())
    .then(state => {

        const song =
        state.queue[index];

        if(!song) return;

        socket.emit(
            "play",
            song
        );

        socket.emit(
            "removeFromQueue",
            index
        );

    });

}
document
.getElementById("search")
.addEventListener("input",(e)=>{

    const text =
    e.target.value.toLowerCase();

    const filtered =
    songs.filter(song =>
        song.toLowerCase()
        .includes(text)
    );

    renderSongs(filtered);

});

volume.addEventListener("input",()=>{

    socket.emit(
        "setVolume",
        volume.value / 100
    );

});

document
.getElementById("panicStop")
.addEventListener("click",()=>{

    socket.emit("stop");

});

document
.getElementById("clearQueue")
.addEventListener("click",()=>{

    socket.emit("clearQueue");

});

socket.on("status",(state)=>{

    const previousSong =
    currentLyricsSong;

    currentLyricsOffset =
    state.lyricsOffset || 0;

    currentSong.innerText =
    state.currentSong ||
    "Nessun brano";

    volume.value =
    Math.round(
        state.volume * 100
    );

    if(state.isPlaying){

        statusDiv.innerText =
        "▶ PLAY";

        statusDiv.className =
        "play";

    }else{

        statusDiv.innerText =
        "■ STOP";

        statusDiv.className =
        "stop";

    }

    renderQueue(
        state.queue
    );

    renderPlaylist(
        state.playlist
    );

    if(!state.currentSong){
        clearLyrics();
        return;
    }

    if(
        state.currentSong !== previousSong
    ){
        loadLyrics(
            state.currentSong
        );
    }

});

socket.on("playbackTime",(state)=>{

    if(
        !state ||
        state.song !== currentLyricsSong
    ){
        return;
    }

    updateActiveLyrics(
        state.currentTime || 0,
        state.isPlaying !== false
    );

});

socket.on("lyricsChanged",(song)=>{

    if(song === currentLyricsSong){
        loadLyrics(song);
    }

});

socket.on("libraryChanged",()=>{

    loadSongs();

});

loadSongs();

setInterval(() => {

    loadSongs();

}, 5000);
