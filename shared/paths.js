const path = require("path");
const os = require("os");

const APP_FOLDER =
    process.env.GIORGIO_APP_FOLDER ||
    process.env.FANTASPOSI_DATA_DIR ||
    path.join(
        os.homedir(),
        "Documents",
        "Giorgio Remote Player"
    );

const MUSIC_FOLDER = path.join(
    APP_FOLDER,
    "Libreria"
);

function resolveLibraryFile(fileName) {

    if (
        typeof fileName !== "string" ||
        fileName.trim() === ""
    ) {
        return null;
    }

    const musicRoot =
        path.resolve(MUSIC_FOLDER);

    const filePath =
        path.resolve(
            MUSIC_FOLDER,
            fileName
        );

    if (
        filePath !== musicRoot &&
        !filePath.startsWith(
            musicRoot + path.sep
        )
    ) {
        return null;
    }

    return filePath;

}

module.exports = {
    APP_FOLDER,
    MUSIC_FOLDER,
    resolveLibraryFile
};
