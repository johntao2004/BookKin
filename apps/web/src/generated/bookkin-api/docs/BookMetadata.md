
# BookMetadata


## Properties

Name | Type
------------ | -------------
`id` | string
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
`coverCacheKey` | string
`coverUrl` | string
`sources` | [{ [key: string]: MetadataSource; }](MetadataSource.md)

## Example

```typescript
import type { BookMetadata } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
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
  "coverCacheKey": null,
  "coverUrl": null,
  "sources": null,
} satisfies BookMetadata

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookMetadata
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
