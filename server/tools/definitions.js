// Tool schemas exposed to Claude. Each is only included if the relevant
// integration has credentials configured (see server/index.js).

const linearTools = [
  {
    name: "linear_search_issues",
    description: "Search Linear issues by a text query across the whole workspace. Use before creating an issue to check for duplicates, or when the user asks to find/search something in Linear.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text search query." }
      },
      required: ["query"]
    }
  },
  {
    name: "linear_list_my_issues",
    description: "List Linear issues currently assigned to the authenticated user, ordered by priority.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "linear_list_teams",
    description: "List Linear teams and their keys. Use this to find the correct team_key before creating an issue if you don't already know it.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "linear_create_issue",
    description: "Create a new Linear issue in a given team.",
    input_schema: {
      type: "object",
      properties: {
        team_key: { type: "string", description: "The Linear team key, e.g. 'ENG'. Use linear_list_teams if unknown." },
        title: { type: "string" },
        description: { type: "string", description: "Markdown description, optional." },
        priority: { type: "integer", description: "0=none, 1=urgent, 2=high, 3=normal, 4=low" }
      },
      required: ["team_key", "title"]
    }
  }
];

const calendarTools = [
  {
    name: "calendar_list_events",
    description: "List Outlook Calendar events between two ISO 8601 datetimes. Use this to check for scheduling conflicts before proposing or creating a time block.",
    input_schema: {
      type: "object",
      properties: {
        time_min: { type: "string", description: "ISO 8601 datetime, e.g. 2026-07-08T00:00:00-04:00" },
        time_max: { type: "string", description: "ISO 8601 datetime" }
      },
      required: ["time_min", "time_max"]
    }
  },
  {
    name: "calendar_create_event",
    description: "Create an event on the user's Outlook Calendar.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        description: { type: "string" },
        start: { type: "string", description: "ISO 8601 datetime" },
        end: { type: "string", description: "ISO 8601 datetime" },
        attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses, optional." }
      },
      required: ["summary", "start", "end"]
    }
  }
];

const outlookMailTools = [
  {
    name: "outlook_send_email",
    description: "Send an email through the user's Outlook/Microsoft 365 account.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text email body." }
      },
      required: ["to", "subject", "body"]
    }
  }
];

function buildToolset({ linearEnabled, outlookEnabled }) {
  let tools = [];
  if (linearEnabled) tools = tools.concat(linearTools);
  if (outlookEnabled) tools = tools.concat(calendarTools).concat(outlookMailTools);
  return tools;
}

module.exports = { buildToolset };
