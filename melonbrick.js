window.melonbrick = {}

const waitingConstructor = {};
const waitingReference = {};

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
    const wrapper = { constructor };
    if (waitingConstructor[name]) {
        for (const callback of waitingConstructor[name]) callback(wrapper);
    }
    return wrapper.constructor;
}

const patchedMap = new WeakMap();

function patch(target, name) {
    let func = target;
    if (name) func = target[name];

    if (patchedMap.has(func)) return;

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
    for (const folder of modFolders) {
        await import("./mods/" + folder + "/main.js");
    }
    window.lime.embed("Mine Blocks", "content", 0, 0);
}

loadMods();