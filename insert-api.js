const fs = require("fs");
const path = require("path");
const AstUtil = require("./ast-util")

const code = fs.readFileSync("Mine Blocks.js", { encoding: "utf8" });
const melonbrickCode = fs.readFileSync("melonbrick.js", { encoding: "utf8" });
const astUtil = new AstUtil(code);

astUtil.process();
astUtil.addCode(melonbrickCode);
astUtil.end();

fs.writeFileSync(path.join("mine-blocks", "init.js"), astUtil.mineblocksResult);
fs.writeFileSync(path.join("mine-blocks", "Mine Blocks.js"), astUtil.mainResult);