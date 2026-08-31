const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const code = fs.readFileSync("./Mine Blocks.js", "utf8");
const program = parser.parse(code).program;

const deobfuscateData = {};
const renameMap = {};

const iifeBody = program.body[37].declarations[0].init.body.body[0].declarations[0].init.body.body[0].expression.callee.body;

const iifeArray = iifeBody.body;

for (const statement of iifeArray) {
    if (statement.type === "VariableDeclaration") {
        for (const declarator of statement.declarations) {
            if (!declarator.init || declarator.init.type !== "AssignmentExpression") continue;
            const left = declarator.init.left;
            const varName = declarator.id.name;
            const enumName = left.property.value || left.property.name;
            setData(varName, enumName, "enum");
        }
    }
    if (statement.type === "ExpressionStatement") {
        const left = statement.expression.left;
        const right = statement.expression.right;
        if (left && left.object && left.object.name === "m") {
            const varName = right.name;
            const className = left.property.name || left.property.value;
            setData(varName, className, "class");
        }
    }
}

setData("String", "String", "class");
setData("Date", "Date", "class");

function setData(obfuscate, deobfuscate, type) {
    deobfuscateData[deobfuscate] = { type, obfuscate };
    renameMap[obfuscate] = deobfuscate;
}

function writeJSON(name, json) {
    fs.writeFileSync(path.join("maps", name + ".json"), JSON.stringify(json, null, 4));
}

writeJSON("deobfuscate-data", deobfuscateData);
writeJSON("rename-map", renameMap);