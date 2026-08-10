const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const ast = parser.parse(code, { sourceType: "module" });

const $lime_init = ast.program.body[37].declarations[0].init.body;
const iife = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body;
ast.program.body = iife.body;

const fileNodes = {}

for (const deobfuscate in deobfuscateData) {
    fileNodes[deobfuscate] = parser.parse("", { sourceType: "module" });
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
        const data = deobfuscateData[varName];
        if (!data) return;
        const value = path.node.init;
        if (data.type === "class") {
            const classNode = fileNodes[varName];
            const classBody = classNode.program.body;
            if (varName.includes("$d$")) {
                const node = t.assignmentExpression(
                    "=",
                    t.identifier(varName),
                    value
                );
                classBody.push(node);
            } else {
                const node = t.variableDeclaration("var", [
                    t.variableDeclarator(
                        t.identifier(varName),
                        value
                    )
                ]);
                classBody.push(node);
            }
        }
        if (data.type === "enum") {
            const enumNode = fileNodes[varName];
            const enumBody = enumNode.program.body;
            if (varName.includes("$d$")) {
                const node = t.assignmentExpression(
                    "=",
                    t.identifier(varName),
                    value
                );
                enumBody.push(node);
            } else {
                const node = t.variableDeclaration("var", [
                    t.variableDeclarator(
                        t.identifier(varName),
                        value
                    )
                ]);
                enumBody.push(node);
            }
        }
    },
    AssignmentExpression(path) {
        if (path.scope.parent) return;
        const right = path.node.right;
        const left = path.node.left;
        if (left.type === "MemberExpression") {
            const objectName = left.object.name;
            if (deobfuscateData[objectName]) {
                const classBody = fileNodes[objectName].program.body;
                classBody.push(path.node);
            }
            if (objectName === "m") {
                const classBody = fileNodes[right.name].program.body;
                classBody.push(path.node);
            }
        }
    }
})

for (const name in fileNodes) {
    const parts = name.split("$d$");

    const fileName = parts.pop() + ".js";
    const dir = path.join("decompiled", ...parts);

    fs.mkdirSync(dir, { recursive: true });

    const output = generator(fileNodes[name], {}).code.replaceAll("$d$", ".");
    fs.writeFileSync(path.join(dir, fileName), output);
}