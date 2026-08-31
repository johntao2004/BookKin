
# LibraryRoot


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`configuredPath` | string
`canonicalPath` | string
`status` | [LibraryRootStatus](LibraryRootStatus.md)
`canRead` | boolean
`canWrite` | boolean
`canAtomicMove` | boolean
`canStage` | boolean
`freeBytes` | number
`lastCapabilityCheckAt` | Date
`lastScanAt` | Date

## Example

```typescript
import type { LibraryRoot } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "configuredPath": null,
  "canonicalPath": null,
  "status": null,
  "canRead": null,
  "canWrite": null,
  "canAtomicMove": null,
  "canStage": null,
  "freeBytes": null,
  "lastCapabilityCheckAt": null,
  "lastScanAt": null,
} satisfies LibraryRoot

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LibraryRoot
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
