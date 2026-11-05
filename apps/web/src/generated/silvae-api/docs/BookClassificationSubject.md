
# BookClassificationSubject


## Properties

Name | Type
------------ | -------------
`code` | string
`reason` | string
`evidence` | [Array&lt;BookClassificationEvidence&gt;](BookClassificationEvidence.md)

## Example

```typescript
import type { BookClassificationSubject } from ''

// TODO: Update the object below with actual values
const example = {
  "code": null,
  "reason": null,
  "evidence": null,
} satisfies BookClassificationSubject

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookClassificationSubject
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


