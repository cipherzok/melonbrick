const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");
const fs = require("fs");
const path = require("path");
const AstUtil = require("./ast-util")

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");

const bundle = [];
const root = {};

for (const reference of order) {
    const parts = reference.split(".");
    const name = parts[0];

    const data = deobfuscateData[reference];

    if (deobfuscateData[name]) {
        if (!data.isGlobal) root[name] = "rootReference";
    } else {
        root[name] = "rootNamespace";
    }

    const fileName = parts.pop() + ".js";
    const dir = path.join("decompiled", ...parts);

    const code = fs.readFileSync(path.join(dir, fileName), { encoding: "utf8" });
    const ast = parser.parse(code);

    if (!data.isGlobal) {
        const varIdentifier = t.identifier(data.obfuscate);

        if (root[name] === "rootNamespace") {
            const constructor = ast.program.body.shift();

            const declarator = t.variableDeclarator(
                varIdentifier,
                constructor.expression.right
            );
            bundle.push(t.variableDeclaration("var", [declarator]));
        }

        bundle.push(t.expressionStatement(
            t.assignmentExpression(
                "=",
                varIdentifier,
                t.callExpression(
                    t.identifier("constructorDefined"),
                    [
                        t.stringLiteral(reference),
                        varIdentifier
                    ]
                )
            )
        ));
    }

    bundle.push(...ast.program.body);
    bundle.push(t.assignmentExpression(
        "=",
        AstUtil.unsafeIdentifier(reference),
        t.identifier(data.obfuscate)
    ));
    bundle.push(t.callExpression(
        t.identifier("referenceDefined"),
        [
            t.stringLiteral(reference)
        ]
    ));
}

const ast = AstUtil.getAST(bundle);

traverse(ast, {
    Program(path) {
        for (const oldName in root) {
            if (root[oldName] !== "rootReference") continue;
            const newName = deobfuscateData[oldName].obfuscate;
            AstUtil.rename(path, oldName, newName);
        }
    },
    MemberExpression(path) {
        let name = path.node.object.name;
        if (root[name]) {
            let currentPath = path;
            while (true) {
                name = name + "." + currentPath.node.property.name;
                if (deobfuscateData[name]) break;
                currentPath = currentPath.parentPath;
            }
            currentPath.replaceWith(t.identifier(deobfuscateData[name].obfuscate))
        }
    }
})

const ouput = generator(ast).code;

fs.writeFileSync("bundle.js", ouput);