const RESEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'websearch',
      description: 'Run web search using Jina AI for one or more research queries about legitimacy, fraud risk, policies, reputation, events, hackathons, companies, or other relevant context. For named event or hackathon legitimacy questions, this is the required first tool call before asking the user for more context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Single research query.',
          },
          queries: {
            type: 'array',
            description: 'Multiple research queries that can be executed in parallel.',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'webfetch',
      description: 'Fetch and return markdown content for a URL using Jina AI. After using websearch for named event or hackathon legitimacy questions, fetch the most relevant official or reputable result pages. For named-company scam analysis, fetch official company security, fraud, policy, or terms pages before summarizing when available.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Absolute URL to fetch.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'message',
      description: 'Send a progress update to the user.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Progress update for the user.',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summary',
      description: 'End the loop by returning final markdown summary to the user.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Final markdown summary.',
          },
        },
        required: ['summary'],
      },
    },
  },
]

module.exports = {
  RESEARCH_TOOLS,
}
