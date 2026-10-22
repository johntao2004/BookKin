
# PasswordPolicy


## Properties

Name | Type
------------ | -------------
`minLength` | number
`requireUppercase` | boolean
`requireLowercase` | boolean
`requireDigit` | boolean
`requireSpecial` | boolean

## Example

```typescript
import type { PasswordPolicy } from ''

// TODO: Update the object below with actual values
const example = {
  "minLength": null,
  "requireUppercase": null,
  "requireLowercase": null,
  "requireDigit": null,
  "requireSpecial": null,
} satisfies PasswordPolicy

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PasswordPolicy
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
