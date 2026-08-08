const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const varToClass = require("./maps/var-to-class.json");
const varToEnum = require("./maps/var-to-enum.json");
const enumToVar = require("./maps/enum-to-var.json");
const classToVar = require("./maps/class-to-var.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const ast = parser.parse(code, { sourceType: "module" });

const $lime_init = ast.program.body[37].declarations[0].init.body;
const iife = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body;
ast.program.body = iife.body;

traverse(ast, {
    VariableDeclarator(path) {
        if (path.scope.parent) return;

        const oldName = path.node.id.name;
        const newName = varToClass[oldName] || varToEnum[oldName];
        if (!newName) return;

        const binding = path.scope.getBinding(oldName);
        if (!binding) return;

        binding.identifier.name = newName;

        for (const ref of binding.referencePaths) {
            ref.node.name = newName;
        }
    }
});

const fileNodes = {}

for (const className in classToVar) {
    fileNodes[className] = parser.parse("", { sourceType: "module" });
}

for (const enumName in enumToVar) {
    fileNodes[enumName] = parser.parse("", { sourceType: "module" });
}

traverse(ast, {
    VariableDeclarator(path) {
        if (path.scope.parent) return;
        const varName = path.node.id.name;
        const value = path.node.init;
        if (classToVar[varName]) {
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
        if (enumToVar[varName]) {
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
            if (classToVar[objectName]) {
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