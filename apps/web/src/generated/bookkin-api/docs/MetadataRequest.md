
# MetadataRequest


## Properties

Name | Type
------------ | -------------
`title` | string
`subtitle` | string
`authors` | Array&lt;string&gt;
`translators` | Array&lt;string&gt;
`language` | string
`publisher` | string
`publishedDate` | string
`isbn` | string
`description` | string
`series` | string
`seriesIndex` | number
`tags` | Array&lt;string&gt;
`manualFields` | Array&lt;string&gt;
`writeBack` | boolean
`bookFileId` | string
`expectedFingerprint` | string

## Example

```typescript
import type { MetadataRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "subtitle": null,
  "authors": null,
  "translators": null,
  "language": null,
  "publisher": null,
  "publishedDate": null,
  "isbn": null,
  "description": null,
  "series": null,
  "seriesIndex": null,
  "tags": null,
  "manualFields": null,
  "writeBack": null,
  "bookFileId": null,
  "expectedFingerprint": null,
} satisfies MetadataRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MetadataRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
