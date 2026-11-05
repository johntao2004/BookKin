
# ChangeUserRoleRequest


## Properties

Name | Type
------------ | -------------
`role` | [UserRole](UserRole.md)
`expectedRole` | [UserRole](UserRole.md)

## Example

```typescript
import type { ChangeUserRoleRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "role": null,
  "expectedRole": null,
} satisfies ChangeUserRoleRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ChangeUserRoleRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


