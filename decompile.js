const fs = require("fs");
const path = require("path");
const AstUtil = require("./ast-util")

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });
const astUtil = new AstUtil(code);

astUtil.process(true);

for (const name in astUtil.fileNodesStrings) {
    const parts = name.split(".");

    const fileName = parts.pop() + ".js";
    const dir = path.join("decompiled", ...parts);

    fs.mkdirSync(dir, { recursive: true });

    const output = astUtil.fileNodesStrings[name];
    fs.writeFileSync(path.join(dir, fileName), output);
}