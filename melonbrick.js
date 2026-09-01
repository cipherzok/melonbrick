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

const patched = new WeakMap();

function patch(target, name) {
    const func = target[name];

    if (patched.has(target[name])) return;

    const after = [];
    const before = [];

    target[name] = function (...args) {
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

    patched.set(target[name], { before, after })

}

melonbrick.hookBefore = function (target, name, hook) {
    patch(target, name);
    patched.get(target[name]).before.push(hook);
}

melonbrick.hookAfter = function (target, name, hook) {
    patch(target, name);
    patched.get(target[name]).after.push(hook);
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