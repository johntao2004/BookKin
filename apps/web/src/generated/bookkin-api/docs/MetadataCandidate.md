
# MetadataCandidate


## Properties

Name | Type
------------ | -------------
`id` | string
`provider` | [MetadataSource](MetadataSource.md)
`title` | string
`subtitle` | string
`authors` | Array&lt;string&gt;
`publisher` | string
`publishedDate` | string
`isbn` | string
`description` | string
`tags` | Array&lt;string&gt;
`coverUrl` | string

## Example

```typescript
import type { MetadataCandidate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "provider": null,
  "title": null,
  "subtitle": null,
  "authors": null,
  "publisher": null,
  "publishedDate": null,
  "isbn": null,
  "description": null,
  "tags": null,
  "coverUrl": null,
} satisfies MetadataCandidate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MetadataCandidate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
