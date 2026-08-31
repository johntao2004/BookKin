
# BooklistDetail


## Properties

Name | Type
------------ | -------------
`id` | string
`title` | string
`description` | string
`kind` | [BooklistKind](BooklistKind.md)
`visibility` | [BooklistVisibility](BooklistVisibility.md)
`ownerDisplayName` | string
`bookCount` | number
`previewBooks` | [Array&lt;BrowseBook&gt;](BrowseBook.md)
`ownedByViewer` | boolean
`editable` | boolean
`revision` | number
`hiddenPublicBookCount` | number
`updatedAt` | Date

## Example

```typescript
import type { BooklistDetail } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "description": null,
  "kind": null,
  "visibility": null,
  "ownerDisplayName": null,
  "bookCount": null,
  "previewBooks": null,
  "ownedByViewer": null,
  "editable": null,
  "revision": null,
  "hiddenPublicBookCount": null,
  "updatedAt": null,
} satisfies BooklistDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BooklistDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
