const fs = require("fs");
const parser = require("@babel/parser");
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const deobfuscateData = require("./maps/deobfuscate-data.json");

const ast = parser.parse("", { sourceType: "module" });

const root = {};

for (const name in deobfuscateData) {
    const parts = name.split(".");
    const reference = parts.pop();
    if (parts.length === 1) {
        if (!deobfuscateData[name].isGlobal) root[reference] = "rootReference";
        continue;
    } 
    let target = root;
    for (const part of parts) {
        if (!target[part]) target[part] = {}
        target = target[part];
    }
}

function recursive(branch) {
    const objectExpression = t.objectExpression([]);
    for (const folder of Object.keys(branch)) {
        const objectProperty = t.objectProperty(t.identifier(folder), recursive(branch[folder]))
        objectExpression.properties.push(objectProperty);
    }
    return objectExpression;
}

for (const namespace in root) {
    const identifier = t.identifier(namespace);
    let init;
    if (root[namespace] !== "rootReference") init = recursive(root[namespace]);
    const declarator = t.variableDeclarator(identifier, init);
    const variableDeclaration = t.variableDeclaration("var", [declarator])
    ast.program.body.push(t.exportNamedDeclaration(variableDeclaration))
}

fs.writeFileSync("exports-test.js", generator(ast).code);