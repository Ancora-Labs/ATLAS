## YOUR TASK
Below is the raw research output from the Research Scout.
It contains 5 source(s) with extracted findings.
Your job: synthesize this into a structured, topic-organized output that Prometheus can use for planning.
Follow your agent definition's output format exactly.
Do NOT lose useful information. Compress the format, not the content.
If sources contradict each other, document the contradiction explicitly.

## RESEARCH SCOUT RAW OUTPUT
I’ll pull high-signal Copilot/agent docs first, then branch into orchestration/benchmark sources and extract only the top findings.



● Search GitHub Docs for Copilot agent pages (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $u='https://docs.github.com/en/search?query=Copilot%20coding%20agent%20MCP';
  │ $c=(Invoke-WebRequest -UseBasicParsing $u).Content; ($c -split '"') | Where-Object {$_ -like
  │ '/en/*' -and $_ -match 'copilot|mcp|agent|coding'} | Select-Object -Unique | Select-Object
  │ -First 40
  └ 19 lines...

● Fetch initial excerpts from candidate web sources (shell)
  │ $ProgressPreference='SilentlyContinue'; $urls=@(
  │ 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agen
  │ t-with-mcp',
  │ 'https://docs.github.com/en/copilot/concepts/agents/coding-agent/mcp-and-coding-agent',
  │ 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agen…
  └ 125 lines...

I found cleaner access paths via source markdown/repos, so I’m switching to raw docs and code files to extract exact APIs and schemas.



● Probe SWE-bench site for leaderboard path (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $urls=@('https://www.swebench.com','https://www.swebench.com/leaderboard.html','https://www.sw
  │ ebench.com/verified.html','https://www.swebench.com/data','https://www.swebench.com/assets');
  │ foreach($u in $urls){try{$r=Invoke-WebRequest -UseBasicParsing $u; "===URL=== $u`nSTATUS:
  │ $($r.StatusCode)`nLEN: $($r.Content.Length)"; ($r.Content -replace '<[^>]+>',' ' -replace …
  └ 22 lines...

● Fetch raw markdown and source files for targeted sources (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $urls=@(
  │ 'https://raw.githubusercontent.com/github/docs/main/content/copilot/how-tos/use-copilot-agents
  │ /coding-agent/extend-coding-agent-with-mcp.md',
  │ 'https://raw.githubusercontent.com/github/docs/main/content/copilot/how-tos/use-copilot-agents…
  └ 274 lines...

● List LangGraph docs directory to locate durable execution doc (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $api='https://api.github.com/repos/langchain-ai/langgraph/contents/docs?ref=main';
  │ $r=Invoke-WebRequest -UseBasicParsing -Headers @{"User-Agent"="box-research"} $api;
  │ ($r.Content|ConvertFrom-Json)|Select-Object name,path,type | Format-Table -AutoSize | Out-String
  │ -Width 220
  └ 7 lines...

● List AutoGen group chat source files (shell)
  │ $ProgressPreference='SilentlyContinue'; $api='https://api.github.com/repos/microsoft/autogen/con
  │ tents/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat?ref=main';
  │ $r=Invoke-WebRequest -UseBasicParsing -Headers @{"User-Agent"="box-research"} $api;
  │ ($r.Content|ConvertFrom-Json)|Select-Object name,path,type | Format-Table -AutoSize | Out-String
  │ -Width 220
  └ 14 lines...

● List GitHub docs copilot-cli how-to directory (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $api='https://api.github.com/repos/github/docs/contents/content/copilot/how-tos/copilot-cli';
  │ $r=Invoke-WebRequest -UseBasicParsing -Headers @{"User-Agent"="box-research"} $api;
  │ $j=$r.Content|ConvertFrom-Json; $j|Select-Object name,path,type | Format-Table -AutoSize |
  │ Out-String -Width 220
  └ 15 lines...

● Extract URLs from SWE-bench homepage for data endpoints (shell)
  │ $ProgressPreference='SilentlyContinue'; $c=(Invoke-WebRequest -UseBasicParsing
  │ 'https://www.swebench.com').Content; [regex]::Matches($c,'https://[^"''\s>]+') | ForEach-Object
  │ {$_.Value} | Where-Object {$_ -match 'json|leaderboard|api|swebench|huggingface|cdn'} |
  │ Select-Object -Unique | Select-Object -First 120
  └ 27 lines...

● List Copilot reference docs to locate config schemas (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $api='https://api.github.com/repos/github/docs/contents/content/copilot/reference?ref=main';
  │ $j=(Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='box-research'}
  │ $api).Content|ConvertFrom-Json;
  │ $j|Select-Object name,path|Format-Table -AutoSize|Out-String -Width 220;
  └ 22 lines...

● Find durable execution docs path in langgraph repository (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $tree='https://api.github.com/repos/langchain-ai/langgraph/git/trees/main?recursive=1';
  │ $j=(Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='box-research'}
  │ $tree).Content|ConvertFrom-Json;
  │ $j.tree | Where-Object {$_.path -match 'durable|checkpoint|persistence' -and $_.path -match …
  └ 2 lines...

● Find workflow docs paths in Temporal documentation repo (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $tree='https://api.github.com/repos/temporalio/documentation/git/trees/main?recursive=1';
  │ $j=(Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='box-research'}
  │ $tree).Content|ConvertFrom-Json;
  │ $j.tree | Where-Object {$_.path -match 'workflow' -and $_.path -match …
  └ 28 lines...

● Locate SWE-bench data endpoints from homepage HTML (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $c=(Invoke-WebRequest -UseBasicParsing 'https://www.swebench.com').Content;
  │ 'JSON_MATCHES'; ([regex]::Matches($c,'[^"''\s>]+\.json')) | ForEach-Object {$_.Value} |
  │ Select-Object -Unique | Select-Object -First 80;
  │ 'SCRIPT_MATCHES'; ([regex]::Matches($c,'[^"''\s>]+\.(js|mjs)')) | ForEach-Object {$_.Value} | …
  └ 26 lines...

● List Copilot CLI subdirectories for target markdown files (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $api='https://api.github.com/repos/github/docs/contents/content/copilot/how-tos/copilot-cli/au
  │ tomate-copilot-cli?ref=main';
  │ $j=(Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='box-research'}
  │ $api).Content|ConvertFrom-Json;…
  └ 38 lines...

● Fetch primary markdown and source files for extraction (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $urls=@(
  │ 'https://raw.githubusercontent.com/github/docs/main/content/copilot/how-tos/copilot-cli/automa
  │ te-copilot-cli/run-cli-programmatically.md',
  │ 'https://raw.githubusercontent.com/github/docs/main/content/copilot/how-tos/copilot-cli/custom…
  └ 46 lines...

● Read copilot-tool-output-1775075473987-hu4mef.txt
  │ ~\AppData\Local\Temp\copilot-tool-output-1775075473987-hu4mef.txt
  └ L1:220 (220 lines read)

● Search LangGraph repository tree for durable/checkpoint docs (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $tree='https://api.github.com/repos/langchain-ai/langgraph/git/trees/main?recursive=1';
  │ $j=(Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='box-research'}
  │ $tree).Content|ConvertFrom-Json; $j.tree | Where-Object {$_.path -match
  │ 'durable|persistence|checkpoint|checkpointer'} | Select-Object -First 120 path | Format-Table …
  └ 124 lines...

● Fetch SWE-bench JS data files with leaderboard content (shell)
  │ $ProgressPreference='SilentlyContinue'; $urls=@('https://www.swebench.com/js/mainResults.js','
  │ https://www.swebench.com/js/leaderboardFilters.js','https://www.swebench.com/js/analysis.js','
  │ https://www.swebench.com/js/tableByYear.js','https://www.swebench.com/js/tableByRepo.js');
  │ foreach($u in $urls){try{$c=(Invoke-WebRequest -UseBasicParsing $u).Content; "===URL===
  │ $u`nLEN=$($c.Length)"; $c.Substring(0,[Math]::Min(2200,$c.Length)); "---"}catch{"===URL=== …
  └ 282 lines...

● Read copilot-tool-output-1775075473987-hu4mef.txt
  │ ~\AppData\Local\Temp\copilot-tool-output-1775075473987-hu4mef.txt
  └ L220:520 (301 lines read)

● Get line count and URL marker positions in fetched output file (shell)
  │ $p='C:\Users\caner\AppData\Local\Temp\copilot-tool-output-1775075473987-hu4mef.txt';
  │ (Get-Content $p | Measure-Object -Line).Lines; Select-String -Path $p -Pattern '^===URL===' |
  │ ForEach-Object {"$($_.LineNumber): $($_.Line)"}
  └ 13 lines...

● Read copilot-tool-output-1775075473987-hu4mef.txt
  │ ~\AppData\Local\Temp\copilot-tool-output-1775075473987-hu4mef.txt
  └ L520:971 (452 lines read)

● Fetch checkpoint READMEs and temporal workflow docs excerpts (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $urls=@(
  │ 'https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/README.md',
  │ 'https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint-sqlite/README.m
  │ d',…
  └ 18 lines...

● Read copilot-tool-output-1775075530614-9jsfjc.txt
  │ ~\AppData\Local\Temp\copilot-tool-output-1775075530614-9jsfjc.txt
  └ L1:260 (260 lines read)

● Fetch SWE-bench experiment JSON endpoints for leaderboard data (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $base='https://raw.githubusercontent.com/swe-bench/experiments/main';
  │ $paths=@(
  │ 'evaluation/verified/bash-only/leaderboard.json',
  │ 'evaluation/verified/bash-only/results/results.json',…
  └ 27 lines...

● View tail of fetched output file for remaining source sections (shell)
  │ $p='C:\Users\caner\AppData\Local\Temp\copilot-tool-output-1775075473987-hu4mef.txt'; Get-Content
  │ $p -Tail 120
  └ 106 lines...

● Fetch AutoGen base group chat manager source (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $u='https://raw.githubusercontent.com/microsoft/autogen/main/python/packages/autogen-agentchat
  │ /src/autogen_agentchat/teams/_group_chat/_base_group_chat_manager.py';
  │ $c=(Invoke-WebRequest -UseBasicParsing $u).Content;
  │ "LEN=$($c.Length)";…
  └ 154 lines...

● Inspect swe-bench experiments repo for data file paths (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $urls=@(
  │ 'https://raw.githubusercontent.com/swe-bench/experiments/main/README.md',
  │ 'https://api.github.com/repos/swe-bench/experiments/contents?ref=main',
  │ 'https://api.github.com/repos/swe-bench/experiments/git/trees/main?recursive=1'…
  └ 56 lines...

I’ve got enough candidates; next I’m pulling exact schema/code sections (not just intros) so the extracted content is implementation-grade.



● Extract embedded SWE-bench leaderboard JSON from homepage (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $c=(Invoke-WebRequest -UseBasicParsing 'https://www.swebench.com').Content;
  │ $m=[regex]::Match($c,'<script id="leaderboard-data"
  │ type="application/json">([\s\S]*?)</script>');
  │ if($m.Success){$json=$m.Groups[1].Value; …
  └ 8 lines...

● Download key source files to local temp for detailed inspection (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $map=@{
  │ 'copilot_run_prog.md'='https://raw.githubusercontent.com/github/docs/main/content/copilot/how-
  │ tos/copilot-cli/automate-copilot-cli/run-cli-programmatically.md';
  │ 'copilot_mcp_cli.md'='https://raw.githubusercontent.com/github/docs/main/content/copilot/how-t…
  └ 36 lines...

● Extract key sections/fields from Copilot docs files (shell)
  │ $d='C:\Users\caner\AppData\Local\Temp\box-research-scout'; Get-ChildItem $d | Select-Object
  │ Name,Length | Format-Table -AutoSize | Out-String -Width 220;
  │ '--- COPILOT CUSTOM AGENT KEYS ---'; Select-String -Path (Join-Path $d
  │ 'copilot_custom_agents_config.md') -Pattern '^[#]|\| `|```yaml|```json|mcp-servers|tools|model
  │ |disable-model-invocation|user-invocable|metadata|timeout|exit_code|hooks' | Select-Object …
  └ 29 lines...

● Extract API/flow signatures from Temporal/LangGraph/AutoGen files (shell)
  │ $d='C:\Users\caner\AppData\Local\Temp\box-research-scout';
  │ '--- TEMPORAL CORE KEYS ---'; Select-String -Path (Join-Path $d 'temporal_ts_core.mdx')
  │ -Pattern '```ts|Connection.connect|Client|Worker.create|workflowsPath|activities|taskQueue|exe
  │ cute\(|proxyActivities|setHandler|Signal|Query|RetryPolicy|maximumAttempts|scheduleToCloseTime
  │ out|startToCloseTimeout|continueAsNew|workflowId|WorkflowIdReusePolicy' | Select-Object -First…
  └ 26 lines...

● Find leaderboard JSON injection pattern in SWE-bench HTML (shell)
  │ $ProgressPreference='SilentlyContinue'; $c=(Invoke-WebRequest -UseBasicParsing
  │ 'https://www.swebench.com').Content;
  │ Select-String -InputObject $c -Pattern 'leaderboard-data|application/json|results|resolved|ins
  │ tance_cost|bash-only|Verified|leaderboard' -AllMatches | Select-Object -First 80 |
  │ ForEach-Object {$_.Line};…
  └ 22 lines...

● Read copilot_hooks_config.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_hooks_config.md
  └ L440:860 (118 lines read)

● Read copilot_custom_agents_config.md
  └ ~\AppData\Local\Temp\box-research-scout\copilot_custom_agents_config.md

● Read copilot_run_prog.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_run_prog.md
  └ L12:220 (157 lines read)

● Read copilot_mcp_cli.md
  └ ~\AppData\Local\Temp\box-research-scout\copilot_mcp_cli.md

● Read copilot_custom_agents_config.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_custom_agents_config.md
  └ L1:320 (161 lines read)

● Read copilot_mcp_cli.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_mcp_cli.md
  └ L1:260 (103 lines read)

● Read copilot_hooks_config.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_hooks_config.md
  └ L1:440 (440 lines read)

● Get precise line matches and locate SWE-bench data files (shell)
  │ $d='C:\Users\caner\AppData\Local\Temp\box-research-scout';
  │ '---TEMPORAL Worker.create---'; Select-String -Path (Join-Path $d 'temporal_ts_core.mdx')
  │ -Pattern 'Worker\.create|Connection\.connect|new
  │ Client|client\.workflow\.start|proxyActivities|execute\(|RetryPolicy|maximumAttempts|startToCl
  │ oseTimeout|scheduleToCloseTimeout|workflowId|taskQueue|Continue-As-New|setHandler\(' | …
  └ 27 lines...

● Read copilot-tool-output-1775075638849-kl2jc4.txt
  │ ~\AppData\Local\Temp\copilot-tool-output-1775075638849-kl2jc4.txt
  └ L1:260 (260 lines read)

● Extract Temporal TypeScript code examples around key API lines (shell)
  │ $d='C:\Users\caner\AppData\Local\Temp\box-research-scout';
  │ '--- temporal code blocks around key lines ---';
  │ $lines=(Get-Content (Join-Path $d 'temporal_ts_core.mdx')); foreach($n in
  │ 220,280,330,520,820,930,1080){"### around $n"; $start=[Math]::Max(1,$n-20);
  │ $end=[Math]::Min($lines.Count,$n+35); for($i=$start;$i -le $end;$i++){"$i`: …
  └ 443 lines...

● Search saved SWE-bench HTML for embedded data and script paths (shell)
  │ $f='C:\Users\caner\AppData\Local\Temp\copilot-tool-output-1775075608752-ovs0ie.txt';
  │ 'SIZE'; (Get-Item $f).Length;
  │ 'LEADERBOARD PATTERNS'; Select-String -Path $f -Pattern 'leaderboard-data|application/json|mai
  │ nResults|results\"|resolved|instance_cost|bash-only|Verified|JSON.parse|fetch\(' |
  │ Select-Object -First 80 | ForEach-Object {"$($_.LineNumber): $($_.Line.Trim())"};…
  └ 152 lines...

● Read autogen_selector_group_chat.py
  │ ~\AppData\Local\Temp\box-research-scout\autogen_selector_group_chat.py
  └ L140:340 (201 lines read)

● Read copilot_mcp_cloud.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_mcp_cloud.md
  └ L140:320 (180 lines read)

● Read temporal_ts_core.mdx
  │ ~\AppData\Local\Temp\box-research-scout\temporal_ts_core.mdx
  └ L1028:1148 (120 lines read)

● Read temporal_ts_core.mdx
  │ ~\AppData\Local\Temp\box-research-scout\temporal_ts_core.mdx
  └ L700:760 (61 lines read)

● Extract and parse embedded SWE-bench leaderboard JSON to local file (shell)
  │ $f='C:\Users\caner\AppData\Local\Temp\copilot-tool-output-1775075608752-ovs0ie.txt';
  │ $raw=Get-Content $f -Raw;
  │ $m=[regex]::Match($raw,'<script type="application/json"
  │ id="leaderboard-data">([\s\S]*?)</script>');
  │ if(-not $m.Success){'no-match'; exit 0}…
  └ 27 lines...

● Read swebench_leaderboard_data.json
  │ ~\AppData\Local\Temp\box-research-scout\swebench_leaderboard_data.json
  └ L1:80 (80 lines read)

● Inspect extracted swebench JSON raw content for parse issues (shell)
  │ $f='C:\Users\caner\AppData\Local\Temp\box-research-scout\swebench_leaderboard_data.json';
  │ $raw=Get-Content $f -Raw;
  │ 'len='+$raw.Length;
  │ 'contains-html-entities=' + ($raw -match '&quot;|&amp;|&lt;|&gt;');
  │ 'contains-trailing-script=' + ($raw -match '</script>|<script');…
  └ 18 lines...

● Inspect exact escaped chars around first model name in JSON (shell)
  │ $f='C:\Users\caner\AppData\Local\Temp\box-research-scout\swebench_leaderboard_data.json';
  │ $raw=[System.IO.File]::ReadAllText($f);
  │ $idx=$raw.IndexOf('"name": "Claude'); "idxClaude=$idx";
  │ $start=[Math]::Max(0,$idx-120); $len=[Math]::Min(320,$raw.Length-$start);
  │ $seg=$raw.Substring($start,$len);…
  └ 334 lines...

● Apply minimal quote fix and parse leaderboard JSON (shell)
  │ $f='C:\Users\caner\AppData\Local\Temp\box-research-scout\swebench_leaderboard_data.json';
  │ $raw=[System.IO.File]::ReadAllText($f);
  │ $fixed=$raw -replace '"name":\s*"\s*"','"name": "';
  │ try{$obj=$fixed|ConvertFrom-Json -Depth 100; "parsed=true leaderboards=$($obj.Count)";
  │ $obj|Select-Object -First 5 -Property name,@{n='rows';e={$_.results.Count}}|Format-Table …
  └ 8 lines...

● Read copilot_mcp_cloud.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_mcp_cloud.md
  └ L1:140 (140 lines read)

● Read temporal_workflow_exec.mdx
  └ ~\AppData\Local\Temp\box-research-scout\temporal_workflow_exec.mdx

● Read autogen_selector_group_chat.py
  │ ~\AppData\Local\Temp\box-research-scout\autogen_selector_group_chat.py
  └ L340:760 (391 lines read)

● Read copilot_mcp_cloud.md
  │ ~\AppData\Local\Temp\box-research-scout\copilot_mcp_cloud.md
  └ L320:520 (73 lines read)

● Extract hook structure and fetch CLI programmatic reference (shell)
  │ $d='C:\Users\caner\AppData\Local\Temp\box-research-scout';
  │ 'HOOK STRUCTURE'; Select-String -Path (Join-Path $d 'copilot_hooks_config.md') -Pattern
  │ 'version|hooks|sessionStart|sessionEnd|preToolUse|postToolUse|errorOccurred|userPromptSubmitte
  │ d|type\": \"command\"|timeoutSec|cwd|bash|powershell' | Select-Object -First 120 |
  │ ForEach-Object {"$($_.LineNumber): $($_.Line)"};…
  └ 137 lines...

● Read CLI programmatic reference content for exact option docs (shell)
  │ $p='C:\Users\caner\AppData\Local\Temp\box-research-scout\copilot_cli_programmatic_ref.md';
  │ if(Test-Path $p){Get-Content $p -TotalCount 220}
  └ 160 lines...

● Fetch SWE-bench page and parse embedded leaderboard JSON directly (shell)
  │ $ProgressPreference='SilentlyContinue';
  │ $html=(Invoke-WebRequest -UseBasicParsing 'https://www.swebench.com').Content;
  │ $m=[regex]::Match($html,'<script type="application/json"
  │ id="leaderboard-data">([\s\S]*?)</script>');
  │ if(-not $m.Success){'no-script'; exit 0}…
  └ 57 lines...

● Extract SWE-bench leaderboard schema and sample rows (shell)
  │ $html=(Invoke-WebRequest -UseBasicParsing 'https://www.swebench.com').Content;
  │ $m=[regex]::Match($html,'<script type="application/json"
  │ id="leaderboard-data">([\s\S]*?)</script>'); $obj=($m.Groups[1].Value.Trim() |
  │ ConvertFrom-Json -Depth 100);
  │ 'leaderboard_names'; $obj.name;…
  └ 113 lines...

### [Source 1] GitHub Copilot CLI programmatic reference

- **URL**: https://raw.githubusercontent.com/github/docs/main/content/copilot/reference/copilot-cli-reference/cli-programmatic-reference.md
- **Source Type**: docs
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: copilot-cli, automation, permissions, model-routing, CI/CD
- **Confidence Score**: 0.97
- **Why Important**: This is the concrete execution contract for running Copilot as a non-interactive worker in autonomous loops.

- **Extracted Content**:  
  **Exact API / CLI surface**
  - `copilot -p PROMPT` → non-interactive execution then exit.
  - `-s` → suppress metadata/stats; output only agent response.
  - `--agent=AGENT` → force custom agent.
  - Permission envelope:
    - `--allow-tool=...`
    - `--allow-url=...`
    - `--deny-tool=...`
    - `--allow-all` (`--yolo`) = `--allow-all-tools --allow-all-paths --allow-all-urls`
    - `--add-dir=DIR`, `--allow-all-paths`
  - Model control:
    - `--model=MODEL`
    - model precedence: **agent model > `--model` > `COPILOT_MODEL` > config model > CLI default**
  - Non-interactive robustness:
    - `--no-ask-user`
    - `--secret-env-vars=VAR...` (redaction)
    - `--share=PATH`, `--share-gist` (transcript export)

  **Tool filter grammar (critical for deterministic autonomy)**
  - `shell(git:*)`, `shell(npm test)`
  - `write(path)`
  - `url(github.com)`, `url(https://*.github.com)`, `url(https://docs.github.com/copilot/*)`
  - `github(create_issue)` for MCP-server-scoped tools.

  **Environment variables**
  - `COPILOT_ALLOW_ALL`, `COPILOT_MODEL`, `COPILOT_HOME`
  - Auth precedence: `COPILOT_GITHUB_TOKEN` > `GH_TOKEN` > `GITHUB_TOKEN`.

  **Algorithmic execution pattern for BOX**
  1. Build prompt and explicit model/tool envelope.
  2. Execute `copilot -p ... -s --no-ask-user`.
  3. Narrow tools/URLs to least privilege.
  4. Capture transcript (`--share`) for postmortem memory.
  5. Route retries by changing `--model` or `--agent`, not permissions first.

  **Code examples (from source pattern)**
  ```bash
  copilot -p "Fix the race condition in the worker pool" \
    --model gpt-5.3-codex \
    --allow-tool='write, shell'
  ```

  **Integration pattern for BOX**
  - Replace ad-hoc shell invocation with a strict launcher that always sets: `-p`, `-s`, `--no-ask-user`, explicit `--allow-tool`, explicit `--allow-url`, optional `--agent`, pinned `--model`.
  - Persist transcript path as run artifact.

  **Benchmark numbers**
  - None in this source.

  **Failure modes**
  - `--allow-all`/`--yolo` removes safety boundary.
  - Missing `--no-ask-user` can stall autonomous loops.
  - Missing explicit `--model` reduces reproducibility.
  - Transcript export may leak sensitive content if unmanaged.

---

### [Source 2] Custom agents configuration (Copilot)

- **URL**: https://raw.githubusercontent.com/github/docs/main/content/copilot/reference/custom-agents-configuration.md
- **Source Type**: docs
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: custom-agents, schema, tool-gating, mcp, orchestration
- **Confidence Score**: 0.96
- **Why Important**: This defines the exact agent profile schema BOX can map to role-specialized workers with deterministic tool access.

- **Extracted Content**:  
  **Frontmatter schema (API)**
  - `name?: string`
  - `description: string` (**required**)
  - `target?: "vscode" | "github-copilot"`
  - `tools?: string[] | string`
  - `model?: string`
  - `disable-model-invocation?: boolean`
  - `user-invocable?: boolean`
  - `infer?: boolean` (retired; compatibility)
  - `mcp-servers?: object`
  - `metadata?: object<string,string>`

  **Behavioral constraints**
  - Prompt body max: **30,000 chars**.
  - Name conflict resolution: lower-level config overrides higher-level.
  - Versioning tied to agent profile file git SHA.
  - Unsupported for coding-agent context: `argument-hint`, `handoffs` (ignored).

  **Tools contract**
  - Omit `tools` or `tools: ["*"]` → all available.
  - `tools: []` → disable all.
  - Specific allowlist supports MCP namespacing:
    - `server/tool`
    - `server/*`
  - Unrecognized tool names are ignored (important for cross-environment portability).

  **Tool aliases**
  - `execute`/`shell`/`bash`/`powershell`
  - `read`→`view`
  - `edit`/`write` variants
  - `search`/`grep`/`glob`
  - `agent` delegation.

  **MCP integration schema (YAML form)**
  ```yaml
  mcp-servers:
    custom-mcp:
      type: local
      command: some-command
      args: ["--arg1","--arg2"]
      tools: ["*"]
      env:
        ENV_VAR_NAME: ${{ secrets.COPILOT_MCP_ENV_VAR_VALUE }}
  ```

  **Variable substitution patterns**
  - `$VAR`
  - `${VAR}`
  - `${VAR:-default}`
  - `${{ secrets.NAME }}`
  - `${{ vars.NAME }}`

  **Processing order for MCP layers**
  1. Built-in MCP
  2. Agent MCP config
  3. Repository MCP config (final override layer)

  **Integration pattern for BOX**
  - Map BOX worker archetypes to `.agent.md` contracts:
    - planner/reviewer/implementer/security roles.
  - Enforce per-role `tools` allowlists + explicit `model`.
  - Use `disable-model-invocation` and `user-invocable` to separate autonomous-only agents from manually callable ones.

  **Benchmark numbers**
  - None in this source.

  **Failure modes**
  - `tools` omitted unintentionally grants broad access.
  - Unknown tool names silently ignored can create false assumptions.
  - Unsupported fields ignored (can hide misconfiguration).

---

### [Source 3] Hooks configuration (Copilot CLI and coding agent)

- **URL**: https://raw.githubusercontent.com/github/docs/main/content/copilot/reference/hooks-configuration.md
- **Source Type**: docs
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: hooks, governance, policy-enforcement, observability, safety
- **Confidence Score**: 0.98
- **Why Important**: Hooks give BOX hard policy gates around tool execution without modifying model prompts.

- **Extracted Content**:  
  **Hook event types + input schemas**
  1. `sessionStart` input:
     - `timestamp`, `cwd`, `source` (`new|resume|startup`), `initialPrompt`
  2. `sessionEnd`:
     - `timestamp`, `cwd`, `reason` (`complete|error|abort|timeout|user_exit`)
  3. `userPromptSubmitted`:
     - `timestamp`, `cwd`, `prompt`
  4. `preToolUse`:
     - `timestamp`, `cwd`, `toolName`, `toolArgs` (JSON string)
  5. `postToolUse`:
     - `timestamp`, `cwd`, `toolName`, `toolArgs`, `toolResult{resultType,textResultForLlm}`
  6. `errorOccurred`:
     - `timestamp`, `cwd`, `error{name,message,stack}`

  **Output contract**
  - Only pre-tool permission response is actioned:
    - `permissionDecision: allow|deny|ask` (**only `deny` currently processed**)
    - `permissionDecisionReason`
  - Most other hook outputs are ignored (logging/integration use).

  **Config schema**
  ```json
  {
    "version": 1,
    "hooks": {
      "preToolUse": [
        {"type":"command","bash":"./scripts/security-check.sh","timeoutSec":30}
      ]
    }
  }
  ```

  **Execution semantics**
  - Multiple hooks of same type execute in order.
  - Default timeout: **30s** (override `timeoutSec`).
  - Scripts read JSON from stdin and can emit JSON decision.

  **Policy algorithm for BOX**
  1. On `preToolUse`, parse `toolName/toolArgs`.
  2. Apply deterministic deny rules (destructive commands, path boundaries, network allowlist).
  3. Return deny JSON with reason if violated.
  4. On `postToolUse` and `errorOccurred`, emit structured audit/metrics.

  **Integration pattern**
  - Implement governance as code in hook scripts (not prompt text).
  - Use `sessionStart/sessionEnd` for run-level telemetry and cleanup.
  - Use `preToolUse` for hard guardrails, `postToolUse` for SLO metrics.

  **Benchmark numbers**
  - None.

  **Failure modes**
  - Slow hooks can timeout and weaken controls if logic is too heavy.
  - Assuming `ask` works as gate is incorrect (only `deny` enforced).
  - Non-JSON output from scripts breaks decision handling.

---

### [Source 4] Extending Copilot coding agent with MCP (repository/admin contract)

- **URL**: https://raw.githubusercontent.com/github/docs/main/content/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp.md
- **Source Type**: docs
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: mcp, copilot-coding-agent, secrets, environment, autonomous-tools
- **Confidence Score**: 0.95
- **Why Important**: This is the concrete MCP server config and secret model for enabling external tools in autonomous PR loops.

- **Extracted Content**:  
  **Repository-level MCP JSON schema**
  ```json
  {
    "mcpServers": {
      "server-name": {
        "type": "local|stdio|http|sse",
        "tools": ["*","tool_a"],
        "command": "...",
        "args": ["..."],
        "env": {"KEY":"$COPILOT_MCP_SECRET"},
        "url": "https://...",
        "headers": {"Authorization":"Bearer $COPILOT_MCP_SECRET"}
      }
    }
  }
  ```

  **Key requirements**
  - `mcpServers` root required.
  - `tools` required for both local/remote.
  - `type` accepted values: `local`, `stdio`, `http`, `sse`.
  - Local requires `command` + `args`; remote requires `url`.
  - `env`/`headers` support substitution; referenced names must be `COPILOT_MCP_*`.

  **Substitution forms**
  - `$VAR`, `${VAR}`, `${VAR:-default}`.

  **Operational flow**
  1. Add MCP JSON in repo Copilot settings.
  2. Save and validate syntax.
  3. Add required secrets in `copilot` environment (`COPILOT_MCP_*`).
  4. Trigger issue assignment to coding agent.
  5. Validate server startup in session logs (`Start MCP Servers`).

  **Built-in GitHub MCP customization**
  - Default server uses read-only scoped token.
  - Can reconfigure to broader toolsets using MCP URL + `X-MCP-Toolsets` header.
  - Supports toolset scoping (`repos,issues,users,pull_requests,...`).

  **Integration pattern for BOX**
  - Keep per-repo MCP configuration declarative.
  - Whitelist only necessary MCP tools per agent role.
  - Use environment-scoped secrets and explicit toolsets for blast-radius control.

  **Benchmark numbers**
  - None.

  **Failure modes**
  - Explicit warning: configured MCP tools can be used autonomously without per-action approval.
  - Missing `copilot` env secrets breaks server auth.
  - Missing runtime deps on runner requires setup workflow (`copilot-setup-steps.yml`).

---

### [Source 5] Temporal TypeScript Core Application guide

- **URL**: https://raw.githubusercontent.com/temporalio/documentation/main/docs/develop/typescript/core-application.mdx
- **Source Type**: docs
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: workflow-orchestration, durability, retries, task-queue, typescript
- **Confidence Score**: 0.95
- **Why Important**: It provides a production-grade durable execution model for long-running autonomous loops with replay-safe state.

- **Extracted Content**:  
  **Core APIs**
  - Client:
    - `new Client()` (localhost default)
    - `Connection.connect(options)` / `Connection.create()`
    - `client.workflow.start(workflowFn, {workflowId, taskQueue, args})`
    - `client.workflow.execute(...)`
    - `client.getHandle(workflowId).result()`
  - Worker:
    - `Worker.create({ taskQueue, workflowsPath?, activities?, workflowBundle? })`
    - `await worker.run()`
  - Workflow activity call:
    - `proxyActivities<typeof activities>({ startToCloseTimeout, ... })`

  **Required fields and limits**
  - Worker requires `taskQueue`.
  - Workflow start requires `taskQueue` and `workflowId` in documented examples.
  - Payload limits documented: single arg default 2MB, gRPC message hard 4MB.
  - Activities should be idempotent due retry behavior.

  **Execution algorithm**
  1. Client sends start command.
  2. Temporal records events (`WorkflowExecutionStarted`, task scheduled).
  3. Worker polling same `taskQueue` executes workflow.
  4. Workflow schedules activities via command API (`proxyActivities`).
  5. Activity events appended; replay enables crash recovery.
  6. Handle waits/queries result asynchronously.

  **Code snippets**
  ```ts
  const handle = await client.workflow.start(example, {
    workflowId: 'your-workflow-id',
    taskQueue: 'your-task-queue',
    args: ['argument01'],
  });
  const result = await handle.result();
  ```

  ```ts
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'hello-world',
  });
  await worker.run();
  ```

  **Integration pattern for BOX**
  - Wrap each autonomous delivery cycle as Workflow Execution keyed by business `workflowId` (e.g., repo+iteration).
  - Put side effects in Activities only; keep Workflow deterministic.
  - Use task queues to isolate planner/reviewer/worker lanes.

  **Benchmark numbers**
  - None.

  **Failure modes**
  - No matching Worker on queue → execution does not progress.
  - Unknown activity/workflow type at worker → task failure.
  - Large payloads/history degrade replay performance.
  - Using slim Docker image without `ca-certificates` can cause transport errors.

---

### [Source 6] LangGraph Checkpoint interface (with SQLite/Postgres implementations)

- **URL**: https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint/README.md
- **Source Type**: repo
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: memory, checkpointing, durable-execution, resume, langgraph
- **Confidence Score**: 0.94
- **Why Important**: It defines explicit persistence contracts (`thread_id`, checkpoints, pending writes) required for resumable agent runs.

- **Extracted Content**:  
  **Data model**
  - **Thread**: namespace for a run lineage (`thread_id` required).
  - **Checkpoint**: snapshot with fields demonstrated:
    - `v`, `ts`, `id`
    - `channel_values`
    - `channel_versions`
    - `versions_seen`
  - Optional `checkpoint_id` to restart from specific point.

  **Required config envelope**
  ```python
  {"configurable": {"thread_id": "1"}}
  {"configurable": {"thread_id": "1", "checkpoint_id": "<uuid>"}}
  ```

  **Base checkpointer interface**
  - `put`
  - `put_writes` (pending writes)
  - `get_tuple`
  - `list`
  - `delete_thread`
  - `get_next_version`
  - Async variants: `aput`, `aput_writes`, `aget_tuple`, `alist`, `adelete_thread`.

  **Algorithm semantics**
  1. Persist checkpoint each superstep.
  2. On node failure, persist pending writes from successful sibling nodes.
  3. Resume reuses pending writes to avoid re-running completed nodes.
  4. Rehydrate via same `thread_id` (+optional `checkpoint_id`).

  **Implementations**
  - `InMemorySaver` (process memory).
  - `SqliteSaver.from_conn_string(...)`.
  - `PostgresSaver.from_conn_string(...)` (from companion READMEs).

  **Integration pattern for BOX**
  - Use one thread per autonomous task.
  - Persist planner state + tool outputs at each stage.
  - Resume retries with same `thread_id` instead of full restart.

  **Benchmark numbers**
  - None.

  **Failure modes**
  - Missing `thread_id` prevents proper state partitioning.
  - Async graphs require async saver methods.
  - Postgres saver setup requires DB initialization and correct connection settings in companion docs (`setup`, autocommit/row factory), otherwise runtime errors.

---

### [Source 7] AutoGen `SelectorGroupChat` implementation

- **URL**: https://raw.githubusercontent.com/microsoft/autogen/main/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_selector_group_chat.py
- **Source Type**: repo
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: multi-agent-coordination, speaker-selection, turn-taking, autogen
- **Confidence Score**: 0.95
- **Why Important**: This gives concrete multi-agent turn-selection logic with validation and fallback behavior for robust team orchestration.

- **Extracted Content**:  
  **Key classes and schema**
  - `SelectorGroupChatManager(BaseGroupChatManager)`
  - `SelectorGroupChatConfig(BaseModel)` fields:
    - `participants`, `model_client`, `termination_condition?`, `max_turns?`
    - `selector_prompt`
    - `allow_repeated_speaker`
    - `max_selector_attempts=3`
    - `emit_team_events`, `model_client_streaming`, `model_context?`

  **Control APIs**
  - `select_speaker(thread)`
  - `_select_speaker(roles, participants, max_attempts)`
  - `_mentioned_agents(message_content, agent_names)`

  **Selection algorithm**
  1. If `selector_func` exists, call it; validate returned name.
  2. Else, compute candidate set:
     - `candidate_func` output if provided (validated non-empty, valid names).
     - Otherwise all participants minus previous speaker if repetition disallowed.
  3. Build selector prompt with `{roles}`, `{participants}`, `{history}`.
  4. Ask model; parse mentions.
  5. Retry with feedback if zero/multiple/invalid/repeated speaker.
  6. If attempts exhausted:
     - fallback to previous speaker if exists,
     - else first participant.

  **Deterministic safeguards**
  - Raises `ValueError` for invalid selector output, invalid candidates, empty candidates, <2 participants.
  - `max_selector_attempts` bounds deliberation.

  **Integration pattern for BOX**
  - Use this pattern for Prometheus/Athena/worker talk-turn scheduling:
    - hard-validate speaker IDs,
    - bounded retries,
    - deterministic fallback.
  - Add domain-specific `candidate_func` to enforce role eligibility by task phase.

  **Benchmark numbers**
  - None.

  **Failure modes**
  - Ill-formed selector prompt placeholders or invalid candidate names trigger errors.
  - Weak candidate filtering can deadlock quality if wrong agent repeatedly selected.
  - Serialization caveat: `selector_func` is not serializable.

---

### [Source 8] SWE-bench Leaderboards (live embedded dataset)

- **URL**: https://www.swebench.com
- **Source Type**: benchmark
- **Knowledge Type**: technical
- **Date**: unknown
- **Topic Tags**: benchmark, swe-bench, code-agents, evaluation, leaderboard
- **Confidence Score**: 0.93
- **Why Important**: It provides current measurable performance/cost frontier numbers and a machine-usable leaderboard schema for routing and target-setting.

- **Extracted Content**:  
  **Extracted leaderboard dataset structure**
  - Embedded JSON script id: `leaderboard-data`.
  - Leaderboards found: `bash-only`, `Multilingual`, `Test`, `Verified`, `Lite`, `Multimodal`.
  - Row counts:
    - bash-only: 48
    - Multilingual: 14
    - Test: 24
    - Verified: 180
    - Lite: 84
    - Multimodal: 22

  **Row schema (bash-only)**
  - `checked`, `cost`, `date`, `folder`, `instance_calls`, `instance_cost`, `logo`, `logs`, `mini-swe-agent_version`, `name`, `os_model`, `os_system`, `per_instance_details`, `resolved`, `site`, `tags`, `trajs`, `trajs_docent`, `warning`.

  **Row schema (Verified)**
  - Same minus `mini-swe-agent_version` and `per_instance_details` in top-level sample rows.

  **Top results (exact extracted values from live payload)**
  - **bash-only top entries**
    1. Claude 4.5 Opus (high reasoning): **76.80 resolved**, **0.75 instance_cost**, date 2026-02-17
    2. Gemini 3 Flash (high reasoning): **75.80**, **0.36**
    3. MiniMax M2.5 (high reasoning): **75.80**, **0.07**
    4. Claude Opus 4.6: **75.60**, **0.55**
    5. Claude 4.5 Opus medium (20251101): **74.40**, **0.72**
    6. Gemini 3 Pro Preview (2025-11-18): **74.20**, **0.46**
    7. GPT-5-2 (high reasoning): **72.80**, **0.47**
    8. GPT 5.2 Codex: **72.80**, **0.45**
    9. GPT-5-2 Codex: **72.80**, **0.45**
    10. GLM-5 (high reasoning): **72.80**, **0.53**

  - **Verified top entries**
    1. live-SWE-agent + Claude 4.5 Opus medium (20251101): **79.20**
    2. Sonar Foundation Agent + Claude 4.5 Opus: **79.20**
    3. TRAE + Doubao-Seed-Code: **78.80**
    4. live-SWE-agent + Gemini 3 Pro Preview (2025-11-18): **77.40**
    5. Atlassian Rovo Dev (2025-09-02): **76.80**
    6. EPAM AI/Run Developer Agent v20250719 + Claude 4 Sonnet: **76.80**
    7. mini-SWE-agent + Claude 4.5 Opus (high reasoning): **76.80**, **0.75 instance_cost**
    8. ACoder: **76.40**
    9. mini-SWE-agent + Gemini 3 Flash (high reasoning): **75.80**, **0.36**
    10. mini-SWE-agent + MiniMax M2.5 (high reasoning): **75.80**, **0.07**

  **Methodology-relevant implementation details (from site JS)**
  - Frontend parses embedded JSON and sorts by `resolved`, `instance_cost`, etc.
  - Per-repo and per-year breakdown tables fetch:
    - `.../results/by_repo.json`
    - `.../results/by_year.json`
  - Status vocabulary includes `resolved`, `test_timeout`, `test_errored`, `install_fail`, etc.

  **Integration pattern for BOX**
  - Use resolved-rate + instance-cost frontier as routing objective:
    - high-reasoning for high-risk tasks,
    - low-cost models for broad/scalable passes.
  - Track BOX internal eval schema to mirror fields: `resolved`, `instance_cost`, `status`, per-instance details.

  **Failure modes**
  - Live leaderboard payload format can change (embedded JSON contract risk).
  - Some rows have null cost/calls, so routing logic must handle missing cost fields.
  - Duplicate/variant model naming (e.g., GPT 5.2 Codex variants) can skew naive grouping.