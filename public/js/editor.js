let ipcRenderer = null;

try {

    ipcRenderer =
        require("electron").ipcRenderer;

} catch(err) {

    ipcRenderer = null;

}

const songSelect =
document.getElementById("songSelect");
const audio =
document.getElementById("audio");
const lyricsText =
document.getElementById("lyricsText");
const wordsBox =
document.getElementById("words");
const statusBox =
document.getElementById("status");
const startOffset =
document.getElementById("startOffset");
const exportFormat =
document.getElementById("exportFormat");
const songStep =
document.getElementById("songStep");
const textStep =
document.getElementById("textStep");
const syncStep =
document.getElementById("syncStep");
const exportStep =
document.getElementById("exportStep");
const textStats =
document.getElementById("textStats");
const syncSummary =
document.getElementById("syncSummary");
const importSong =
document.getElementById("importSong");

let project = {
    version: 1,
    song: "",
    startOffset: 0,
    lines: []
};

let currentSyncIndex = 0;

loadSongs();

document
.getElementById("prepareText")
.addEventListener("click", () => {
    project.lines =
        mergeTextWithExistingSync(
            lyricsText.value,
            project.lines
        );
    renderWords();
    scrollTargetIntoView();
    updateWorkflow();
    setStatus("Testo aggiornato mantenendo la sync possibile");
});

importSong.addEventListener("click", importSongForEditing);

document
.getElementById("saveProject")
.addEventListener("click", saveProject);

document
.getElementById("exportProject")
.addEventListener("click", exportProject);

document
.getElementById("syncCurrent")
.addEventListener("click", () => {
    syncCurrentWord(
        Math.round(audio.currentTime * 1000)
    );
});

document
.getElementById("previousWord")
.addEventListener("click", () => moveCurrentWord(-1));

document
.getElementById("nextWord")
.addEventListener("click", () => moveCurrentWord(1));

document
.getElementById("nudgeCurrentBack")
.addEventListener("click", () => nudgeCurrentWord(-100));

document
.getElementById("nudgeCurrentForward")
.addEventListener("click", () => nudgeCurrentWord(100));

document
.getElementById("goCurrentWord")
.addEventListener("click", () => {
    const item =
        getCurrentWordItem();

    const word =
        item && project.lines[item.line]?.words[item.word];

    if(
        word &&
        Number.isFinite(Number(word.time))
    ){
        audio.currentTime =
            Number(word.time) / 1000;
    }
});

document
.getElementById("setStartOffset")
.addEventListener("click", () => {
    project.startOffset =
        Math.round(audio.currentTime * 1000);
    startOffset.value =
        project.startOffset;
    setStatus("Punto di partenza aggiornato");
});

document
.getElementById("goStartOffset")
.addEventListener("click", () => {
    audio.currentTime =
        Number(startOffset.value || 0) / 1000;
});

startOffset.addEventListener("input", () => {
    project.startOffset =
        Math.max(
            0,
            Math.round(Number(startOffset.value || 0))
        );
});

songSelect.addEventListener("change", () => {
    loadSong(songSelect.value);
});

audio.addEventListener("timeupdate", () => {
    highlightCurrentWord(
        Math.round(audio.currentTime * 1000)
    );
});

lyricsText.addEventListener("input", () => {
    updateTextStats();
});

document.addEventListener("keydown", event => {

    if(event.code !== "Space"){
        return;
    }

    const tag =
        document.activeElement &&
        document.activeElement.tagName;

    if(
        tag === "TEXTAREA" ||
        tag === "INPUT" ||
        tag === "SELECT"
    ){
        return;
    }

    event.preventDefault();
    syncCurrentWord(
        Math.round(audio.currentTime * 1000)
    );

});

async function loadSongs(){

    const response =
        await fetch("/api/songs");

    const songs =
        await response.json();

    songSelect.innerHTML =
        songs.map(song =>
            `<option value="${escapeHtml(song)}">${escapeHtml(song)}</option>`
        ).join("");

    if(songs.length > 0){
        loadSong(songs[0]);
    }

}

async function importSongForEditing(){

    if(
        !ipcRenderer ||
        typeof ipcRenderer.invoke !== "function"
    ){
        setStatus("Import disponibile dalla finestra Electron");
        return;
    }

    const files =
        await ipcRenderer.invoke("select-mp3-files");

    if(!files || files.length === 0){
        return;
    }

    setStatus("Importazione brano...");

    const result =
        await ipcRenderer.invoke(
            "import-mp3-files",
            files
        );

    const imported =
        Array.isArray(result)
        ? result
        : result.imported || [];

    if(imported.length === 0){
        setStatus("Nessun brano importato");
        return;
    }

    await loadSongs();

    songSelect.value =
        imported[0];

    await loadSong(imported[0]);
    setStatus("Brano importato e pronto per l'editor");

}

async function loadSong(song){

    if(!song){
        return;
    }

    audio.src =
        "/music/" + encodeURIComponent(song);

    const response =
        await fetch(
            "/api/karaoke-project?name=" +
            encodeURIComponent(song)
        );

    const data =
        await response.json();

    if(data.hasProject){

        project =
            data.project;

        setStatus("Progetto caricato");

    }else{

        project =
            await loadProjectFromEmbeddedLyrics(song);

    }

    project.song = song;
    project.lines =
        Array.isArray(project.lines)
        ? project.lines
        : [];

    startOffset.value =
        project.startOffset || 0;

    lyricsText.value =
        project.lines
        .map(line => line.text || "")
        .join("\n");

    currentSyncIndex = 0;
    renderWords();
    updateWorkflow();

}

async function loadProjectFromEmbeddedLyrics(song){

    const fallbackProject = {
        version: 1,
        song,
        startOffset: 0,
        lines: []
    };

    try {

        const response =
            await fetch(
                "/api/lyrics?name=" +
                encodeURIComponent(song)
            );

        if(!response.ok){
            setStatus("Nessun progetto: incolla il testo e preparalo");
            return fallbackProject;
        }

        const data =
            await response.json();

        if(
            !data.hasLyrics ||
            !Array.isArray(data.lines) ||
            data.lines.length === 0
        ){
            setStatus("Nessun progetto: incolla il testo e preparalo");
            return fallbackProject;
        }

        setStatus(
            "Testo importato dall'MP3: salvalo per modificarlo"
        );

        return {
            version: 1,
            song,
            startOffset: data.startOffset || 0,
            lines: data.lines.map(line => ({
                text: line.text || "",
                time: Number.isFinite(Number(line.time))
                    ? Math.round(Number(line.time))
                    : null,
                words:
                    Array.isArray(line.words) &&
                    line.words.length > 0
                    ? line.words.map(word => ({
                        text: word.text || "",
                        time: Number.isFinite(Number(word.time))
                            ? Math.round(Number(word.time))
                            : null
                    }))
                    : (
                        String(line.text || "")
                        .match(/\S+/g)
                        ?.map(word => ({
                            text: word,
                            time: Number.isFinite(Number(line.time))
                                ? Math.round(Number(line.time))
                                : null
                        })) || []
                    )
            }))
        };

    } catch(err) {

        setStatus("Nessun progetto: incolla il testo e preparalo");
        return fallbackProject;

    }

}

function textToLines(text){

    return String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(lineText => ({
            text: lineText,
            time: null,
            words: lineText
                .match(/\S+/g)
                ?.map(word => ({
                    text: word,
                    time: null
                })) || []
        }));

}

function mergeTextWithExistingSync(text, oldLines){

    const newLines =
        textToLines(text);

    newLines.forEach((line, lineIndex) => {

        const oldLine =
            oldLines[lineIndex];

        if(!oldLine){
            return;
        }

        line.time =
            Number.isFinite(Number(oldLine.time))
            ? Math.round(Number(oldLine.time))
            : null;

        line.words.forEach((word, wordIndex) => {

            const oldWord =
                oldLine.words &&
                oldLine.words[wordIndex];

            if(
                oldWord &&
                Number.isFinite(Number(oldWord.time))
            ){
                word.time =
                    Math.round(Number(oldWord.time));
            }

        });

    });

    return newLines;

}

function renderWords(){

    wordsBox.innerHTML = "";
    updateWorkflow();

    if(project.lines.length === 0){
        wordsBox.innerHTML =
            '<div class="hint">Nessun testo preparato.</div>';
        return;
    }

    project.lines.forEach((line, lineIndex) => {

        const lineDiv =
        document.createElement("div");

        lineDiv.className =
        "line";

        const header =
        document.createElement("div");

        header.className =
        "lineHeader";

        header.innerHTML =
            `<span>Riga ${lineIndex + 1}</span>` +
            `<span>${formatMs(getLineTime(line))}</span>`;

        lineDiv.appendChild(header);

        line.words.forEach((word, wordIndex) => {

            const span =
            document.createElement("span");

            span.className =
            "word";

            if(Number.isFinite(Number(word.time))){
                span.classList.add("synced");
            }

            const flatIndex =
                getFlatIndex(lineIndex, wordIndex);

            if(flatIndex === currentSyncIndex){
                span.classList.add("target");
            }

            span.dataset.line =
                lineIndex;

            span.dataset.word =
                wordIndex;

            span.textContent =
                word.text;

            span.addEventListener("click", event => {
                event.preventDefault();
                currentSyncIndex = flatIndex;
                renderWords();
            });

            lineDiv.appendChild(span);

        });

        wordsBox.appendChild(lineDiv);

    });

}

function syncCurrentWord(time){

    const item =
        getCurrentWordItem();

    if(!item){
        setStatus("Nessuna parola da sincronizzare");
        return;
    }

    const word =
        project.lines[item.line]?.words[item.word];

    if(!word){
        setStatus("Nessuna parola da sincronizzare");
        return;
    }

    word.time =
        time;

    updateLineTimes();

    const syncedText =
        word.text;

    moveCurrentWord(1, false);
    renderWords();
    scrollTargetIntoView();

    setStatus(
        `"${syncedText}" sincronizzata a ` +
        formatMs(time)
    );

}

function moveCurrentWord(delta, rerender = true){

    const flat =
        flattenWords();

    if(flat.length === 0){
        currentSyncIndex = 0;
        if(rerender){
            renderWords();
        }
        return;
    }

    currentSyncIndex =
        Math.max(
            0,
            Math.min(
                flat.length - 1,
                currentSyncIndex + delta
            )
        );

    if(rerender){
        renderWords();
        scrollTargetIntoView();
    }

}

function nudgeCurrentWord(delta){

    const item =
        getCurrentWordItem();

    const word =
        item && project.lines[item.line]?.words[item.word];

    if(
        !word ||
        !Number.isFinite(Number(word.time))
    ){
        setStatus("La parola corrente non ha ancora un tempo");
        return;
    }

    word.time =
        Math.max(
            0,
            Math.round(Number(word.time) + delta)
        );

    updateLineTimes();
    renderWords();
    scrollTargetIntoView();
    setStatus(
        delta > 0
        ? "Parola ritardata"
        : "Parola anticipata"
    );

}

function getCurrentWordItem(){

    const flat =
        flattenWords();

    if(flat.length === 0){
        return null;
    }

    currentSyncIndex =
        Math.max(
            0,
            Math.min(
                flat.length - 1,
                currentSyncIndex
            )
        );

    return flat[currentSyncIndex];

}

async function saveProject(){

    project.startOffset =
        Math.max(
            0,
            Math.round(Number(startOffset.value || 0))
        );

    const response =
        await fetch(
            "/api/karaoke-project?name=" +
            encodeURIComponent(project.song),
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(project)
            }
        );

    if(!response.ok){
        setStatus("Errore nel salvataggio");
        return false;
    }

    const data =
        await response.json();

    project =
        data.project;

    renderWords();
    setStatus("Progetto salvato");
    return true;

}

async function exportProject(){

    const saved =
        await saveProject();

    if(!saved){
        return;
    }

    if(
        ipcRenderer &&
        typeof ipcRenderer.invoke === "function"
    ){

        const result =
            await ipcRenderer.invoke(
                "export-karaoke-project",
                {
                    song: project.song,
                    project,
                    format: exportFormat.value
                }
            );

        if(result && result.canceled){
            setStatus("Esportazione annullata");
            return;
        }

        if(result && result.error){
            setStatus(result.error);
            return;
        }

        setStatus(result && result.message || "Export completato");
        return;

    }

    const response =
        await fetch(
            "/api/karaoke-export?name=" +
            encodeURIComponent(project.song),
            { method: "POST" }
        );

    if(!response.ok){
        setStatus("Errore durante l'esportazione");
        return;
    }

    const data =
        await response.json();

    setStatus(
        "Esportato in: " +
        data.folder
    );

}

function updateLineTimes(){

    project.lines.forEach(line => {

        const times =
            line.words
            .map(word => Number(word.time))
            .filter(time => Number.isFinite(time));

        line.time =
            times.length > 0
            ? Math.min(...times)
            : null;

    });

}

function highlightCurrentWord(time){

    document
    .querySelectorAll(".word.current")
    .forEach(word =>
        word.classList.remove("current")
    );

    let current = null;

    flattenWords().forEach(item => {
        const word =
            project.lines[item.line]?.words[item.word];

        const wordTime =
            Number(word && word.time);

        if(
            Number.isFinite(wordTime) &&
            wordTime <= time
        ){
            current = item;
        }
    });

    if(!current){
        return;
    }

    const element =
        wordsBox.querySelector(
            `[data-line="${current.line}"][data-word="${current.word}"]`
        );

    if(element){
        element.classList.add("current");
    }

}

function flattenWords(){

    const flat = [];

    project.lines.forEach((line, lineIndex) => {
        line.words.forEach((word, wordIndex) => {
            flat.push({
                line: lineIndex,
                word: wordIndex
            });
        });
    });

    return flat;

}

function getLineTime(line){

    if(Number.isFinite(Number(line.time))){
        return Number(line.time);
    }

    const times =
        (line.words || [])
        .map(word => Number(word.time))
        .filter(time => Number.isFinite(time));

    return times.length > 0
        ? Math.min(...times)
        : null;

}

function getFlatIndex(line, word){

    return flattenWords()
        .findIndex(item =>
            item.line === line &&
            item.word === word
        );

}

function scrollTargetIntoView(){

    const target =
        wordsBox.querySelector(".word.target");

    if(target){
        target.scrollIntoView({
            block: "center",
            behavior: "smooth"
        });
    }

}

function formatMs(ms){

    if(!Number.isFinite(Number(ms))){
        return "--:--";
    }

    const total =
        Math.max(0, Math.round(Number(ms) / 1000));

    const minutes =
        Math.floor(total / 60);

    const seconds =
        String(total % 60).padStart(2, "0");

    return minutes + ":" + seconds;

}

function getSyncStats(){

    const words =
        flattenWords();

    const synced =
        words.filter(item => {
            const word =
                project.lines[item.line]?.words[item.word];

            return Number.isFinite(
                Number(word && word.time)
            );
        }).length;

    return {
        total: words.length,
        synced,
        percent:
            words.length > 0
            ? Math.round((synced / words.length) * 100)
            : 0
    };

}

function updateTextStats(){

    const lines =
        textToLines(lyricsText.value);

    const wordCount =
        lines.reduce(
            (total, line) =>
                total + line.words.length,
            0
        );

    textStats.textContent =
        lines.length + " righe · " +
        wordCount + " parole";

    textStep.textContent =
        lines.length > 0
        ? "Testo presente"
        : "Da preparare";

}

function updateWorkflow(){

    updateTextStats();

    const stats =
        getSyncStats();

    songStep.textContent =
        project.song || "Seleziona MP3";

    syncStep.textContent =
        stats.total > 0
        ? stats.percent + "%"
        : "0%";

    syncSummary.textContent =
        stats.total > 0
        ? stats.synced + " di " + stats.total + " parole sincronizzate"
        : "Premi play e usa la barra spaziatrice";

    exportStep.textContent =
        stats.percent === 100
        ? "Pronto"
        : "Sync consigliata";

    const steps =
        document.querySelectorAll(".step");

    const activeIndex =
        !project.song
        ? 0
        : (
            project.lines.length === 0
            ? 1
            : (
                stats.percent < 100
                ? 2
                : 3
            )
        );

    steps.forEach((step, index) => {
        step.classList.toggle(
            "active",
            index === activeIndex
        );
    });

    steps[0]?.classList.toggle(
        "done",
        !!project.song
    );

    steps[1]?.classList.toggle(
        "done",
        project.lines.length > 0
    );

    steps[2]?.classList.toggle(
        "done",
        stats.percent === 100 &&
        stats.total > 0
    );

    steps[3]?.classList.toggle(
        "done",
        stats.synced > 0
    );

}

function setStatus(message){

    statusBox.textContent =
        message || "";

}

function escapeHtml(text){

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}
