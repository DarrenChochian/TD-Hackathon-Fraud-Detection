function assertHttpUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }

  return parsed.toString()
}

async function fetchText(url, headers) {
  const response = await fetch(url, { method: 'GET', headers })
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Jina request failed (${response.status}): ${text.slice(0, 500)}`)
  }

  return text
}

function createJinaClient({ apiKey }) {
  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
  }

  return {
    async websearch(query) {
      if (!query || typeof query !== 'string') {
        throw new Error('websearch query is required')
      }

      const endpoint = `https://s.jina.ai/?q=${encodeURIComponent(query)}`
      const markdown = await fetchText(endpoint, {
        ...authHeaders,
        'X-Respond-With': 'no-content',
      })

      return {
        query,
        markdown,
      }
    },

    async webfetch(url) {
      const normalizedUrl = assertHttpUrl(url)
      const endpoint = `https://r.jina.ai/${normalizedUrl}`
      const markdown = await fetchText(endpoint, authHeaders)

      return {
        url: normalizedUrl,
        markdown,
      }
    },
  }
}

module.exports = {
  createJinaClient,
}
