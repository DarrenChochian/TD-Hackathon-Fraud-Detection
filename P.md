we need a research agent similar to claude code as a backend. the env keys are in /Users/q/Desktop/projects/TD-Hackathon-Fraud-Detection/.env.example

how it will work.

jina ai - the websearch and webfetch tool.

webfetch:
curl "https://r.jina.ai/https://www.example.com" \
  -H "Authorization: Bearer JINA_API_KEY"

websearch:
curl "https://s.jina.ai/?q=Jina+AI" \
  -H "Authorization: Bearer JINA_API_KEY" \
  -H "X-Respond-With: no-content"

backboard - the llm backend, use for the api docs /Users/q/Desktop/projects/TD-Hackathon-Fraud-Detection/docs

so there are only like a few main tools for the agent. here are the tools and the response back the to llm agent loop.
- websearch - serp search
    - input: research quer(ies)
    - response: json with markdown serp list
- webfetch - fetch a url
    - input: url
    - response: json with markdown web return
- message - update the user on progress and what it is doing.
    - input: message to display to the user
    - response {'status': ok} or another keep alive
- summary - call this to end the agent loop
    - input: summary, markdown format.
    - response {'status': ok} or another keep alive

so for now the user will input a prompt, and it would intiate the agent which will run tool calls in parallel to research the prompt. the system prompt should be in a seperate file. so it will keep looping the agent (keep alive) until it hits summary, where the agent inputs a summary that gives the user a result.

think of the architecture as a senior swe, ensure everything is modular and files are <300 lines of code each. 

