const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const patch = require("./patcher");
const { spawn } = require("child_process");
const got = require("got").default;
const http = require("http");

const assetsList = require("./assets.json");
const config = require("./config.json");

let setupPath = path.join(__dirname, config.target);
if (process.pkg) setupPath = path.dirname(process.execPath);

function download(url) {
    console.log("Downloading " + url);
    return got(url).buffer();
}

async function setup() {
    const [
        mineblocksJS,
        defaultPAK,
        faviconPNG,
        mineblocksZIP
    ] = await Promise.all([
        download(config.scriptURL),
        download(config.libraryURL),
        download(config.faviconURL),
        download(config.zipURL)
    ]);

    const melonbrickJS = fs.readFileSync(path.join(__dirname, "melonbrick.js"), "utf8");
    console.log("Inserting API...");
    const patched = patch(mineblocksJS.toString("utf8"), melonbrickJS);
    setupFile("Mine Blocks.js", patched);
    setupFile("lib/default.pak", defaultPAK);
    setupFile("favicon.png", faviconPNG);

    const zip = new AdmZip(mineblocksZIP);
    const entry = zip.getEntry("Mine Blocks.exe");
    const buffer = entry.getData();

    for (let i = 0; i < assetsList.length; i++) {
        const asset = assetsList[i];
        if (!asset.includes(".mp3")) continue;
        const data = getAssetData(buffer, i);
        setupFile(asset, buffer.subarray(data.assetAddress, data.assetAddress + data.assetLength))
    }

    fs.mkdirSync(path.join(setupPath, "mods"), { recursive: true });
    setupFile("index.html", fs.readFileSync(path.join(__dirname, "index.html")));
}

function setupFile(relativePath, data) {
    const filePath = path.join(setupPath, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    console.log("File created: " + relativePath);
    fs.writeFileSync(filePath, data);
}

const tableAddress = 0x8FEEC0;
const rdataSection = 0x401800;
const dataSection = 0x402600;

function getAssetData(buffer, index) {
    const dataAddress = tableAddress + (0x10 * index);
    return {
        idLength: buffer.readUInt32LE(dataAddress),
        idAddress: buffer.readUInt32LE(dataAddress + 0x4) - rdataSection,
        assetLength: buffer.readUInt32LE(dataAddress + 0x8),
        assetAddress: buffer.readUInt32LE(dataAddress + 0xC) - dataSection
    }
}

function generateModsList() {
    const mods = [];
    for (const entry of fs.readdirSync(path.join(setupPath, "mods"), { withFileTypes: true })) {
        if (entry.isDirectory()) {
            console.log("Mod found " + entry.name);
            mods.push(entry.name);
        }
    }
    console.log(`Found ${mods.length} mod(s)`);
    setupFile("mods.json", JSON.stringify(mods, null, 4));
}

const MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".wasm": "application/wasm",
    ".txt": "text/plain",
    ".map": "application/json"
};

function serve(req, res) {
    let file = decodeURIComponent(req.url.split("?")[0]);

    if (file === "/") {
        file = "/index.html";
    }

    const filePath = path.normalize(path.join(setupPath, file));

    if (!filePath.startsWith(setupPath)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("Not Found");
        }

        res.writeHead(200, {
            "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream"
        });

        res.end(data);
    });
}

function startServer() {
    http.createServer(serve).listen(config.port, () => {
        const url = "http://127.0.0.1:" + config.port;
        console.log(`Server running at ${url}`);

        switch (process.platform) {
            case "win32":
                spawn("cmd", ["/c", "start", "", url]);
                break;
            case "darwin":
                spawn("open", [url]);
                break;
            default:
                spawn("xdg-open", [url]);
        }
    });
}

async function main() {
    if (!fs.existsSync(path.join(setupPath, "index.html"))) {
        await setup();
    }
    generateModsList();
    startServer();
}

main().catch(console.error);