
# ReadingPosition


## Properties

Name | Type
------------ | -------------
`bookId` | string
`locator` | string
`progress` | number
`deviceId` | string
`updatedAt` | Date

## Example

```typescript
import type { ReadingPosition } from ''

// TODO: Update the object below with actual values
const example = {
  "bookId": null,
  "locator": null,
  "progress": null,
  "deviceId": null,
  "updatedAt": null,
} satisfies ReadingPosition

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReadingPosition
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
