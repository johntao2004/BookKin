
# AiProviderSetting


## Properties

Name | Type
------------ | -------------
`id` | string
`label` | string
`type` | [AiProviderType](AiProviderType.md)
`enabled` | boolean
`baseUrl` | string
`model` | string
`configured` | boolean
`available` | boolean
`apiKeyConfigured` | boolean
`updatedAt` | Date

## Example

```typescript
import type { AiProviderSetting } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "label": null,
  "type": null,
  "enabled": null,
  "baseUrl": null,
  "model": null,
  "configured": null,
  "available": null,
  "apiKeyConfigured": null,
  "updatedAt": null,
} satisfies AiProviderSetting

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AiProviderSetting
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
