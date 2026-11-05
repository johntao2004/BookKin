
# KnowledgeDraft


## Properties

Name | Type
------------ | -------------
`points` | [Array&lt;KnowledgePoint&gt;](KnowledgePoint.md)
`fingerprint` | string
`sampledSections` | number
`totalSections` | number
`providerId` | string

## Example

```typescript
import type { KnowledgeDraft } from ''

// TODO: Update the object below with actual values
const example = {
  "points": null,
  "fingerprint": null,
  "sampledSections": null,
  "totalSections": null,
  "providerId": null,
} satisfies KnowledgeDraft

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as KnowledgeDraft
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


