window.melonbrick = {}

const waitingReference = {};

melonbrick.waitReference = function (name, callback) {
    if (!waitingReference[name]) waitingReference[name] = [];
    waitingReference[name].push(callback);
}

function referenceDefined(name) {
    if (waitingReference[name]) {
        for (const callback of waitingReference[name]) callback();
    }
}

async function loadMods() {
    const res = await fetch("mods.json");
    const text = await res.text();
    const modFolders = JSON.parse(text);
    for (const folder of modFolders) {
        await import("./mods/" + folder + "/main.js");
    }
    lime.embed("Mine Blocks", "content", 0, 0);
}

loadMods();