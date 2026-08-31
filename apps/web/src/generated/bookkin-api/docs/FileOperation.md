
# FileOperation


## Properties

Name | Type
------------ | -------------
`id` | string
`type` | [FileOperationType](FileOperationType.md)
`status` | [FileOperationStatus](FileOperationStatus.md)
`sourcePath` | string
`targetPath` | string
`createdAt` | Date
`stage` | string
`errorCode` | string
`errorDetail` | string

## Example

```typescript
import type { FileOperation } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "type": null,
  "status": null,
  "sourcePath": null,
  "targetPath": null,
  "createdAt": null,
  "stage": null,
  "errorCode": null,
  "errorDetail": null,
} satisfies FileOperation

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileOperation
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
