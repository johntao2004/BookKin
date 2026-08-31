
# CreateReaderFontRequest


## Properties

Name | Type
------------ | -------------
`kind` | [ReaderFontKind](ReaderFontKind.md)
`filename` | string
`sizeBytes` | number
`displayName` | string
`licenseNote` | string

## Example

```typescript
import type { CreateReaderFontRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "kind": null,
  "filename": null,
  "sizeBytes": null,
  "displayName": null,
  "licenseNote": null,
} satisfies CreateReaderFontRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateReaderFontRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
