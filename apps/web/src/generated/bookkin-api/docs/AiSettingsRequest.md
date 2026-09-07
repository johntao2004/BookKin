
# AiSettingsRequest


## Properties

Name | Type
------------ | -------------
`enabled` | boolean
`autoMatch` | boolean
`maxCandidates` | number
`timeoutSeconds` | number
`providers` | [Array&lt;AiProviderSettingRequest&gt;](AiProviderSettingRequest.md)

## Example

```typescript
import type { AiSettingsRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "enabled": null,
  "autoMatch": null,
  "maxCandidates": null,
  "timeoutSeconds": null,
  "providers": null,
} satisfies AiSettingsRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AiSettingsRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
