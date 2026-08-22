\# Codex Instructions



\## CodeGraph



\- For architecture analysis, cross-file changes, refactoring, call-chain analysis, dependency analysis, and impact analysis, use the CodeGraph MCP tool first.

\- Use CodeGraph to understand relevant symbols, callers, callees, references, and relationships before making broad changes.

\- If CodeGraph does not provide enough detail, then use source search and read the relevant files directly.

\- For simple, localized changes in one file, do not use CodeGraph unnecessarily.

\- After significant code changes, consider whether the CodeGraph index may need to be synchronized.



\## General



\- Preserve the existing project structure and coding style unless there is a clear reason to change them.

\- Before making changes across multiple files, first explain the affected files and the intended change.

\- Do not delete or rename files unless required by the task.

