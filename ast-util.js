const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

class AstUtil {
    constructor(mineblocksCode) {
        this.mineblocksAST = parser.parse(mineblocksCode);
        this.$lime_init = this.mineblocksAST.program.body[37].declarations[0].init.body;
        this.varD = this.$lime_init.body.shift();
        this.iife = this.varD.declarations[0].init.body.body[0].expression.callee.body;
        this.mainCall = this.iife.body.pop();
        this.main = [];
        this.fileNodes = {};
        this.root = {};
        this.fileNodesStrings = {};
    }
    process(rename) {
        const self = this;
        traverse(getAST(this.iife.body), {
            Program(path) {
                if (!rename) return;
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
                if (isEnum(varName) || isClass(varName)) {
                    self.addNode(varName, t.variableDeclaration("var", [path.node]));
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
                        self.addNode(objectName, path.node);
                        path.parentPath.remove();
                    }
                    if (objectName === "m") {
                        self.addNode(right.name, path.node);
                        path.parentPath.remove();
                    }
                }
            }
        });
        for (const name of order) {
            this.initBranch(name);
            this.addNode(
                name,
                t.assignmentExpression(
                    "=",
                    unsafeIdentifier(name),
                    t.identifier(deobfuscateData[name].obfuscate)
                )
            );
            this.addNode(
                name,
                t.callExpression(
                    t.identifier("referenceDefined"),
                    [
                        t.stringLiteral(name)
                    ]
                )
            )
            this.iife.body.push(...this.fileNodes[name]);
            const ast = getAST(this.fileNodes[name]);
            this.fileNodesStrings[name] = generator(ast).code;
        }
    }
    end() {
        this.main.push(t.assignmentExpression(
            "=",
            unsafeIdentifier('window.lime.$scripts["Mine Blocks"]'),
            this.varD.declarations[0].init
        ));
        this.$lime_init.body[0].expression.alternate.expressions.splice(2, 1);
        this.iife.body.push(this.mainCall);
        this.generateExports();
        this.mineblocksResult = generator(this.mineblocksAST).code;
        this.mainResult = generator(getAST(this.main)).code;
    }
    addNode(name, node) {
        const deobfuscate = renameMap[name] || name;
        if (!this.fileNodes[deobfuscate]) this.fileNodes[deobfuscate] = [];
        this.fileNodes[deobfuscate].push(node);
    }
    addCode(code) {
        const ast = parser.parse(code);
        this.main.push(...ast.program.body);
    }
    initBranch(name) {
        const parts = name.split(".");
        const reference = parts.pop();
        if (parts.length === 0) {
            if (!deobfuscateData[name].isGlobal) this.root[reference] = "rootReference";
            return;
        }
        let target = this.root;
        for (const part of parts) {
            if (!target[part]) target[part] = {}
            target = target[part];
        }
    }
    generateExports() {
        function recursive(branch) {
            const objectExpression = t.objectExpression([]);
            for (const folder of Object.keys(branch)) {
                const objectProperty = t.objectProperty(unsafeIdentifier(folder), recursive(branch[folder]))
                objectExpression.properties.push(objectProperty);
            }
            return objectExpression;
        }

        for (const namespace in this.root) {
            const identifier = t.identifier(namespace);
            let init;
            if (this.root[namespace] !== "rootReference") init = recursive(this.root[namespace]);
            const declarator = t.variableDeclarator(identifier, init);
            const variableDeclaration = t.variableDeclaration("var", [declarator]);
            this.main.push(t.exportNamedDeclaration(variableDeclaration));
        }
    }
}

function unsafeIdentifier(name) {
    const node = t.identifier("_");
    node.name = name;
    return node;
}

function getAST(array) {
    const ast = parser.parse("", { sourceType: "module" });
    ast.program.body = array;
    return ast;
}

function isClass(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "class") return true;
}

function isEnum(name) {
    const deobfuscate = renameMap[name] || name;
    if (deobfuscateData[deobfuscate] && deobfuscateData[deobfuscate].type === "enum") return true;
}

module.exports = AstUtil;