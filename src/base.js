const generator = require("@babel/generator").default;
const t = require("@babel/types");
const traverse = require("@babel/traverse").default;
const parser = require("@babel/parser");

const AstUtil = require("./ast-util")
const { isClass, isEnum } = require("./map-util");

class Base extends AstUtil {
    constructor(mineblocksCode) {
        super();
        this.mineblocksAST = parser.parse(mineblocksCode);
        Object.assign(this, AstUtil.getKeyNodes(this.mineblocksAST));
        const astUtil = this;
        this.traverseOpts = {
            VariableDeclarator(path) {
                if (path.scope.parent) return;
                const varName = path.node.id.name;
                if (isEnum(varName) || isClass(varName)) {
                    astUtil.addNode(varName, astUtil.getDefinitionNode(path, varName));
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
                        if (path.parentPath.node.type === "LogicalExpression") {
                            astUtil.addNode(objectName, path.parentPath.parentPath.node);
                        } else {
                            astUtil.addNode(objectName, path.parentPath.node);
                        }
                        path.parentPath.remove();
                    }
                    if (objectName === "m") {
                        path.replaceWith(t.expressionStatement(path.node));
                        if (right.name === "String" || right.name === "Date") {
                            astUtil.addNode(right.name, path.parentPath.node);
                            path.parentPath.parentPath.remove();
                        } else {
                            path.parentPath.remove();
                        }
                        astUtil.addNode(right.name, path.parentPath.node);
                    }
                }
            }
        }
    }
    process() {
        traverse(AstUtil.getAST(this.iife.body), this.traverseOpts);
    }
    getDefinitionNode(path) {
        return t.variableDeclaration("var", [path.node]);
    }
    getReferenceString(name) {
        const ast = AstUtil.getAST(this.referenceNodes[name]);
        return generator(ast).code;
    }
}

module.exports = Base;