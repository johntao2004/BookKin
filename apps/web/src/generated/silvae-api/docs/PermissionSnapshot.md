
# PermissionSnapshot


## Properties

Name | Type
------------ | -------------
`role` | [UserRole](UserRole.md)
`revision` | number
`grants` | Set&lt;string&gt;

## Example

```typescript
import type { PermissionSnapshot } from ''

// TODO: Update the object below with actual values
const example = {
  "role": null,
  "revision": null,
  "grants": null,
} satisfies PermissionSnapshot

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PermissionSnapshot
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


