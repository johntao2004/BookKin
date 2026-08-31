
# CategorySummary


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`bookCount` | number
`previewBooks` | [Array&lt;BrowseBook&gt;](BrowseBook.md)
`editable` | boolean

## Example

```typescript
import type { CategorySummary } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "bookCount": null,
  "previewBooks": null,
  "editable": null,
} satisfies CategorySummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CategorySummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
