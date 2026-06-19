function createLyricsPreviewController(options){

    const socket =
        options.socket;

    const box =
        options.box;

    const offsetInput =
        options.offsetInput;

    const offsetValue =
        options.offsetValue;

    const getCurrentTimeMs =
        options.getCurrentTimeMs;

    let lines = [];
    let activeCdgRenderer = null;
    let displayMode = "lyrics";
    let activeLineIndex = -1;
    let activeWordKey = "";
    let currentOffset = 0;
    let currentSong = "";

    async function load(song){

        currentSong = song || "";
        lines = [];
        activeLineIndex = -1;
        activeWordKey = "";
        clearCdgPreview();

        if(!song){
            clear();
            return 0;
        }

        box.textContent =
            "Caricamento testo...";

        try {

            const cdgLoaded =
                await loadCdgPreview(song);

            if(cdgLoaded){
                return 0;
            }

            const response =
                await fetch(
                    "/api/lyrics?name=" +
                    encodeURIComponent(song)
                );

            if(!response.ok){
                clear();
                return 0;
            }

            const data =
                await response.json();

            const startOffset =
                Number.isFinite(Number(data.startOffset))
                ? Math.max(0, Math.round(Number(data.startOffset)))
                : 0;

            if(
                currentSong !== song ||
                !data.hasLyrics ||
                !Array.isArray(data.lines) ||
                data.lines.length === 0
            ){
                clear();
                return startOffset;
            }

            lines =
                data.lines;

            renderLines();
            return startOffset;

        } catch(err) {

            clear();
            return 0;

        }

    }

    function clear(){

        currentSong = "";
        lines = [];
        activeLineIndex = -1;
        activeWordKey = "";
        clearCdgPreview();
        box.textContent =
            "Nessun testo caricato";

    }

    async function reloadIfCurrent(song){

        if(song === currentSong){
            return load(song);
        }

        return null;

    }

    function getSong(){

        return currentSong;

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

            if(currentSong !== song){
                return true;
            }

            box.innerHTML =
                '<div class="cdgPreview">' +
                '<canvas width="300" height="216"></canvas>' +
                '</div>';

            const canvas =
                box.querySelector("canvas");

            activeCdgRenderer =
                new CdgRenderer(canvas);

            activeCdgRenderer.load(buffer);
            displayMode = "cdg";
            activeCdgRenderer.renderToTime(
                getCurrentTimeMs()
            );

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
        displayMode = "lyrics";

    }

    function renderLines(){

        box.innerHTML = "";

        lines.forEach((line, index) => {

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

            box.appendChild(div);

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

        let cursor = 0;
        let matchedAnyPart = false;
        let createdWordSpans = false;
        let usedFallbackPart = false;

        words.forEach((word, wordIndex) => {

            const part =
                String(word.text || "");
            let displayPart = part;

            if(fullText && part){

                const match =
                    findLyricsPart(fullText, part, cursor);

                if(match){

                    const gap =
                        fullText.slice(cursor, match.start);

                    if(gap){
                        element.appendChild(
                            document.createTextNode(gap)
                        );
                    }

                    cursor =
                        match.end;

                    displayPart =
                        fullText.slice(match.start, match.end);

                    matchedAnyPart = true;

                }else{
                    usedFallbackPart = true;

                    const needsSpace =
                        element.childNodes.length > 0 &&
                        !/^\s/.test(part);

                    if(needsSpace){
                        element.appendChild(
                            document.createTextNode(" ")
                        );
                    }
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

            const shouldAddGapAfter =
                /\s$/.test(displayPart);

            displayPart =
                displayPart.trim();

            span.textContent =
                displayPart;

            element.appendChild(span);
            createdWordSpans = true;

            if(shouldAddGapAfter){
                element.appendChild(
                    document.createTextNode(" ")
                );
            }

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

    function update(currentTime){

        if(displayMode === "cdg" && activeCdgRenderer){
            activeCdgRenderer.renderToTime(currentTime);
            return;
        }

        if(lines.length === 0){
            return;
        }

        const syncedTime =
            currentTime +
            currentOffset;

        let nextIndex = -1;
        let nextWordIndex = -1;

        for(let i = 0; i < lines.length; i += 1){
            if(lines[i].time <= syncedTime){
                nextIndex = i;
            }else{
                break;
            }
        }

        if(nextIndex >= 0){

            const words =
                Array.isArray(lines[nextIndex].words)
                ? lines[nextIndex].words
                : [];

            for(let i = 0; i < words.length; i += 1){
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
            nextIndex === activeLineIndex &&
            nextWordKey === activeWordKey
        ){
            return;
        }

        activeLineIndex =
            nextIndex;

        activeWordKey =
            nextWordKey;

        box
        .querySelectorAll(".lyricLine")
        .forEach((line, index) => {

            line.classList.toggle(
                "active",
                index === activeLineIndex
            );

            line.classList.toggle(
                "past",
                index < activeLineIndex
            );

        });

        box
        .querySelectorAll(".lyricWord")
        .forEach(word => {

            const lineIndex =
                Number(word.dataset.lineIndex);

            const wordIndex =
                Number(word.dataset.wordIndex);

            word.classList.toggle(
                "sung",
                lineIndex < activeLineIndex ||
                (
                    lineIndex === activeLineIndex &&
                    wordIndex <= nextWordIndex
                )
            );

        });

        const activeLine =
            box.querySelector(
                ".lyricLine.active"
            );

        if(activeLine){
            const targetTop =
                activeLine.offsetTop -
                box.clientHeight / 2 +
                activeLine.clientHeight / 2;

            box.scrollTo({
                top: Math.max(0, targetTop),
                behavior: "smooth"
            });
        }

    }

    function setOffset(offset, notifyServer){

        currentOffset =
            Math.max(
                -5000,
                Math.min(
                    5000,
                    Math.round(offset || 0)
                )
            );

        offsetInput.value =
            currentOffset;

        offsetValue.textContent =
            currentOffset + " ms";

        if(notifyServer){
            socket.emit(
                "setLyricsOffset",
                currentOffset
            );
        }

        update(getCurrentTimeMs());

    }

    return {
        clear,
        getSong,
        load,
        reloadIfCurrent,
        setOffset,
        update
    };

}
