const http = require("http");
const dgram = require("dgram");

const host = process.env.OSC_BRIDGE_HOST || "127.0.0.1";
const port = Number(process.env.OSC_BRIDGE_PORT || 8765);
const udp = dgram.createSocket("udp4");

function corsHeaders(extra = {}) {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
        ...extra
    };
}

function sendJson(res, status, data) {
    res.writeHead(status, corsHeaders({ "Content-Type": "application/json; charset=utf-8" }));
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 64) {
                reject(new Error("Request too large"));
                req.destroy();
            }
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

function oscString(value) {
    const bytes = Buffer.from(`${value}\0`, "utf8");
    const padded = Math.ceil(bytes.length / 4) * 4;
    return Buffer.concat([bytes, Buffer.alloc(padded - bytes.length)]);
}

function oscFloat(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatBE(Number(value) || 0, 0);
    return buffer;
}

function oscMessage(address, value) {
    return Buffer.concat([
        oscString(address),
        oscString(",f"),
        oscFloat(value)
    ]);
}

function validAddress(address) {
    return typeof address === "string" && /^\/[A-Za-z0-9_\-/]+$/.test(address);
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }

    if (req.method === "GET" && req.url === "/status") {
        sendJson(res, 200, { ok: true, service: "Syntetika Engine OSC Bridge", port });
        return;
    }

    if (req.method !== "POST" || req.url !== "/osc") {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
    }

    try {
        const payload = JSON.parse(await readBody(req) || "{}");
        const targetHost = String(payload.host || "127.0.0.1").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const targetPort = Number(payload.port || 7000);
        const address = String(payload.address || "");
        const value = Number(payload.value);

        if (!validAddress(address)) throw new Error("Invalid OSC address");
        if (!Number.isFinite(targetPort) || targetPort < 1 || targetPort > 65535) throw new Error("Invalid OSC port");
        if (!Number.isFinite(value)) throw new Error("Invalid OSC value");

        const message = oscMessage(address, value);
        udp.send(message, targetPort, targetHost, (error) => {
            if (error) {
                sendJson(res, 500, { ok: false, error: error.message });
                return;
            }
            sendJson(res, 200, { ok: true, host: targetHost, port: targetPort, address, value });
        });
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
    }
});

server.listen(port, host, () => {
    console.log(`Syntetika Engine OSC Bridge running at http://${host}:${port}/osc`);
});
