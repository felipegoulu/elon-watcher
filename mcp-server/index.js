import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "http";
import { URL } from "url";

const PORT = process.env.PORT || 3002;
const API_URL = process.env.API_URL || "https://elon-watcher-production.up.railway.app";
const API_TOKEN = process.env.API_TOKEN || ""; // Optional: for authenticated requests

// Helper to call the backend API
async function apiCall(method, path, body = null) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  
  if (API_TOKEN) {
    options.headers["Authorization"] = `Bearer ${API_TOKEN}`;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(url, options);
  return res.json();
}

// Create MCP server
const server = new McpServer({
  name: "pinchme",
  version: "1.0.0",
});

// Tool: List handles
server.tool(
  "list_handles",
  "List all Twitter/X handles being monitored",
  {},
  async () => {
    try {
      const config = await apiCall("GET", "/config");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              handles: config.handles || [],
              count: (config.handles || []).length,
              pollIntervalMinutes: config.pollIntervalMinutes,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Add handle
server.tool(
  "add_handle",
  "Add a Twitter/X handle to monitor",
  {
    handle: {
      type: "string",
      description: "Twitter/X username (without @)",
    },
  },
  async ({ handle }) => {
    try {
      // Get current config
      const config = await apiCall("GET", "/config");
      const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
      
      if (config.handles.includes(cleanHandle)) {
        return {
          content: [{ type: "text", text: `@${cleanHandle} is already being monitored` }],
        };
      }
      
      // Add handle and save
      config.handles.push(cleanHandle);
      await apiCall("PUT", "/config", config);
      
      return {
        content: [{ type: "text", text: `Added @${cleanHandle} to monitoring. Now tracking ${config.handles.length} accounts.` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Remove handle
server.tool(
  "remove_handle",
  "Remove a Twitter/X handle from monitoring",
  {
    handle: {
      type: "string",
      description: "Twitter/X username to remove (without @)",
    },
  },
  async ({ handle }) => {
    try {
      const config = await apiCall("GET", "/config");
      const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
      
      if (!config.handles.includes(cleanHandle)) {
        return {
          content: [{ type: "text", text: `@${cleanHandle} is not being monitored` }],
        };
      }
      
      config.handles = config.handles.filter((h) => h !== cleanHandle);
      await apiCall("PUT", "/config", config);
      
      return {
        content: [{ type: "text", text: `Removed @${cleanHandle}. Now tracking ${config.handles.length} accounts.` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Configure handle
server.tool(
  "configure_handle",
  "Configure notification settings for a specific handle",
  {
    handle: {
      type: "string",
      description: "Twitter/X username (without @)",
    },
    mode: {
      type: "string",
      description: "Notification mode: 'now' (instant) or 'next-heartbeat' (batched)",
      enum: ["now", "next-heartbeat"],
    },
    prompt: {
      type: "string",
      description: "Custom prompt/instructions for processing tweets from this account (optional)",
    },
    channel: {
      type: "string",
      description: "Channel to send notifications: 'telegram', 'whatsapp', 'discord', or empty for default",
    },
  },
  async ({ handle, mode, prompt, channel }) => {
    try {
      const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
      
      const configData = {};
      if (mode) configData.mode = mode;
      if (prompt !== undefined) configData.prompt = prompt;
      if (channel !== undefined) configData.channel = channel;
      
      await apiCall("PUT", `/handle-config/${cleanHandle}`, configData);
      
      return {
        content: [{ 
          type: "text", 
          text: `Updated config for @${cleanHandle}: ${JSON.stringify(configData)}` 
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get handle config
server.tool(
  "get_handle_config",
  "Get configuration for a specific handle",
  {
    handle: {
      type: "string",
      description: "Twitter/X username (without @)",
    },
  },
  async ({ handle }) => {
    try {
      const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
      const configs = await apiCall("GET", "/handle-config");
      const config = configs.find((c) => c.handle === cleanHandle);
      
      if (!config) {
        return {
          content: [{ type: "text", text: `No custom config for @${cleanHandle} (using defaults)` }],
        };
      }
      
      return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Poll now
server.tool(
  "poll_now",
  "Trigger an immediate poll for new tweets",
  {},
  async () => {
    try {
      await apiCall("POST", "/poll");
      return {
        content: [{ type: "text", text: "Poll triggered. New tweets will be sent to the webhook shortly." }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get recent tweets
server.tool(
  "get_recent_tweets",
  "Get recently captured tweets",
  {
    limit: {
      type: "number",
      description: "Number of tweets to return (default: 10, max: 50)",
    },
    handle: {
      type: "string",
      description: "Filter by handle (optional)",
    },
  },
  async ({ limit = 10, handle }) => {
    try {
      let url = `/sent-tweets?limit=${Math.min(limit, 50)}`;
      const data = await apiCall("GET", url);
      
      let tweets = data;
      if (handle) {
        const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();
        tweets = tweets.filter((t) => t.handle === cleanHandle);
      }
      
      if (tweets.length === 0) {
        return {
          content: [{ type: "text", text: "No recent tweets found" }],
        };
      }
      
      const summary = tweets.map((t) => ({
        handle: `@${t.handle}`,
        text: t.tweet_text?.substring(0, 100) + (t.tweet_text?.length > 100 ? "..." : ""),
        status: t.status,
        time: t.created_at,
      }));
      
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get status
server.tool(
  "get_status",
  "Get current monitoring status",
  {},
  async () => {
    try {
      const [config, status] = await Promise.all([
        apiCall("GET", "/config"),
        apiCall("GET", "/status"),
      ]);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            handles: config.handles?.length || 0,
            pollIntervalMinutes: config.pollIntervalMinutes,
            webhookConfigured: !!config.webhookUrl,
            lastPoll: status.state?.lastPoll || null,
            trackedAccounts: Object.keys(status.state?.lastSeenIds || {}).length,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Set poll interval
server.tool(
  "set_poll_interval",
  "Set the polling interval in minutes",
  {
    minutes: {
      type: "number",
      description: "Poll interval in minutes (1-60)",
    },
  },
  async ({ minutes }) => {
    try {
      if (minutes < 1 || minutes > 60) {
        return {
          content: [{ type: "text", text: "Interval must be between 1 and 60 minutes" }],
          isError: true,
        };
      }
      
      const config = await apiCall("GET", "/config");
      config.pollIntervalMinutes = minutes;
      await apiCall("PUT", "/config", config);
      
      return {
        content: [{ type: "text", text: `Poll interval set to ${minutes} minutes` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// HTTP server with SSE transport
const transports = new Map();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "pinchme-mcp" }));
    return;
  }
  
  // SSE endpoint
  if (url.pathname === "/sse") {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport, true);
    
    res.on("close", () => {
      transports.delete(transport);
    });
    
    await server.connect(transport);
    return;
  }
  
  // Messages endpoint for SSE
  if (url.pathname === "/messages" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      // Find the transport and send the message
      for (const [transport] of transports) {
        try {
          await transport.handlePostMessage(req, res, body);
          return;
        } catch (e) {
          // Try next transport
        }
      }
      res.writeHead(404);
      res.end("No active session");
    });
    return;
  }
  
  // Root - info
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name: "PinchMe MCP Server",
      version: "1.0.0",
      description: "MCP server for PinchMe tweet monitoring",
      endpoints: {
        sse: "/sse",
        health: "/health",
      },
      tools: [
        "list_handles",
        "add_handle", 
        "remove_handle",
        "configure_handle",
        "get_handle_config",
        "poll_now",
        "get_recent_tweets",
        "get_status",
        "set_poll_interval",
      ],
    }));
    return;
  }
  
  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log("================================");
  console.log("  PinchMe MCP Server");
  console.log("================================");
  console.log(`Port: ${PORT}`);
  console.log(`API: ${API_URL}`);
  console.log(`SSE: http://localhost:${PORT}/sse`);
  console.log("================================");
});
