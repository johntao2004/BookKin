
# ArticlesNotesGet200ResponseInner


## Properties

Name | Type
------------ | -------------
`articleId` | string
`title` | string
`author` | string
`coverUrl` | string
`annotations` | [Array&lt;ArticleNoteEntry&gt;](ArticleNoteEntry.md)

## Example

```typescript
import type { ArticlesNotesGet200ResponseInner } from ''

// TODO: Update the object below with actual values
const example = {
  "articleId": null,
  "title": null,
  "author": null,
  "coverUrl": null,
  "annotations": null,
} satisfies ArticlesNotesGet200ResponseInner

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ArticlesNotesGet200ResponseInner
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
