const fs = require("fs");
const path = require("path");
const {
    APP_FOLDER
} = require("./paths");

const SETTINGS_FILE =
    path.join(
        APP_FOLDER,
        "settings.json"
    );

const DEFAULT_PUBLIC_SCREEN_SETTINGS = {
    karaokeHighlightColor: "#0608d1",
    karaokeShowNextLine: true,
    karaokeFontFamily: "System"
};

const ALLOWED_FONTS = [
    "System",
    "Arial",
    "Verdana",
    "Georgia",
    "Courier New"
];

function normalisePublicScreenSettings(settings) {

    const data =
        settings && typeof settings === "object"
        ? settings
        : {};

    return {
        karaokeHighlightColor:
            typeof data.karaokeHighlightColor === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(data.karaokeHighlightColor)
            ? data.karaokeHighlightColor.toLowerCase()
            : DEFAULT_PUBLIC_SCREEN_SETTINGS.karaokeHighlightColor,

        karaokeShowNextLine:
            data.karaokeShowNextLine !== false,

        karaokeFontFamily:
            data.karaokeFontFamily === "Inter" ||
            data.karaokeFontFamily === "Montserrat"
            ? "System"
            : (
                ALLOWED_FONTS.includes(data.karaokeFontFamily)
                ? data.karaokeFontFamily
                : DEFAULT_PUBLIC_SCREEN_SETTINGS.karaokeFontFamily
            )
    };

}

function loadSettings() {

    try {

        const raw =
            fs.readFileSync(
                SETTINGS_FILE,
                "utf8"
            );

        return JSON.parse(raw);

    } catch(err) {

        return {};

    }

}

function saveSettings(settings) {

    fs.mkdirSync(
        APP_FOLDER,
        { recursive: true }
    );

    fs.writeFileSync(
        SETTINGS_FILE,
        JSON.stringify(settings, null, 2),
        "utf8"
    );

}

function loadPublicScreenSettings() {

    return normalisePublicScreenSettings(
        loadSettings().publicScreen
    );

}

function savePublicScreenSettings(settings) {

    const current =
        loadSettings();

    current.publicScreen =
        normalisePublicScreenSettings(settings);

    saveSettings(current);

    return current.publicScreen;

}

module.exports = {
    DEFAULT_PUBLIC_SCREEN_SETTINGS,
    loadPublicScreenSettings,
    savePublicScreenSettings
};
