const fs = require("fs");
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

fs.writeFileSync("enum-to-var.json", JSON.stringify(enumToVar, null, 4));
fs.writeFileSync("var-to-enum.json", JSON.stringify(varToEnum, null, 4));
fs.writeFileSync("class-to-var.json", JSON.stringify(classToVar, null, 4));
fs.writeFileSync("var-to-class.json", JSON.stringify(varToClass, null, 4));
