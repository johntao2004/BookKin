
# FileVersion


## Properties

Name | Type
------------ | -------------
`id` | string
`sourcePath` | string
`fingerprint` | string
`sizeBytes` | number
`reason` | string
`createdAt` | Date
`expiresAt` | Date
`restoredAt` | Date

## Example

```typescript
import type { FileVersion } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "sourcePath": null,
  "fingerprint": null,
  "sizeBytes": null,
  "reason": null,
  "createdAt": null,
  "expiresAt": null,
  "restoredAt": null,
} satisfies FileVersion

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileVersion
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


