const deobfuscateData = require("./deobfuscate-data.json");
const renameMap = require("./rename-map.json");

function isClass(name) {
    return getData(name, "type") === "class";
}

function isEnum(name) {
    return getData(name, "type") === "enum";
}

function isNative(name) {
    return getData(name, "isNative") === true;
}

function getData(name, key) {
    const deobfuscate = renameMap[name] || name;
    const data = deobfuscateData[deobfuscate];
    if (data) return data[key];
}

module.exports = { isClass, isEnum, isNative }