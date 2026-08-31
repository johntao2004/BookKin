
# AnnotationBookSummary


## Properties

Name | Type
------------ | -------------
`bookId` | string
`bookTitle` | string
`bookAuthor` | string
`coverUrl` | string
`annotationCount` | number
`noteCount` | number
`highlightCount` | number
`underlineCount` | number
`boldCount` | number
`latestAt` | Date

## Example

```typescript
import type { AnnotationBookSummary } from ''

// TODO: Update the object below with actual values
const example = {
  "bookId": null,
  "bookTitle": null,
  "bookAuthor": null,
  "coverUrl": null,
  "annotationCount": null,
  "noteCount": null,
  "highlightCount": null,
  "underlineCount": null,
  "boldCount": null,
  "latestAt": null,
} satisfies AnnotationBookSummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AnnotationBookSummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
