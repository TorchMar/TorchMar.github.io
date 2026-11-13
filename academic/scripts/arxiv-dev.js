import fs from "node:fs";
import { createArxivService } from "../src/utils/arxivQuery.js";
import { createFigureService } from "../src/utils/arxivFigures.js";

export function arxivDevPlugin() {
  return {
    name: "arxiv-recommendations-dev",
    configureServer(server) {
      const configPath = new URL("../config/paper-recommendations.json", import.meta.url);
      const publicationsPath = new URL("../config/publications.json", import.meta.url);
      const readConfig = () => JSON.stringify({ ...JSON.parse(fs.readFileSync(configPath, "utf8")), publications: JSON.parse(fs.readFileSync(publicationsPath, "utf8")) });
      let configText = readConfig();
      let getFeed = createArxivService(JSON.parse(configText));
      const getFigure = createFigureService();
      server.middlewares.use("/api/arxiv", async (req, res) => {
        if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
        try {
          const latestConfig = readConfig();
          if (latestConfig !== configText) {
            getFeed = createArxivService(JSON.parse(latestConfig));
            configText = latestConfig;
          }
          const params = new URL(req.url, "http://localhost").searchParams;
          const response = params.has("figure") ? await getFigure(params.get("figure")) : await getFeed(params.get("paper") || "", params.get("expanded") === "1");
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch { res.writeHead(503); res.end("arXiv is temporarily unavailable"); }
      });
    },
  };
}
