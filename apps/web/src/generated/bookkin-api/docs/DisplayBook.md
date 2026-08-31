
# DisplayBook


## Properties

Name | Type
------------ | -------------
`id` | string
`title` | string
`author` | string
`description` | string
`format` | [BookFormat](BookFormat.md)
`coverUrl` | string
`available` | boolean
`sortOrder` | number

## Example

```typescript
import type { DisplayBook } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "author": null,
  "description": null,
  "format": null,
  "coverUrl": null,
  "available": null,
  "sortOrder": null,
} satisfies DisplayBook

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DisplayBook
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
