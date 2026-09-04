const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const ast = parser.parse(code);

const $lime_init = ast.program.body[37].declarations[0].init.body;
const iife = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body;
ast.program.body = iife.body;

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

traverse(ast, {
    VariableDeclarator(path) {
        if (path.scope.parent) return;
        const varName = path.node.id.name;
        if (isEnum(varName) || isClass(varName)) {
            fileNodes[varName].push(path.parentPath.node);
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
            }
            if (objectName === "m") {
                fileNodes[right.name].push(path.node);
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

const bundle = parser.parse("");
bundle.program.body = Object.values(fileNodes).flat();
fs.writeFileSync("bundle.js", generator(bundle).code);