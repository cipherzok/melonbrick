const fs = require("fs");
const path = require("path");
const generate = require("@babel/generator").default;
const parser = require("@babel/parser");
const t = require("@babel/types");

const code = fs.readFileSync("./Mine Blocks.js", "utf8");
const program = parser.parse(code).program;

const enumToVar = {};
const varToEnum = {};
const classToVar = {};
const varToClass = {};

const iifeBody = program.body[37].declarations[0].init.body.body[0].declarations[0].init.body.body[0].expression.callee.body;

const iifeArray = iifeBody.body;

for (const statement of iifeArray) {
    if (statement.type === "VariableDeclaration") {
        for (const declarator of statement.declarations) {
            if (!declarator.init || declarator.init.type !== "AssignmentExpression") continue;
            const varName = declarator.id.name;
            const left = declarator.init.left;
            const enumName = left.property.value || left.property.name;
            enumToVar[enumName] = varName;
            varToEnum[varName] = enumName;
        }
    }
    if (statement.type === "ExpressionStatement") {
        const left = statement.expression.left;
        const right = statement.expression.right;
        if (left && left.object && left.object.name === "m") {
            const className = left.property.name || left.property.value;
            const varName = right.name;
            classToVar[className] = varName;
            varToClass[varName] = className;
        }
    }
}

classToVar.String = "String";
varToClass.String = "String";
classToVar.Date = "Date";
varToClass.Date = "Date";

function writeJSON(name, json) {
    fs.writeFileSync(path.join("maps", name  + ".json"), JSON.stringify(json, null, 4).replaceAll(".", "$d$"));
}

writeJSON("enum-to-var", enumToVar);
writeJSON("var-to-enum", varToEnum);
writeJSON("class-to-var", classToVar);
writeJSON("var-to-class", varToClass);
