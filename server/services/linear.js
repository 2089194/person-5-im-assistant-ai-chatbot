const LINEAR_API = "https://api.linear.app/graphql";

async function gql(query, variables = {}) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("Linear is not configured (missing LINEAR_API_KEY).");

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey // Linear personal API keys go directly in Authorization, no "Bearer" prefix
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error("Linear API error: " + json.errors.map(e => e.message).join("; "));
  }
  return json.data;
}

async function searchIssues(query) {
  const data = await gql(
    `query($q: String!) {
      issueSearch(query: $q, first: 10) {
        nodes { identifier title state { name } priority url }
      }
    }`,
    { q: query }
  );
  return data.issueSearch.nodes;
}

async function listMyIssues() {
  const data = await gql(
    `query {
      viewer {
        assignedIssues(first: 20, orderBy: priority) {
          nodes { identifier title state { name } priority url }
        }
      }
    }`
  );
  return data.viewer.assignedIssues.nodes;
}

async function listTeams() {
  const data = await gql(
    `query {
      teams(first: 50) { nodes { id key name } }
    }`
  );
  return data.teams.nodes;
}

async function createIssue({ team_key, title, description, priority }) {
  const teams = await listTeams();
  const team = teams.find(t => t.key.toLowerCase() === String(team_key).toLowerCase());
  if (!team) {
    throw new Error(`No Linear team found with key "${team_key}". Available: ${teams.map(t => t.key).join(", ")}`);
  }
  const data = await gql(
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { identifier title url }
      }
    }`,
    { input: { teamId: team.id, title, description: description || "", priority: priority ?? 0 } }
  );
  return data.issueCreate.issue;
}

module.exports = { searchIssues, listMyIssues, listTeams, createIssue };
