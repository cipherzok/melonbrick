const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const order = require("./order.json");
const deobfuscateData = require("./maps/deobfuscate-data.json");
const renameMap = require("./maps/rename-map.json");

class AstUtil {
    static unsafeIdentifier(name) {
        const node = t.identifier("_");
        node.name = name;
        return node;
    }
    static getAST(array) {
        const ast = parser.parse("", { sourceType: "module" });
        ast.program.body = array;
        return ast;
    }
    constructor(mineblocksCode) {
        this.mineblocksAST = parser.parse(mineblocksCode);
        this.$lime_init = this.mineblocksAST.program.body[37].declarations[0].init.body;
        this.varD = this.$lime_init.body[0];
        this.iife = this.varD.declarations[0].init.body.body[0].expression.callee.body;
        this.referenceNodes = {};
        this.ast = AstUtil.getAST(this.iife.body);
        const astUtil = this;
        this.traverseOpts = {
            VariableDeclarator(path) {
                if (path.scope.parent) return;
                const varName = path.node.id.name;
                if (isEnum(varName) || isClass(varName)) {
                    astUtil.constructorFound(path, varName);
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
                        astUtil.addNode(objectName, path.node);
                        path.parentPath.remove();
                    }
                    if (objectName === "m") {
                        astUtil.addNode(right.name, path.node);
                        path.parentPath.remove();
                    }
                }
            }
        }
    }
    constructorFound(path, varName) {
        this.addNode(varName, t.variableDeclaration("var", [path.node]));
    }
    getReferenceString(name) {
        const ast = AstUtil.getAST(this.referenceNodes[name]);
        return generator(ast).code;
    }
    process() {
        traverse(this.ast, this.traverseOpts);
        for (const name of order) {
            this.loop(name)
        }
    }
    addNode(name, node) {
        const deobfuscate = renameMap[name] || name;
        if (!this.referenceNodes[deobfuscate]) this.referenceNodes[deobfuscate] = [];
        this.referenceNodes[deobfuscate].push(node);
    }
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