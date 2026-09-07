const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");
const path = require("path");

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });
const melonbrickCode = fs.readFileSync("melonbrick.js", { encoding: "utf8" });

function getAST(array) {
    const ast = parser.parse("", { sourceType: "module" });
    ast.program.body = array;
    return ast;
}

const initAST = parser.parse(code);
const melonbrickAST = parser.parse(melonbrickCode);

const $lime_init = initAST.program.body[37].declarations[0].init.body;
const varD = $lime_init.body.shift();
const iife = varD.declarations[0].init.body.body[0].expression.callee.body;
const main = [];

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

traverse(getAST(iife.body), {
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
    const parts = renameMap[obfuscate].split(".");
    fileNodes[obfuscate].push(
        t.assignmentExpression(
            "=",
            memberChain(...parts),
            t.identifier(obfuscate)
        ),
        t.callExpression(
            t.identifier("referenceDefined"),
            [
                t.stringLiteral(renameMap[obfuscate])
            ]
        ),
    );
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
    main.push(t.exportNamedDeclaration(variableDeclaration))
}

function memberChain(...parts) {
    let expression = toExpression(parts.shift());

    for (const part of parts) {
        const property = toExpression(part);
        expression = t.memberExpression(
            expression,
            property,
            !t.isIdentifier(property)
        );
    }

    return expression;
}

function toExpression(value) {
    if (typeof value === "string") {
        return t.identifier(value);
    } else {
        return value;
    }
}

main.push(t.assignmentExpression(
    "=",
    memberChain(
        "window",
        "lime",
        "$scripts",
        t.stringLiteral("Mine Blocks")
    ),
    varD.declarations[0].init
));

$lime_init.body[0].expression.alternate.expressions.splice(2, 1);

const mainCall = iife.body.pop();

iife.body.push(...Object.values(fileNodes).flat())

iife.body.push(mainCall);

main.push(...melonbrickAST.program.body)

fs.writeFileSync(path.join("mine-blocks", "init.js"), generator(initAST).code);
fs.writeFileSync(path.join("mine-blocks", "Mine Blocks.js"), generator(getAST(main)).code);