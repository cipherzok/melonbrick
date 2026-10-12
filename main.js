import manifest from "./src/manifest.json" with { type: "json" }

import Injector from "./src/injector.js";
import AstUtil from "./src/ast-util.js";
import { parser, generator } from "./src/dependencies.js";

const [melonbrickCode, patch, index] = await Promise.all([
    fetch("./src/melonbrick.js").then(r => r.text()),
    fetch("./bundle.patch").then(p => p.text()),
    fetch("./src/index.txt").then(p => p.text())
])

const zip = new JSZip();
zip.file("index.html", index);
zip.file("mods.json", "[]");

const $log = document.getElementById("log");
function log(text) {
    $log.textContent = text;
}

const $importEXE = document.getElementById("import-exe");
const $exeName = document.getElementById("exe-file-name");
let exeFile;
$importEXE.onclick = () => {
    requestFile(".exe", (file) => {
        $exeName.textContent = file.name;
        exeFile = file;
    })
}

const $importJS = document.getElementById("import-js");
const $jsName = document.getElementById("js-file-name");
let jsFile;
$importJS.onclick = () => {
    requestFile(".js", (file) => {
        $jsName.textContent = file.name;
        jsFile = file;
    })
}

function requestFile(extensions, onSuccess) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions;
    input.onchange = function (event) {
        const file = event.target.files[0];
        if (file) {
            onSuccess(file);
        }
    }
    input.click()
}

const $download = document.getElementById("download");
$download.onclick = async function () {
    const [buffer, mineblocksCode] = await Promise.all([
        exeFile.arrayBuffer(),
        jsFile.text()
    ]);

    injectAPI(mineblocksCode, melonbrickCode, patch);

    const exeBytes = new Uint8Array(buffer)
    extractAssets(exeBytes);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "melonbrick.zip";
    a.click();
    URL.revokeObjectURL(url);
}

function injectAPI(mineblocksCode, melonbrickCode, patch) {
    const injector = new Injector(mineblocksCode, melonbrickCode);
    injector.process();
    injector.iterateOrder();

    const original = generator(AstUtil.getAST(injector.bundle)).code;
    const result = Diff.applyPatch(original, patch);

    injector.bundle = parser.parse(result).program.body;

    injector.end();
    zip.file("Mine Blocks.js", injector.mainCode);
    zip.file("init.js", injector.initCode);
}

function extractAssets(exeBytes) {
    const pak = new Uint8Array(3610681);
    const header = new TextEncoder().encode("lime-asset-pack");
    pak.set(header)
    for (const path in manifest) {
        const data = manifest[path];
        const asset = exeBytes.subarray(data.address, data.address + data.size);
        if (data.position) {
            const compressed = pako.gzip(asset, { level: 9 });
            compressed[9] = 0x0A;
            pak.set(compressed, data.position);
        } else {
            zip.file(path, asset);
        }
    }
    zip.file("lib/default.pak", pak);
}