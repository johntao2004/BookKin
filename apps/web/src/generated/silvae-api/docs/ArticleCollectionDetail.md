
# ArticleCollectionDetail


## Properties

Name | Type
------------ | -------------
`id` | string
`title` | string
`description` | string
`visibility` | [ArticleCollectionVisibility](ArticleCollectionVisibility.md)
`ownerDisplayName` | string
`ownedByViewer` | boolean
`editable` | boolean
`articleCount` | number
`previewArticles` | [Array&lt;CollectionArticleSummary&gt;](CollectionArticleSummary.md)
`revision` | number
`createdAt` | Date
`updatedAt` | Date
`articles` | [Array&lt;CollectionArticleSummary&gt;](CollectionArticleSummary.md)

## Example

```typescript
import type { ArticleCollectionDetail } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "description": null,
  "visibility": null,
  "ownerDisplayName": null,
  "ownedByViewer": null,
  "editable": null,
  "articleCount": null,
  "previewArticles": null,
  "revision": null,
  "createdAt": null,
  "updatedAt": null,
  "articles": null,
} satisfies ArticleCollectionDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ArticleCollectionDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


