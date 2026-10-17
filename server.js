import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { isSea } from "node:sea";
import { spawn } from "node:child_process";
import process from "node:process";

const port = 5050;

const setupPath = isSea() ? path.dirname(process.execPath) : path.join(process.cwd(), "mine-blocks");

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

function generateModsList() {
    const modsPath = path.join(setupPath, "mods");
    const mods = [];

    for (const entry of fs.readdirSync(modsPath, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            console.log("Mod found: " + entry.name);
            mods.push(entry.name);
        }
    }

    console.log(`Found ${mods.length} mod(s)`);

    fs.writeFileSync(
        path.join(setupPath, "mods.json"),
        JSON.stringify(mods, null, 4)
    );
}

function serve(req, res) {
    let file = decodeURIComponent(req.url.split("?")[0]);

    if (file === "/") file = "/index.html";

    const filePath = path.resolve(setupPath, "." + file);

    if (!filePath.startsWith(setupPath + path.sep) && filePath !== setupPath) {
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
    http.createServer(serve).listen(port, () => {
        const url = "http://127.0.0.1:" + port;
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

function main() {
    generateModsList();
    startServer();
}

main();