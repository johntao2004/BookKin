
# TwoFactorStatus


## Properties

Name | Type
------------ | -------------
`enabled` | boolean
`configured` | boolean
`bound` | boolean
`verified` | boolean
`expiresAt` | number

## Example

```typescript
import type { TwoFactorStatus } from ''

// TODO: Update the object below with actual values
const example = {
  "enabled": null,
  "configured": null,
  "bound": null,
  "verified": null,
  "expiresAt": null,
} satisfies TwoFactorStatus

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TwoFactorStatus
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


