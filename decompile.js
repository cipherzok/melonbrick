const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const ast = parser.parse(code);

const $lime_init = ast.program.body[37].declarations[0].init.body;
const iife = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body;
ast.program.body = iife.body;

const fileNodes = {}

for (const deobfuscate in deobfuscateData) {
    fileNodes[deobfuscate] = parser.parse("");
}

function isClass(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "class") return true;
}

function isEnum(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "enum") return true;
}

function unsafeIdentifier(name) {
    const node = t.identifier("_");
    node.name = name;
    return node;
}

traverse(ast, {
    Program(path) {
        for (const oldName in renameMap) {
            const newName = renameMap[oldName];
            const binding = path.scope.getBinding(oldName);
            if (!binding) continue;
            binding.identifier.name = newName;
            for (const ref of binding.referencePaths) {
                ref.node.name = newName;
            }
        }
    },
    VariableDeclarator(path) {
        if (path.scope.parent) return;
        const varName = path.node.id.name;
        const value = path.node.init;
        if (isEnum(varName) || isClass(varName)) {
            const body = fileNodes[varName].program.body;
            const node = t.assignmentExpression(
                "=",
                unsafeIdentifier(varName),
                value
            );
            body.push(node);
        }
    },
    AssignmentExpression(path) {
        if (path.scope.parent) return;
        const right = path.node.right;
        const left = path.node.left;
        if (left.type === "MemberExpression") {
            const objectName = left.object.name;
            if (isEnum(objectName) || isClass(objectName)) {
                const body = fileNodes[objectName].program.body;
                body.push(path.node);
            }
            if (objectName === "m") {
                const classBody = fileNodes[right.name].program.body;
                classBody.push(path.node);
            }
        }
    }
})

for (const name in fileNodes) {
    const parts = name.split(".");

    const fileName = parts.pop() + ".js";
    const dir = path.join("decompiled", ...parts);

    fs.mkdirSync(dir, { recursive: true });

    const output = generator(fileNodes[name], {}).code;
    fs.writeFileSync(path.join(dir, fileName), output);
}