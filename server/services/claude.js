const linear = require("./linear");
const outlook = require("./outlook");
const { buildToolset } = require("../tools/definitions");

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 6;

async function callClaude(messages, tools, system) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages,
      ...(tools.length ? { tools } : {})
    })
  });
  const data = await res.json();
  if (data.type === "error") {
    throw new Error(data.error?.message || "Claude API error");
  }
  return data;
}

// Executes a single tool_use block and returns its result content (string or error text)
async function executeTool(name, input) {
  try {
    switch (name) {
      case "linear_search_issues":
        return JSON.stringify(await linear.searchIssues(input.query));
      case "linear_list_my_issues":
        return JSON.stringify(await linear.listMyIssues());
      case "linear_list_teams":
        return JSON.stringify(await linear.listTeams());
      case "linear_create_issue":
        return JSON.stringify(await linear.createIssue(input));
      case "calendar_list_events":
        return JSON.stringify(await outlook.listEvents(input.time_min, input.time_max));
      case "calendar_create_event":
        return JSON.stringify(await outlook.createEvent(input));
      case "outlook_send_email":
        return JSON.stringify(await outlook.sendEmail(input));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Runs the full agentic loop: sends messages + tools to Claude, executes any
 * tool_use blocks against the real integrations, feeds results back, repeats
 * until Claude returns a final text answer (or the iteration cap is hit).
 *
 * Returns { text, toolLog, messages } where toolLog is a list of
 * { name, input, output } describing every tool call made, for the UI to display.
 */
async function runAgentTurn({ messages, system, linearEnabled, outlookEnabled }) {
  const tools = buildToolset({ linearEnabled, outlookEnabled });
  const working = [...messages];
  const toolLog = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await callClaude(working, tools, system);

    if (response.stop_reason !== "tool_use") {
      const text = (response.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n")
        .trim();
      return { text: text || "(no response)", toolLog, messages: working };
    }

    // Assistant turn containing tool_use block(s) must be appended as-is
    working.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    const toolResultBlocks = [];
    for (const block of toolUseBlocks) {
      const output = await executeTool(block.name, block.input || {});
      toolLog.push({ name: block.name, input: block.input, output });
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output
      });
    }
    working.push({ role: "user", content: toolResultBlocks });
  }

  return { text: "I hit my tool-call limit for this turn — let me know if you'd like me to continue.", toolLog, messages: working };
}

module.exports = { runAgentTurn };
