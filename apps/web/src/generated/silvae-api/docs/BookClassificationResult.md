
# BookClassificationResult


## Properties

Name | Type
------------ | -------------
`subjects` | [Array&lt;BookClassificationSubject&gt;](BookClassificationSubject.md)
`tags` | Array&lt;string&gt;
`evidence` | [Array&lt;BookClassificationEvidence&gt;](BookClassificationEvidence.md)
`included` | number
`total` | number
`coverage` | string

## Example

```typescript
import type { BookClassificationResult } from ''

// TODO: Update the object below with actual values
const example = {
  "subjects": null,
  "tags": null,
  "evidence": null,
  "included": null,
  "total": null,
  "coverage": null,
} satisfies BookClassificationResult

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookClassificationResult
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


