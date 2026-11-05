
# AuthTwoFactorResetPostRequest


## Properties

Name | Type
------------ | -------------
`code` | string
`recovery` | boolean
`password` | string

## Example

```typescript
import type { AuthTwoFactorResetPostRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "code": null,
  "recovery": null,
  "password": null,
} satisfies AuthTwoFactorResetPostRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AuthTwoFactorResetPostRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


