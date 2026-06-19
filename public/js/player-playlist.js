function createPlaylistController(options){

    const socket =
        options.socket;

    const elements =
        options.elements;

    const getCurrentSong =
        options.getCurrentSong;

    const getFilePath =
        options.getFilePath;

    const isImportableMediaFile =
        options.isImportableMediaFile;

    const importFiles =
        options.importFiles;

    const beforePlay =
        options.beforePlay || (() => {});

    let playlist = [];
    let selectedIndex = -1;
    let draggedIndex = -1;

    function setPlaylist(nextPlaylist){

        playlist =
            Array.isArray(nextPlaylist)
            ? nextPlaylist
            : [];

        if(selectedIndex >= playlist.length){
            selectedIndex = -1;
        }

        render();

    }

    function setCurrentSong(){

        render();

    }

    function getSelectedSong(){

        return playlist[selectedIndex] || "";

    }

    function clear(){

        playlist = [];
        selectedIndex = -1;
        resetDropZoneMessage();
        socket.emit("clearPlaylist");
        render();

    }

    async function importToPlaylist(files){

        if(!importFiles){
            setDropZoneMessage(
                "Import disponibile nella finestra Electron"
            );
            return;
        }

        setDropZoneMessage(
            "Importazione in corso..."
        );

        const result =
            await importFiles(files);

        const imported =
            Array.isArray(result)
            ? result
            : result.imported || [];

        const failed =
            Array.isArray(result)
            ? []
            : result.failed || [];

        if(!imported || imported.length === 0){

            setDropZoneMessage(
                "Nessun brano importato" +
                renderImportErrorsText(failed)
            );

            return;
        }

        playlist =
            playlist.concat(imported);

        socket.emit(
            "setPlaylist",
            playlist
        );

        socket.emit("libraryChanged");
        render();
        resetDropZoneMessage();

    }

    function render(){

        elements.playlist.innerHTML = "";
        updateSummary();

        if(playlist.length === 0){
            elements.playlist.textContent =
                "Scaletta vuota";
            return;
        }

        playlist.forEach((song, index) => {

            const item =
                document.createElement("div");

            item.className =
                "playlistItem";

            if(index === selectedIndex){
                item.classList.add("selected");
            }

            if(song === getCurrentSong()){
                item.classList.add("playing");
            }

            item.draggable = true;

            item.addEventListener("click", () => {

                selectedIndex = index;
                render();

            });

            item.addEventListener("dragstart", () => {

                draggedIndex = index;
                item.classList.add("dragging");

            });

            item.addEventListener("dragend", () => {

                draggedIndex = -1;
                item.classList.remove("dragging");

            });

            item.addEventListener("dragover", (event) => {

                event.preventDefault();

            });

            item.addEventListener("drop", (event) => {

                event.preventDefault();

                if(
                    draggedIndex < 0 ||
                    draggedIndex === index
                ){
                    return;
                }

                moveItem(draggedIndex, index);

            });

            const title =
                document.createElement("span");

            title.textContent =
                `${index + 1}. ${song}`;

            const play =
                document.createElement("button");

            play.textContent = "▶";
            play.onclick = (event) => {
                event.stopPropagation();
                beforePlay();
                socket.emit("play", song);
            };

            const queue =
                document.createElement("button");

            queue.textContent = "➕";
            queue.onclick = (event) => {
                event.stopPropagation();
                socket.emit("addToQueue", song);
            };

            const remove =
                document.createElement("button");

            remove.textContent = "✕";
            remove.onclick = (event) => {
                event.stopPropagation();
                removeItem(index);
            };

            item.appendChild(title);
            item.appendChild(play);
            item.appendChild(queue);
            item.appendChild(remove);

            elements.playlist.appendChild(item);

        });

    }

    function updateSummary(){

        elements.stats.textContent =
            playlist.length === 1
            ? "1 brano"
            : playlist.length + " brani";

        const currentIndex =
            playlist.indexOf(getCurrentSong());

        const next =
            currentIndex >= 0 &&
            currentIndex + 1 < playlist.length
            ? playlist[currentIndex + 1]
            : (
                selectedIndex >= 0 &&
                selectedIndex + 1 < playlist.length
                ? playlist[selectedIndex + 1]
                : ""
            );

        elements.nextSong.textContent =
            next
            ? "Prossimo: " + next
            : "Prossimo: nessun brano";

    }

    function moveItem(from, to){

        if(
            to < 0 ||
            to >= playlist.length
        ){
            return;
        }

        const item =
            playlist.splice(from, 1)[0];

        playlist.splice(to, 0, item);
        selectedIndex = to;

        socket.emit(
            "movePlaylistItem",
            { from, to }
        );

        render();

    }

    function removeItem(index){

        playlist.splice(index, 1);

        if(selectedIndex === index){
            selectedIndex = -1;
        }else if(selectedIndex > index){
            selectedIndex--;
        }

        socket.emit(
            "removeFromPlaylist",
            index
        );

        render();

    }

    function renderImportErrorsText(failed){

        if(!failed || failed.length === 0){
            return "";
        }

        return "\n" +
            failed.map(item =>
                (
                    item.file ||
                    "File sconosciuto"
                ) +
                " - " +
                (
                    item.error ||
                    "Errore"
                )
            ).join("\n");

    }

    function setDropZoneMessage(message){

        elements.dropZone.textContent =
            message;

    }

    function resetDropZoneMessage(){

        elements.dropZone.textContent =
            "Rilascia MP3 o MP4 qui";

    }

    function bindEvents(){

        elements.clearButton.addEventListener(
            "click",
            () => {

                if(
                    playlist.length > 0 &&
                    !confirm("Vuoi svuotare la scaletta?")
                ){
                    return;
                }

                clear();

            }
        );

        elements.playButton.addEventListener("click", () => {

            const song =
                getSelectedSong();

            if(song){
                beforePlay();
                socket.emit("play", song);
            }

        });

        elements.queueButton.addEventListener("click", () => {

            const song =
                getSelectedSong();

            if(song){
                socket.emit("addToQueue", song);
            }

        });

        elements.dropZone.addEventListener("dragover", (event) => {

            event.preventDefault();
            elements.dropZone.classList.add("dragOver");

        });

        elements.dropZone.addEventListener("dragleave", () => {

            elements.dropZone.classList.remove("dragOver");

        });

        elements.dropZone.addEventListener("drop", async (event) => {

            event.preventDefault();
            elements.dropZone.classList.remove("dragOver");

            const files =
                Array.from(event.dataTransfer.files)
                .map(file => getFilePath(file))
                .filter(file =>
                    file &&
                    isImportableMediaFile(file)
                );

            if(files.length === 0){
                setDropZoneMessage(
                    "Trascina solo file MP3 o MP4"
                );
                return;
            }

            await importToPlaylist(files);

        });

    }

    bindEvents();
    render();

    return {
        clear,
        importToPlaylist,
        render,
        setCurrentSong,
        setPlaylist
    };

}
