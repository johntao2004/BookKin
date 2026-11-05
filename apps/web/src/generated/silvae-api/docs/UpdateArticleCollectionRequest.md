
# UpdateArticleCollectionRequest


## Properties

Name | Type
------------ | -------------
`title` | string
`description` | string
`visibility` | [ArticleCollectionVisibility](ArticleCollectionVisibility.md)
`revision` | number

## Example

```typescript
import type { UpdateArticleCollectionRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "description": null,
  "visibility": null,
  "revision": null,
} satisfies UpdateArticleCollectionRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateArticleCollectionRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


