see `CLAUDE.md`.

## Shell/Encoding Notes (Windows)
- Prefer PowerShell 7 as the working shell.
- At session start, enforce UTF-8 to avoid mojibake when reading Markdown:
  - `chcp 65001`
  - `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()`
  - `$PSDefaultParameterValues['*:Encoding'] = 'utf8'`
- When reading/writing text files, add `-Encoding utf8` to cmdlets if output still looks incorrect.
