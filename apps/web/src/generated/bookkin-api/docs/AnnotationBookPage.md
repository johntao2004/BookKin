
# AnnotationBookPage


## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;AnnotationBookSummary&gt;](AnnotationBookSummary.md)
`nextCursor` | string

## Example

```typescript
import type { AnnotationBookPage } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "nextCursor": null,
} satisfies AnnotationBookPage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AnnotationBookPage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
