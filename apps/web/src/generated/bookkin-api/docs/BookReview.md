
# BookReview


## Properties

Name | Type
------------ | -------------
`title` | string
`markdown` | string
`visibility` | string
`id` | string
`bookId` | string
`userId` | string
`authorName` | string
`revision` | number
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { BookReview } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "markdown": null,
  "visibility": null,
  "id": null,
  "bookId": null,
  "userId": null,
  "authorName": null,
  "revision": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies BookReview

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookReview
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
