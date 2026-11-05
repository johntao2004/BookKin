
# PublicBookMetadata


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
`subjectCodes` | Array&lt;string&gt;
`coverUrl` | string
`sources` | [{ [key: string]: MetadataSource; }](MetadataSource.md)
`authorBiography` | string
`tableOfContents` | string
`knowledgeTerms` | Array&lt;string&gt;

## Example

```typescript
import type { PublicBookMetadata } from ''

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
  "subjectCodes": null,
  "coverUrl": null,
  "sources": null,
  "authorBiography": null,
  "tableOfContents": null,
  "knowledgeTerms": null,
} satisfies PublicBookMetadata

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PublicBookMetadata
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


