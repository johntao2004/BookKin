
# Annotation


## Properties

Name | Type
------------ | -------------
`bookId` | string
`type` | string
`locator` | string
`quote` | string
`note` | string
`style` | string
`color` | string
`id` | string
`bookTitle` | string
`bookAuthor` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Annotation } from ''

// TODO: Update the object below with actual values
const example = {
  "bookId": null,
  "type": null,
  "locator": null,
  "quote": null,
  "note": null,
  "style": null,
  "color": null,
  "id": null,
  "bookTitle": null,
  "bookAuthor": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Annotation

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Annotation
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
