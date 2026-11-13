import { types as t } from "./dependencies.js";
import Base from "./base.js";
import AstUtil from "./ast-util.js";
import renameMap from "./rename-map.json" with { type: "json" };
import generator from "extended-babel-generator";

export default class Decompiler extends Base {
    constructor(mineblocksCode) {
        super(mineblocksCode);
        this.traverseOpts.Program = function (path) {
            for (const oldName in renameMap) {
                const newName = renameMap[oldName];
                AstUtil.rename(path, oldName, newName);
            }
        }
    }
    getDefinitionNode(path, varName) {
        if (!varName.includes(".")) return super.getDefinitionNode(path, varName);
        return t.assignmentExpression(
            "=",
            AstUtil.unsafeIdentifier(path.node.id.name),
            path.node.init
        );
    }
    getReferenceString(name) {
        const ast = AstUtil.getAST(this.referenceNodes[name]);
        return generator(ast).code;
    }
    async loop(name) {
        const output = this.getReferenceString(name);
        this.done(name, output);
    }
}