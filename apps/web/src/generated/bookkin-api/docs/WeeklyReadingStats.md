
# WeeklyReadingStats


## Properties

Name | Type
------------ | -------------
`weekStart` | Date
`weekEnd` | Date
`totalSeconds` | number
`previousWeekSeconds` | number
`days` | [Array&lt;DailyReadingTime&gt;](DailyReadingTime.md)

## Example

```typescript
import type { WeeklyReadingStats } from ''

// TODO: Update the object below with actual values
const example = {
  "weekStart": null,
  "weekEnd": null,
  "totalSeconds": null,
  "previousWeekSeconds": null,
  "days": null,
} satisfies WeeklyReadingStats

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WeeklyReadingStats
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
