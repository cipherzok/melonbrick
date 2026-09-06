const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const haxeAST = parser.parse(code);
const $lime_init = haxeAST.program.body[37].declarations[0].init.body;
const iifeAST = parser.parse("");
iifeAST.program.body = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body.body;

const fileNodes = {};

for (const name of order) {
    const obfuscate = deobfuscateData[name].obfuscate;
    fileNodes[obfuscate] = [];
}

function isClass(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "class") return true;
}

function isEnum(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "enum") return true;
}

traverse(iifeAST, {
    VariableDeclarator(path) {
        if (path.scope.parent) return;
        const varName = path.node.id.name;
        if (isEnum(varName) || isClass(varName)) {
            fileNodes[varName].push(t.variableDeclaration("var", [path.node]));
            if (path.parentPath.node.declarations.length > 1) {
                path.remove();
            } else {
                path.parentPath.remove();
            }
        }
    },
    AssignmentExpression(path) {
        if (path.scope.parent) return;
        const right = path.node.right;
        const left = path.node.left;
        if (left.type === "MemberExpression") {
            const objectName = left.object.name;
            if (isEnum(objectName) || isClass(objectName)) {
                fileNodes[objectName].push(path.node);
                path.parentPath.remove();
            }
            if (objectName === "m") {
                fileNodes[right.name].push(path.node);
                path.parentPath.remove();
            }
        }
    }
})

for (const obfuscate in fileNodes) {
    fileNodes[obfuscate].push(t.callExpression(
        t.identifier("referenceDefined"),
        [
            t.stringLiteral(renameMap[obfuscate])
        ]
    ));
}

const root = {};

for (const name in deobfuscateData) {
    const parts = name.split(".");
    const reference = parts.pop();
    if (parts.length === 0) {
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
    haxeAST.program.body.push(t.exportNamedDeclaration(variableDeclaration))
}

const bundle = parser.parse("");
bundle.program.body = Object.values(fileNodes).flat();
fs.writeFileSync("haxe.js", generator(haxeAST).code);
fs.writeFileSync("residue.js", generator(iifeAST).code);
fs.writeFileSync("bundle.js", generator(bundle).code);