
# ManagedUser


## Properties

Name | Type
------------ | -------------
`id` | string
`username` | string
`displayName` | string
`role` | [UserRole](UserRole.md)
`mustChangePassword` | boolean
`status` | [UserStatus](UserStatus.md)
`createdAt` | Date
`lastLoginAt` | Date

## Example

```typescript
import type { ManagedUser } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "username": null,
  "displayName": null,
  "role": null,
  "mustChangePassword": null,
  "status": null,
  "createdAt": null,
  "lastLoginAt": null,
} satisfies ManagedUser

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ManagedUser
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
