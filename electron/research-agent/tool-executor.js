function parseArguments(toolCall) {
  if (toolCall?.function?.parsed_arguments) {
    return toolCall.function.parsed_arguments
  }

  const rawArguments = toolCall?.function?.arguments
  if (!rawArguments) return {}
  if (typeof rawArguments === 'object') return rawArguments

  try {
    return JSON.parse(rawArguments)
  } catch {
    return {}
  }
}

function getToolCallId(toolCall) {
  return toolCall?.id || toolCall?.tool_call_id || ''
}

async function executeWebsearch(args, jinaClient) {
  const queries = []
  if (typeof args.query === 'string' && args.query.trim()) {
    queries.push(args.query.trim())
  }
  if (Array.isArray(args.queries)) {
    for (const query of args.queries) {
      if (typeof query === 'string' && query.trim()) {
        queries.push(query.trim())
      }
    }
  }

  if (queries.length === 0) {
    throw new Error('websearch requires query or queries')
  }

  const results = await Promise.all(queries.map((query) => jinaClient.websearch(query)))
  return { results }
}

async function executeSingleToolCall(toolCall, context) {
  const toolCallId = getToolCallId(toolCall)
  const toolName = toolCall?.function?.name
  const args = parseArguments(toolCall)

  try {
    if (!toolCallId) {
      throw new Error('Tool call id is missing')
    }

    if (toolName === 'websearch') {
      const result = await executeWebsearch(args, context.jinaClient)
      return { tool_call_id: toolCallId, output: JSON.stringify(result) }
    }

    if (toolName === 'webfetch') {
      const result = await context.jinaClient.webfetch(args.url)
      return { tool_call_id: toolCallId, output: JSON.stringify(result) }
    }

    if (toolName === 'message') {
      const message = typeof args.message === 'string' ? args.message : 'Working...'
      context.onProgress({ type: 'progress', message })
      return { tool_call_id: toolCallId, output: JSON.stringify({ status: 'ok' }) }
    }

    if (toolName === 'summary') {
      context.onSummary(typeof args.summary === 'string' ? args.summary : '')
      return { tool_call_id: toolCallId, output: JSON.stringify({ status: 'ok' }) }
    }

    return {
      tool_call_id: toolCallId,
      output: JSON.stringify({ error: `Unsupported tool: ${toolName}` }),
    }
  } catch (error) {
    return {
      tool_call_id: toolCallId,
      output: JSON.stringify({
        error: error instanceof Error ? error.message : 'Tool execution failed',
        tool: toolName,
      }),
    }
  }
}

async function executeToolCalls(toolCalls, context) {
  const outputs = await Promise.all(toolCalls.map((toolCall) => executeSingleToolCall(toolCall, context)))
  return outputs
}

module.exports = {
  executeToolCalls,
}
