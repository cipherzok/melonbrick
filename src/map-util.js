import deobfuscateData from "./deobfuscate-data.json" with { type: "json" };
import renameMap from "./rename-map.json" with { type: "json" };

export function isClass(name) {
    return getData(name, "type") === "class";
}

export function isEnum(name) {
    return getData(name, "type") === "enum";
}

export function isNative(name) {
    return getData(name, "isNative") === true;
}

export function getData(name, key) {
    const deobfuscate = renameMap[name] || name;
    const data = deobfuscateData[deobfuscate];
    if (data) return data[key];
}