
# DisplayBookPage


## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;DisplayBook&gt;](DisplayBook.md)
`nextCursor` | string
`revision` | number

## Example

```typescript
import type { DisplayBookPage } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "nextCursor": null,
  "revision": null,
} satisfies DisplayBookPage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DisplayBookPage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
