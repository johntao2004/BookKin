
# FileOperationPreview


## Properties

Name | Type
------------ | -------------
`previewToken` | string
`type` | [FileOperationType](FileOperationType.md)
`sourcePath` | string
`targetPath` | string
`requiredBytes` | number
`expectedFingerprint` | string
`expiresAt` | Date
`conflicts` | [Array&lt;FileConflict&gt;](FileConflict.md)
`warnings` | Array&lt;string&gt;

## Example

```typescript
import type { FileOperationPreview } from ''

// TODO: Update the object below with actual values
const example = {
  "previewToken": null,
  "type": null,
  "sourcePath": null,
  "targetPath": null,
  "requiredBytes": null,
  "expectedFingerprint": null,
  "expiresAt": null,
  "conflicts": null,
  "warnings": null,
} satisfies FileOperationPreview

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileOperationPreview
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
