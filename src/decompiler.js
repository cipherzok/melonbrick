const t = require("@babel/types");
const prettier = require("prettier");

const Base = require("./base");
const AstUtil = require("./ast-util");

const renameMap = require("./rename-map.json");

class Decompiler extends Base {
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
    async loop(name) {
        const output = this.getReferenceString(name);
        const formatted = await prettier.format(output, {
            parser: "babel",
            tabWidth: 4
        });
        this.done(name, output);
    }
}

module.exports = Decompiler;