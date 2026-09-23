#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Diff = require("diff");
const parser = require("@babel/parser");
const generator = require("@babel/generator").default

const Decompiler = require("./src/decompiler");
const Injector = require("./src/injector");
const AstUtil = require("./src/ast-util");
const Bundler = require("./src/bundler");

const order = require("./src/order.json");
const { default: generate } = require("@babel/generator");

const mineblocksCode = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const deobfuscateData = {};
const renameMap = {};

function setData(obfuscate, deobfuscate, type) {
    deobfuscateData[deobfuscate] = { type, obfuscate };
    renameMap[obfuscate] = deobfuscate;
}

function writeJSON(name, json) {
    fs.writeFileSync(path.join("src", name + ".json"), JSON.stringify(json, null, 4));
}

const command = process.argv[2] || "diffbundle";

const commands = {
    decompile: () => {
        const decompiler = new Decompiler(mineblocksCode);

        decompiler.done = function (name, output) {
            const parts = name.split(".");

            const fileName = parts.pop() + ".js";
            const dir = path.join("decompiled", ...parts);

            fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(path.join(dir, fileName), output);
        }

        decompiler.process();
        decompiler.iterateOrder()
    },
    diffdecompiled: () => {
        const decompiler = new Decompiler(mineblocksCode);

        decompiler.done = function (name, original) {
            const parts = name.split(".");

            const fileName = parts.pop();

            const edited = fs.readFileSync(path.join("decompiled", ...parts, fileName + ".js"), { encoding: "utf8" });

            if (edited !== original) {
                const dir = path.join("patches", ...parts);

                fs.mkdirSync(dir, { recursive: true });

                const patch = Diff.createPatch(fileName + ".js", original, edited);

                fs.writeFileSync(path.join(dir, fileName + ".patch"), patch);
            }
        }
        decompiler.process();
        decompiler.iterateOrder()
    },
    generatemaps: () => {
        const program = parser.parse(mineblocksCode).program;

        const iife = AstUtil.iife(program);

        for (const statement of iife.body) {
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

        writeJSON("deobfuscate-data", deobfuscateData);
        writeJSON("rename-map", renameMap);
    },
    patchdecompiled: () => {
        for (const name of order) {
            const parts = name.split(".");
            const fileName = parts.pop();

            const patchPath = path.join("patches", ...parts, fileName + ".patch");

            if (fs.existsSync(patchPath)) {
                const sourcePath = path.join("decompiled", ...parts, fileName + ".js");
                const patch = fs.readFileSync(patchPath, { encoding: "utf8" });
                const source = fs.readFileSync(sourcePath, { encoding: "utf8" });
                const result = Diff.applyPatch(source, patch);
                if (result === false) {
                    console.log("Patch could not be applied: " + patchPath)
                } else {
                    fs.writeFileSync(sourcePath, result);
                }
            }
        }
    },
    diffbundle: () => {
        const bundler = new Bundler();
        bundler.iterateOrder();
        bundler.process();

        const melonbrickCode = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });
        const injector = new Injector(mineblocksCode, melonbrickCode);
        injector.process();
        injector.iterateOrder();

        const edited = generate(AstUtil.getAST(bundler.bundle)).code;
        const original = generate(AstUtil.getAST(injector.bundle)).code;

        const patch = Diff.createPatch("bundle.js", original, edited);

        fs.writeFileSync(path.join("src", "bundle.patch"), patch);

        injector.end();
    }
}

if (commands[command]) {
    commands[command]();
} else {
    console.log("Unknown command: " + command);
}
