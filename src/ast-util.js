import { parser, types as t } from "./dependencies.js";

import renameMap from "./rename-map.json" with { type: "json" };

import { isNative, isEnum } from "./map-util.js";

import deobfuscateData from "./deobfuscate-data.json" with { type: "json" };

import order from "./order.json" with { type: "json" };

export default class AstUtil {
    constructor(mineblocksCode) {
        this.referenceNodes = {};
    }
    flatReferences() {
        this.bundle = Object.values(this.referenceNodes).flat();
    }
    injectReference(name) {
        const node = this.referenceNodes[name];
        const varIdentifier = t.identifier(deobfuscateData[name].obfuscate);

        if (!isEnum(name) || isNative(name)) {
            node.push(t.expressionStatement(
                t.assignmentExpression(
                    "=",
                    varIdentifier,
                    t.callExpression(
                        t.identifier("constructorDefined"),
                        [
                            t.stringLiteral(name),
                            varIdentifier
                        ]
                    )
                )
            ));
        }

        node.splice(1, 0, t.assignmentExpression(
            "=",
            AstUtil.unsafeIdentifier(name),
            varIdentifier
        ));
        node.push(t.callExpression(
            t.identifier("referenceDefined"),
            [
                t.stringLiteral(name)
            ]
        ));
    }
    iterateOrder() {
        for (const name of order) this.loop(name);
    }
    addNode(name, ...args) {
        const deobfuscate = renameMap[name] || name;
        if (!this.referenceNodes[deobfuscate]) this.referenceNodes[deobfuscate] = [];
        this.referenceNodes[deobfuscate].push(...args);
    }
    static rename(path, oldName, newName) {
        const binding = path.scope.getBinding(oldName);
        if (!binding) return;
        binding.identifier.name = newName;
        for (const ref of binding.referencePaths) {
            ref.node.name = newName;
        }
    }
    static getKeyNodes(mineblocksAST) {
        const $lime_init = mineblocksAST.program.body[37].declarations[0].init.body;
        const varD = $lime_init.body[0];
        const iife = varD.declarations[0].init.body.body[0].expression.callee.body;
        return { $lime_init, varD, iife }
    }
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
}