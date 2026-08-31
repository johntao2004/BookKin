
# FileOperationPreviewRequest


## Properties

Name | Type
------------ | -------------
`bookFileId` | string
`recycleBinEntryId` | string
`type` | [FileOperationType](FileOperationType.md)
`targetRootId` | string
`targetPath` | string
`expectedFingerprint` | string

## Example

```typescript
import type { FileOperationPreviewRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "bookFileId": null,
  "recycleBinEntryId": null,
  "type": null,
  "targetRootId": null,
  "targetPath": null,
  "expectedFingerprint": null,
} satisfies FileOperationPreviewRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileOperationPreviewRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
