
# Book


## Properties

Name | Type
------------ | -------------
`id` | string
`fileId` | string
`title` | string
`author` | string
`series` | string
`description` | string
`format` | [BookFormat](BookFormat.md)
`coverUrl` | string
`progress` | number
`wordCount` | string
`addedAt` | Date
`libraryRoot` | string
`relativePath` | string
`fingerprint` | string
`status` | [BookFileStatus](BookFileStatus.md)
`tags` | Array&lt;string&gt;

## Example

```typescript
import type { Book } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "fileId": null,
  "title": null,
  "author": null,
  "series": null,
  "description": null,
  "format": null,
  "coverUrl": null,
  "progress": null,
  "wordCount": null,
  "addedAt": null,
  "libraryRoot": null,
  "relativePath": null,
  "fingerprint": null,
  "status": null,
  "tags": null,
} satisfies Book

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Book
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
