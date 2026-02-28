# MCP App calculator UI

This project exposes an MCP App calculator widget through a dedicated resource
entry point and a tool that points at it.

## What is registered

- Tool: `open_calculator_ui`
  - Registered with `registerAppTool(...)` from
    `@modelcontextprotocol/ext-apps/server`.
  - Includes `_meta.ui.resourceUri` so MCP App hosts know which `ui://` resource
    to render.
- Resource: `ui://calculator-app/entry-point.html`
  - Registered with `registerAppResource(...)` from
    `@modelcontextprotocol/ext-apps/server`.
  - Served as `text/html;profile=mcp-app`.
  - Returns the calculator widget HTML entry point.

## File map

- `mcp/apps/calculator-ui-entry-point.ts`
  - Dedicated calculator widget entry point.
  - Exports `calculatorUiResourceUri`.
  - Exports `renderCalculatorUiEntryPoint()` (the HTML payload served by MCP).
  - Emits calculator results back to the host agent as MCP App messages.
  - Uses the same design-token names as the app (`--color-*`, `--spacing-*`,
    `--radius-*`, `--shadow-*`) so widget styling matches core surfaces/buttons.
- `mcp/resources/calculator-app-resource.ts`
  - Registers the `ui://` resource.
- `mcp/tools/open-calculator-ui.ts`
  - Registers the tool that opens the widget.
- `mcp/register-resources.ts`
  - Central resource registration.
- `mcp/register-tools.ts`
  - Central tool registration.
- `mcp/index.ts`
  - Calls both resource and tool registration in `init()`.

## Request flow

1. Host calls `open_calculator_ui`.
2. Tool metadata advertises `ui://calculator-app/entry-point.html`.
3. Host reads that resource from the MCP server.
4. Host renders the HTML widget in a sandboxed MCP App frame.
5. On each successful `=` evaluation, the widget sends:
   - `Calculator result: <equation> = <result>`
   - Routed as a host message via the MCP Apps adapter.

## Updating the calculator widget

1. Edit `renderCalculatorUiEntryPoint()` in
   `mcp/apps/calculator-ui-entry-point.ts`.
2. Keep the URI stable unless you intentionally version the widget.
3. Re-run MCP tests:
   - `bun run test:mcp`

## Notes for new MCP App widgets

- Give each widget its own entry-point module under `mcp/apps`.
- Register resources in `mcp/register-resources.ts`.
- Register tools in `mcp/register-tools.ts`.
- Prefer `registerAppTool`/`registerAppResource` helpers so metadata and MIME
  behavior stay aligned with the MCP Apps spec.
- Enable the `mcpApps` adapter when widget events must send messages/tool calls
  back to the host (`window.parent.postMessage` MCP-UI actions are translated to
  MCP Apps JSON-RPC).
