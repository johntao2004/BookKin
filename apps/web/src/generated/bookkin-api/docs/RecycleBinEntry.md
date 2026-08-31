
# RecycleBinEntry


## Properties

Name | Type
------------ | -------------
`id` | string
`bookId` | string
`bookTitle` | string
`bookAuthor` | string
`format` | [BookFormat](BookFormat.md)
`coverUrl` | string
`originalPath` | string
`trashPath` | string
`sizeBytes` | number
`deletedBy` | string
`deletedAt` | Date
`expiresAt` | Date
`fingerprint` | string

## Example

```typescript
import type { RecycleBinEntry } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookId": null,
  "bookTitle": null,
  "bookAuthor": null,
  "format": null,
  "coverUrl": null,
  "originalPath": null,
  "trashPath": null,
  "sizeBytes": null,
  "deletedBy": null,
  "deletedAt": null,
  "expiresAt": null,
  "fingerprint": null,
} satisfies RecycleBinEntry

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RecycleBinEntry
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
