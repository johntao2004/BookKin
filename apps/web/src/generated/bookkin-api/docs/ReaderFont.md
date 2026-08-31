
# ReaderFont


## Properties

Name | Type
------------ | -------------
`id` | string
`displayName` | string
`familyName` | string
`kind` | [ReaderFontKind](ReaderFontKind.md)
`source` | string
`status` | [ReaderFontStatus](ReaderFontStatus.md)
`format` | string
`contentUrl` | string
`licenseNote` | string
`createdAt` | Date

## Example

```typescript
import type { ReaderFont } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "displayName": null,
  "familyName": null,
  "kind": null,
  "source": null,
  "status": null,
  "format": null,
  "contentUrl": null,
  "licenseNote": null,
  "createdAt": null,
} satisfies ReaderFont

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReaderFont
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
