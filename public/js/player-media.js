function createMediaController(options){

    const socket =
        options.socket;

    const elements =
        options.elements;

    const loadLyrics =
        options.loadLyrics;

    const clearLyrics =
        options.clearLyrics;

    const updateLyrics =
        options.updateLyrics;

    const onCurrentSongChange =
        options.onCurrentSongChange;

    const onCrossfadeComplete =
        options.onCrossfadeComplete || (() => {});

    const audio =
        elements.audio;

    const nextAudio =
        elements.nextAudio;

    let currentSong = "";
    let currentStartOffset = 0;
    let isCrossfading = false;
    let lastPlaybackTimeEmit = 0;
    let currentPlaybackRate = 1;
    let currentPitchShift = 0;
    let rubberBandEngine = null;
    let rubberBandReady = false;
    let rubberBandLoadPromise = null;
    let rubberBandError = "";
    let audioUnlocked = false;

    function bindEvents(){

        document.addEventListener(
            "touchstart",
            unlockAudio,
            { once: true }
        );

        audio.addEventListener("loadedmetadata", () => {

            elements.totalTime.textContent =
                formatTime(audio.duration);

        });

        audio.addEventListener("timeupdate", () => {

            elements.currentTime.textContent =
                formatTime(audio.currentTime);

            elements.progress.value =
                (audio.currentTime / audio.duration) * 100;

            const now =
                Date.now();

            if(now - lastPlaybackTimeEmit > 250){

                lastPlaybackTimeEmit = now;
                emitPlaybackTime();

            }

            updateLyrics(
                Math.round(getActivePlaybackTime() * 1000)
            );

        });

        audio.addEventListener("pause", emitPlaybackTime);
        audio.addEventListener("play", emitPlaybackTime);
        audio.addEventListener("ended", emitPlaybackTime);

    }

    async function unlockAudio(){

        if(audioUnlocked){
            return;
        }

        try {

            audio.volume = 0;
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
            audio.volume =
                elements.volume.value / 100;

            audioUnlocked = true;

            console.log("Audio sbloccato");

        } catch(err) {

            console.log(err);

        }

    }

    function applyStatus(state){

        if(!state){
            return;
        }

        setCurrentSong(
            state.currentSong || "",
            false
        );

        if(Number.isFinite(Number(state.volume))){
            setVolume(Number(state.volume), false);
        }

        setPlaybackRate(
            state.playbackRate || 1,
            false
        );

    }

    async function playSong(song){

        if(isCrossfading){
            return;
        }

        if(!audio.paused){

            audio.volume =
                audio.volume * 0.3;

            await new Promise(resolve =>
                setTimeout(resolve, 150)
            );

        }

        audio.pause();
        audio.currentTime = 0;

        setCurrentSong(song, true);

        currentStartOffset =
            await loadLyrics(song);

        audio.src =
            "/music/" + encodeURIComponent(song);

        applyPlaybackRate();
        audio.load();

        await waitForMediaReady(audio);

        await ensureRubberBandEngine();
        setPitchShift(currentPitchShift);

        if(currentStartOffset > 0){
            audio.currentTime =
                currentStartOffset / 1000;
        }

        audio.volume =
            elements.volume.value / 100;

        const playPromise =
            audio.play();

        if(playPromise && typeof playPromise.catch === "function"){
            await playPromise.catch(() => {});
        }

    }

    async function crossfadeToSong(song, duration){

        if(isCrossfading){
            return;
        }

        isCrossfading = true;

        preloadNextSong(song);
        await waitForMediaReady(nextAudio);
        await ensureRubberBandEngine();
        await connectNextAudioToRubberBand();

        setCurrentSong(song, false);

        currentStartOffset =
            await loadLyrics(song);

        nextAudio.currentTime =
            Math.max(0, currentStartOffset / 1000);

        nextAudio.volume = 0;

        const playPromise =
            nextAudio.play();

        if(playPromise && typeof playPromise.catch === "function"){
            await playPromise.catch(() => {});
        }

        const startVolume =
            audio.volume;

        const targetVolume =
            elements.volume.value / 100;

        await animateCrossfade(
            Math.max(500, duration),
            progress => {
                audio.volume =
                    startVolume * (1 - progress);
                nextAudio.volume =
                    targetVolume * progress;
                emitPlaybackTime();
                updateLyrics(
                    Math.round(nextAudio.currentTime * 1000)
                );
            }
        );

        await handoffNextAudioToMain(song, targetVolume);

        isCrossfading = false;
        onCrossfadeComplete();
        emitPlaybackTime();

    }

    function stop(){

        isCrossfading = false;
        audio.pause();
        nextAudio.pause();

        audio.currentTime = 0;
        nextAudio.currentTime = 0;

        setCurrentSong("", true);
        clearLyrics();
        setPitchShift(0);
        emitPlaybackTime();

    }

    function seekByProgress(percent){

        audio.currentTime =
            (percent / 100) * audio.duration;

    }

    function setVolume(value, notifyServer){

        const nextVolume =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(value || 0)
                )
            );

        audio.volume =
            nextVolume;

        elements.volume.value =
            Math.round(nextVolume * 100);

        if(notifyServer){
            socket.emit(
                "setVolume",
                nextVolume
            );
        }

    }

    function setPlaybackRate(rate, notifyServer){

        currentPlaybackRate =
            Math.max(
                0.8,
                Math.min(
                    1.2,
                    Number(rate || 1)
                )
            );

        elements.tempoControl.value =
            Math.round(currentPlaybackRate * 100);

        elements.tempoValue.textContent =
            Math.round(currentPlaybackRate * 100) + "%";

        applyPlaybackRate();

        if(notifyServer){
            socket.emit(
                "setPlaybackRate",
                currentPlaybackRate
            );
            emitPlaybackTime();
        }

    }

    async function changePitch(delta){

        const nextPitch =
            currentPitchShift + delta;

        setPitchShift(nextPitch);

        const engine =
            await ensureRubberBandEngine();

        if(!engine){
            updatePitchStatus();
            return;
        }

        setPitchShift(currentPitchShift);

    }

    function setPitchShift(shift){

        currentPitchShift =
            Math.max(
                -6,
                Math.min(
                    6,
                    Number(shift || 0)
                )
            );

        elements.pitchValue.textContent =
            currentPitchShift > 0
            ? "+" + currentPitchShift
            : String(currentPitchShift);

        if(rubberBandEngine){
            rubberBandEngine.setPitchShift(currentPitchShift);
        }

        applyPlaybackRate();
        updatePitchStatus();

    }

    function updatePitchStatus(){

        if(currentPitchShift === 0){
            elements.pitchValue.title =
                "Tonalità originale";
            return;
        }

        elements.pitchValue.title =
            rubberBandReady
            ? "Tonalità applicata con Rubber Band"
            : rubberBandError || "Tonalità non disponibile";

    }

    function preloadNextSong(song){

        const source =
            "/music/" + encodeURIComponent(song);

        if(nextAudio.getAttribute("src") === source){
            return;
        }

        nextAudio.pause();
        nextAudio.src = source;
        nextAudio.currentTime = 0;
        nextAudio.volume = 0;
        applyPlaybackRate();
        nextAudio.load();

    }

    function waitForMediaReady(media){

        if(media.readyState >= 1){
            return Promise.resolve();
        }

        return new Promise(resolve => {
            media.addEventListener(
                "loadedmetadata",
                resolve,
                { once: true }
            );
        });

    }

    function animateCrossfade(duration, onFrame){

        const startedAt =
            performance.now();

        return new Promise(resolve => {

            function frame(now){

                const progress =
                    Math.min(
                        1,
                        (now - startedAt) / duration
                    );

                onFrame(progress);

                if(progress < 1){
                    requestAnimationFrame(frame);
                }else{
                    resolve();
                }

            }

            requestAnimationFrame(frame);

        });

    }

    async function handoffNextAudioToMain(song, targetVolume){

        audio.pause();
        audio.src =
            "/music/" + encodeURIComponent(song);
        applyPlaybackRate();
        audio.load();

        await waitForMediaReady(audio);

        audio.currentTime =
            Math.max(0, nextAudio.currentTime);
        audio.volume =
            targetVolume;

        const playPromise =
            audio.play();

        if(playPromise && typeof playPromise.catch === "function"){
            await playPromise.catch(() => {});
        }

        audio.currentTime =
            Math.max(0, nextAudio.currentTime);

        nextAudio.pause();
        nextAudio.removeAttribute("src");
        nextAudio.load();

    }

    function applyPlaybackRate(){

        [audio, nextAudio].forEach(media => {

            if(!media){
                return;
            }

            media.playbackRate =
                currentPlaybackRate;

            if("preservesPitch" in media){
                media.preservesPitch = true;
            }

            if("mozPreservesPitch" in media){
                media.mozPreservesPitch = true;
            }

            if("webkitPreservesPitch" in media){
                media.webkitPreservesPitch = true;
            }

        });

    }

    async function ensureRubberBandEngine(){

        if(rubberBandReady){
            if(rubberBandEngine){
                await rubberBandEngine.resume().catch(() => {});
            }
            return rubberBandEngine;
        }

        await loadRubberBandScript();

        const RubberBandEngine =
            getRubberBandEngineConstructor();

        if(!RubberBandEngine){
            rubberBandError =
                "Rubber Band non caricato";
            console.log(rubberBandError);
            updatePitchStatus();
            return null;
        }

        try {

            rubberBandEngine =
                new RubberBandEngine();

            await rubberBandEngine.connect(audio);
            rubberBandEngine.setPitchShift(currentPitchShift);
            await rubberBandEngine.resume();

            rubberBandReady = true;
            rubberBandError = "";
            applyPlaybackRate();
            updatePitchStatus();

            return rubberBandEngine;

        } catch(err) {

            console.log(
                "Rubber Band non disponibile:",
                err.message
            );

            rubberBandEngine = null;
            rubberBandReady = false;
            rubberBandError =
                "Rubber Band non disponibile: " +
                (err && err.message ? err.message : String(err));
            applyPlaybackRate();
            updatePitchStatus();
            return null;

        }

    }

    async function connectNextAudioToRubberBand(){

        const engine =
            await ensureRubberBandEngine();

        if(!engine){
            return;
        }

        try {
            await engine.connect(nextAudio);
            engine.setPitchShift(currentPitchShift);
        } catch(err) {
            console.log(
                "Rubber Band next deck non disponibile:",
                err.message
            );
        }

    }

    function loadRubberBandScript(){

        if(getRubberBandEngineConstructor()){
            return Promise.resolve();
        }

        if(rubberBandLoadPromise){
            return rubberBandLoadPromise;
        }

        rubberBandLoadPromise =
            new Promise(resolve => {

                const script =
                    document.createElement("script");

                script.src =
                    "/js/rubberband-engine.js?v=" +
                    Date.now();

                script.onload =
                    () => resolve();

                script.onerror =
                    () => resolve();

                document.head.appendChild(script);

            });

        return rubberBandLoadPromise;

    }

    function getRubberBandEngineConstructor(){

        return window.GiorgioRubberBandEngine ||
            globalThis.GiorgioRubberBandEngine;

    }

    function getActivePlaybackMedia(){

        return isCrossfading
            ? nextAudio
            : audio;

    }

    function getActivePlaybackTime(){

        const media =
            getActivePlaybackMedia();

        return Number.isFinite(media.currentTime)
            ? media.currentTime
            : 0;

    }

    function getActivePlaybackDuration(){

        const media =
            getActivePlaybackMedia();

        return Number.isFinite(media.duration)
            ? media.duration
            : 0;

    }

    function emitPlaybackTime(){

        if(!currentSong){
            return;
        }

        socket.emit(
            "playbackTime",
            {
                song: currentSong,
                currentTime: Math.round(
                    getActivePlaybackTime() * 1000
                ),
                duration: Number.isFinite(getActivePlaybackDuration())
                ? Math.round(getActivePlaybackDuration() * 1000)
                : 0,
                playbackRate: currentPlaybackRate,
                isPlaying:
                    !getActivePlaybackMedia().paused &&
                    !getActivePlaybackMedia().ended
            }
        );

    }

    function setCurrentSong(song, shouldRenderPlaylist){

        currentSong =
            song || "";

        elements.currentSong.innerText =
            currentSong || "Nessun brano";

        onCurrentSongChange(
            currentSong,
            shouldRenderPlaylist
        );

    }

    function formatTime(seconds){

        const min =
            Math.floor(seconds / 60);

        const sec =
            Math.floor(seconds % 60);

        return `${min}:${sec
            .toString()
            .padStart(2,"0")}`;

    }

    bindEvents();

    return {
        applyStatus,
        changePitch,
        crossfadeToSong,
        emitPlaybackTime,
        ensureRubberBandEngine,
        getActivePlaybackTime,
        getCurrentSong: () => currentSong,
        isCrossfading: () => isCrossfading,
        playSong,
        seekByProgress,
        setPlaybackRate,
        setVolume,
        stop
    };

}
