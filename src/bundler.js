const fs = require("fs");
const path = require("path");
const traverse = require("@babel/traverse").default;
const parser = require("@babel/parser");
const t = require("@babel/types");

const AstUtil = require("./ast-util");

const deobfuscateData = require("./deobfuscate-data.json");
const { default: generate } = require("@babel/generator");

class Bundler extends AstUtil {
    constructor() {
        super();
        this.root = {};
    }
    process() {
        this.flatReferences();
        const astUtil = this;
        traverse(AstUtil.getAST(astUtil.bundle), {
            Program(path) {
                for (const oldName in astUtil.root) {
                    if (astUtil.root[oldName] !== "rootReference") continue;
                    const newName = deobfuscateData[oldName].obfuscate;
                    AstUtil.rename(path, oldName, newName);
                }
            },
            MemberExpression(path) {
                if (!path.node.object) return;
                let name = path.node.object.name;
                if (astUtil.root[name]) {
                    let currentPath = path;
                    while (true) {
                        name = name + "." + currentPath.node.property.name;
                        if (deobfuscateData[name]) break;
                        currentPath = currentPath.parentPath;
                    }
                    currentPath.replaceWith(t.identifier(deobfuscateData[name].obfuscate))
                }
            }
        });
    }
    loop(reference) {
        const parts = reference.split(".");
        const name = parts[0];

        const data = deobfuscateData[reference];

        if (deobfuscateData[name]) {
            if (!data.isNative) this.root[name] = "rootReference";
        } else {
            this.root[name] = "rootNamespace";
        }

        const fileName = parts.pop() + ".js";
        const dir = path.join("decompiled", ...parts);

        const code = fs.readFileSync(path.join(dir, fileName), { encoding: "utf8" });
        const ast = parser.parse(code);

        if (!data.isNative) {
            const varIdentifier = t.identifier(data.obfuscate);

            if (this.root[name] === "rootNamespace") {
                const constructor = ast.program.body[0];

                const declarator = t.variableDeclarator(
                    varIdentifier,
                    constructor.expression.right
                );
                ast.program.body[0] = t.variableDeclaration("var", [declarator]);
            }
        }

        this.addNode(reference, ...ast.program.body);

        this.injectReference(reference);
    }
}

module.exports = Bundler;