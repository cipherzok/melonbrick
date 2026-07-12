const generate = require("@babel/generator").default;
const parser = require("@babel/parser");
const t = require("@babel/types");

const order = require("./order.json");
const enumToVar = require("./maps/enum-to-var.json");
const varToEnum = require("./maps/var-to-enum.json");
const classToVar = require("./maps/class-to-var.json");
const varToClass = require("./maps/var-to-class.json");

function patch(mineblocksJS, melonbrickJS) {
    const melonbrickProgram = parser.parse(melonbrickJS).program;
    const mineblocksProgram = parser.parse(mineblocksJS).program;
    const $lime_init = mineblocksProgram.body[37].declarations[0].init.body;

    $lime_init.body.push(...melonbrickProgram.body);

    const iife = $lime_init.body[0].declarations[0].init.body.body[0].expression.callee.body;

    const classNodes = {};

    for (const className in classToVar) {
        classNodes[className] = [];
    }

    const enums = [];

    const head = [];

    head.push(iife.body.shift());
    head.push(iife.body.shift());
    head.push(iife.body.shift());
    head.push(iife.body.shift());
    head.push(iife.body.shift());

    const foot = [];

    const mainCall = iife.body.pop();

    for (const statement of iife.body) {
        let flag = true;
        if (statement.type === "VariableDeclaration") {
            let declarator = statement.declarations[statement.declarations.length - 1];
            const varName = declarator.id.name;
            const className = varToClass[varName];
            if (className) {
                const path = t.identifier(`melonbrick.constructors["${className}"]`);
                const classNode = classNodes[className];
                classNode.push(t.expressionStatement(
                    t.assignmentExpression(
                        "=",
                        path,
                        declarator.init
                    )
                ));

                classNode.push(t.callExpression(
                    t.identifier("constructorDefined"),
                    [
                        t.stringLiteral(className),
                    ]
                ));

                declarator.init = path;
                classNode.push(t.variableDeclaration("var", [declarator]));
                if (statement.declarations.length > 1) {
                    statement.declarations.pop();
                    head.push(statement)
                }
                flag = false;
            }
            const enumName = varToEnum[varName];
            if (enumName) {
                enums.push(statement);
                enums.push(t.callExpression(
                    t.identifier("referenceDefined"),
                    [
                        t.stringLiteral(enumName),
                        t.identifier(varName)
                    ]
                ));

                flag = false;
            }
        }
        if (statement.type === "ExpressionStatement") {
            if (statement.expression.type === "AssignmentExpression") {
                const left = statement.expression.left;
                const objectName = left.object.name || left.object.object.name;
                if (varToClass[objectName]) {
                    classNodes[varToClass[objectName]].push(statement);
                    flag = false
                }
                if (objectName === "m") {
                    const className = left.property.name || left.property.value;
                    classNodes[className].push(statement);
                    flag = false
                }
            }
        }
        if (flag) foot.push(statement);
    }

    head.push(...enums);

    for (const className of order) {
        const classNode = classNodes[className];

        const varName = classToVar[className];

        classNode.push(t.callExpression(
            t.identifier("referenceDefined"),
            [
                t.stringLiteral(className),
                t.identifier(varName)
            ]
        ));

        head.push(...classNode);
    }

    foot.push(mainCall);

    head.push(...foot);

    iife.body = head;

    return generate(mineblocksProgram).code;
}

module.exports = patch;