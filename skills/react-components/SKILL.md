# react-components

> Export Atelier screens as production-ready React/TSX components.

## Description

Converts generated HTML screens into clean, reusable React components with proper TypeScript types, props interfaces, and Tailwind CSS classes. Supports splitting a single screen into multiple composable components with a shared design token context.

## Usage

```
react-components <screenId>
react-components <screenId> --split --storybook
```

## Inputs

| Name      | Type    | Required | Description                                           |
|-----------|---------|----------|-------------------------------------------------------|
| screenId  | string  | yes      | The screen ID to export                               |
| projectId | string  | yes      | The project containing the screen                     |
| split     | boolean | no       | Split into multiple components (default: false)       |
| storybook | boolean | no       | Generate Storybook stories alongside components       |

## Output

```json
{
  "components": [
    {
      "name": "SettingsPage",
      "code": "import React from 'react';\n...",
      "props": ["onSave", "initialValues"],
      "filePath": "components/SettingsPage.tsx"
    }
  ],
  "sharedTypes": "export interface SettingsFormValues { ... }"
}
```

## Pipeline

1. Retrieve the screen HTML and component tree from storage
2. Route through the `code_render` pipeline stage for TSX conversion
3. If `split` is enabled, decompose into atomic/molecule/organism components
4. Generate TypeScript interfaces for all component props
5. Optionally generate Storybook stories with mock data

## Scripts

- `scripts/export.ts` — Main export orchestration
- `scripts/split.ts` — Component tree decomposition logic

## Resources

- `resources/react-patterns.md` — React component conventions and naming rules
- `resources/tailwind-map.json` — Inline style to Tailwind class mappings

## Examples

See `examples/` for sample exports from various screen types.
