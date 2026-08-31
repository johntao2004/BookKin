
# BookUpload


## Properties

Name | Type
------------ | -------------
`id` | string
`libraryRootId` | string
`libraryRootName` | string
`originalFilename` | string
`format` | [BookFormat](BookFormat.md)
`declaredSizeBytes` | number
`receivedBytes` | number
`fingerprint` | string
`status` | [BookUploadStatus](BookUploadStatus.md)
`encrypted` | boolean
`drmProtected` | boolean
`digitallySigned` | boolean
`detectedMetadata` | [BookMetadataDraft](BookMetadataDraft.md)
`draftMetadata` | [BookMetadataDraft](BookMetadataDraft.md)
`metadataCandidates` | [Array&lt;MetadataCandidate&gt;](MetadataCandidate.md)
`coverUrl` | string
`selectedCoverSource` | [CoverSource](CoverSource.md)
`duplicateBookId` | string
`similarBookIds` | Array&lt;string&gt;
`targetPath` | string
`errorCode` | string
`errorDetail` | string
`committedBookId` | string
`expiresAt` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { BookUpload } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "libraryRootId": null,
  "libraryRootName": null,
  "originalFilename": null,
  "format": null,
  "declaredSizeBytes": null,
  "receivedBytes": null,
  "fingerprint": null,
  "status": null,
  "encrypted": null,
  "drmProtected": null,
  "digitallySigned": null,
  "detectedMetadata": null,
  "draftMetadata": null,
  "metadataCandidates": null,
  "coverUrl": null,
  "selectedCoverSource": null,
  "duplicateBookId": null,
  "similarBookIds": null,
  "targetPath": null,
  "errorCode": null,
  "errorDetail": null,
  "committedBookId": null,
  "expiresAt": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies BookUpload

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookUpload
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
