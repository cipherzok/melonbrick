window.melonbrick = {}

melonbrick.version = "2.0.0";

melonbrick.exports = {};

const waitingConstructor = {};
const waitingReference = {};

const eventListeners = {}

melonbrick.listen = function (type, callback) {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(callback)
}

melonbrick.emit = function (event) {
    if (eventListeners[event.type]) {
        for (const callback of eventListeners[event.type]) callback(event);
    }
}

melonbrick.waitReference = function (name, callback) {
    if (!waitingReference[name]) waitingReference[name] = [];
    waitingReference[name].push(callback);
}

melonbrick.waitConstructor = function (name, callback) {
    if (!waitingConstructor[name]) waitingConstructor[name] = [];
    waitingConstructor[name].push(callback);
}

function referenceDefined(name) {
    if (waitingReference[name]) {
        for (const callback of waitingReference[name]) callback();
    }
}

function constructorDefined(name, constructor) {
    if (waitingConstructor[name]) {
        for (const callback of waitingConstructor[name]) constructor = callback(constructor);
    }
    return constructor;
}

const patchedMap = new WeakMap();

function patch(target, name) {
    let func = target;
    if (name) func = target[name];

    if (patchedMap.has(func)) return func;

    const after = [];
    const before = [];

    const patched = function (...args) {
        const ctx = {
            args: [...args],
            returned: undefined,
            hasReturned: false,

            return(value) {
                this.returned = value;
                this.hasReturned = true;
            }
        };

        for (const hook of before) hook.call(this, ctx, ...args);

        if (!ctx.hasReturned) ctx.returned = func.apply(this, ctx.args);

        for (const hook of after) hook.call(this, ctx, ...args);

        return ctx.returned;
    };

    patchedMap.set(patched, { before, after })

    if (name) target[name] = patched;
    return patched;
}

melonbrick.hookBefore = function (target, name, hook) {
    const patched = patch(target, name);
    patchedMap.get(patched).before.push(hook);
}

melonbrick.hookAfter = function (target, name, hook) {
    const patched = patch(target, name);
    patchedMap.get(patched).after.push(hook);
}

melonbrick.getHookBefore = function (func, hook) {
    const patched = patch(func);
    patchedMap.get(patched).before.push(hook);
    return patched;
}

melonbrick.getHookAfter = function (func, hook) {
    const patched = patch(func);
    patchedMap.get(patched).after.push(hook);
    return patched;
}

async function loadMods() {
    const res = await fetch("mods.json");
    const text = await res.text();
    const modFolders = JSON.parse(text);
    for (const id of modFolders) {
        await loadMod(id);
    }
    window.lime.embed("Mine Blocks", "content", 0, 0);
}

async function loadMod(id) {
    if (!loaded[id]) {
        const path = "/mods/" + id + "/";
        const res = await fetch(path + "mod.json");
        const text = await res.text();
        const mod = JSON.parse(text);
        if (!areCompatible(mod.melonbrick, melonbrick.version)) {
            console.log(`Required melonbrick v${mod.melonbrick} by ${id} is incompatible with v${melonbrick.version}`);
            return;
        }
        for (const dependency in mod.dependencies) {
            const current = await loadMod(dependency);
            const required = mod.dependencies[dependency];
            if (!areCompatible(current, required)) {
                console.log(`Required ${dependency} v${required} by ${id} is incompatible with v${current}`);
                return;
            }
        }
        const module = await import(path + mod.entry);
        melonbrick.exports[id] = module.default;
        loaded[id] = mod.version;
    }
    return loaded[id];
}

const loaded = {};

function areCompatible(current, required) {
    current = current.split(".").map(Number);
    required = required.split(".").map(Number);
    if (required[0] !== current[0]) return false;
    if (required[1] > current[1]) return false;
    if (required[1] === current[1] && required[2] > current[2]) return false;
    return true;
}

loadMods();