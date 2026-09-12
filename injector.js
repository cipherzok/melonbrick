const fs = require("fs");
const path = require("path");
const AstUtil = require("./ast-util")
const t = require("@babel/types");
const generator = require("@babel/generator").default;
const parser = require("@babel/parser");

const deobfuscateData = require("./maps/deobfuscate-data.json");

class Injector extends AstUtil {
    constructor(mineblocksCode, melonbrickCode) {
        super(mineblocksCode);
        this.melonbrickAST = parser.parse(melonbrickCode);
        this.main = [];
        this.main.push(t.assignmentExpression(
            "=",
            AstUtil.unsafeIdentifier('window.lime.$scripts["Mine Blocks"]'),
            this.varD.declarations[0].init
        ));
        this.mainCall = this.iife.body.pop();
        this.root = {};
        this.$lime_init.body.shift();
        this.$lime_init.body[0].expression.alternate.expressions.splice(2, 1);
    }
    process() {
        super.process();
        this.iife.body.push(this.mainCall);
        this.generateExports();
        this.main.push(...this.melonbrickAST.program.body)
        fs.writeFileSync(path.join("mine-blocks", "init.js"), generator(this.mineblocksAST).code);
        fs.writeFileSync(path.join("mine-blocks", "Mine Blocks.js"), generator(AstUtil.getAST(this.main)).code);
    }
    loop(name) {
        this.initBranch(name);
        this.addNode(
            name,
            t.assignmentExpression(
                "=",
                AstUtil.unsafeIdentifier(name),
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
        this.iife.body.push(...this.referenceNodes[name]);
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
                const objectProperty = t.objectProperty(AstUtil.unsafeIdentifier(folder), recursive(branch[folder]))
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

const mineblocksCode = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });
const melonbrickCode = fs.readFileSync("melonbrick.js", { encoding: "utf8" });

const injector = new Injector(mineblocksCode, melonbrickCode);
injector.process();