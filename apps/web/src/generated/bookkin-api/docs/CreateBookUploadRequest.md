
# CreateBookUploadRequest


## Properties

Name | Type
------------ | -------------
`libraryRootId` | string
`filename` | string
`sizeBytes` | number

## Example

```typescript
import type { CreateBookUploadRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "libraryRootId": null,
  "filename": null,
  "sizeBytes": null,
} satisfies CreateBookUploadRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateBookUploadRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
