
# AiProvider


## Properties

Name | Type
------------ | -------------
`id` | string
`label` | string
`type` | [AiProviderType](AiProviderType.md)
`enabled` | boolean
`configured` | boolean
`available` | boolean
`model` | string

## Example

```typescript
import type { AiProvider } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "label": null,
  "type": null,
  "enabled": null,
  "configured": null,
  "available": null,
  "model": null,
} satisfies AiProvider

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AiProvider
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
