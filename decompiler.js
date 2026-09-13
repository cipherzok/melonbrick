const fs = require("fs");
const path = require("path");
const AstUtil = require("./ast-util")
const t = require("@babel/types");

const renameMap = require("./maps/rename-map.json");

class Decompiler extends AstUtil {
    constructor(mineblocksCode) {
        super(mineblocksCode);
        this.traverseOpts.Program = function (path) {
            for (const oldName in renameMap) {
                const newName = renameMap[oldName];
                const binding = path.scope.getBinding(oldName);
                if (!binding) continue;
                binding.identifier.name = newName;
                for (const ref of binding.referencePaths) {
                    ref.node.name = newName;
                }
            }
        }
    }
    constructorFound(path, varName) {
        this.addNode(varName, t.assignmentExpression(
            "=",
            AstUtil.unsafeIdentifier(path.node.id.name),
            path.node.init
        ));
    }
    loop(name) {
        const parts = name.split(".");

        const fileName = parts.pop() + ".js";
        const dir = path.join("decompiled", ...parts);

        fs.mkdirSync(dir, { recursive: true });

        const output = this.getReferenceString(name);

        fs.writeFileSync(path.join(dir, fileName), output);
    }
}

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });

const decompiler = new Decompiler(code);
decompiler.process();