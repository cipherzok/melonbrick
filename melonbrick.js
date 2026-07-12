window.melonbrick = {}
melonbrick.scope = {};

const definedRoot = {}

melonbrick.constructors = {}

const waitingReference = {};
const waitingConstructor = {};
const listeningRoots = [];

melonbrick.waitReference = function (name, callback) {
    if (!waitingReference[name]) waitingReference[name] = [];
    waitingReference[name].push(callback);
}

melonbrick.waitConstructor = function (name, callback) {
    if (!waitingConstructor[name]) waitingConstructor[name] = [];
    waitingConstructor[name].push(callback);
}

melonbrick.listenRoots = function (callback) {
    listeningRoots.push(callback);
}
function registerReference(name, reference) {
    const parts = name.split(".");
    const root = parts[0];

    if (parts.length === 1) {
        melonbrick.scope[root] = reference;
    } else {
        let current = melonbrick.scope;

        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]] ??= {};
        }

        current[parts.at(-1)] = reference;
    }

    if (!definedRoot[root]) {
        definedRoot[root] = true;
        for (const callback of listeningRoots) callback(root);
    }
}

function referenceDefined(name, reference) {
    registerReference(name, reference);
    if (waitingReference[name]) {
        for (const callback of waitingReference[name]) callback();
    }
}

function constructorDefined(name, constructor) {
    if (waitingConstructor[name]) {
        for (const callback of waitingConstructor[name]) callback();
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