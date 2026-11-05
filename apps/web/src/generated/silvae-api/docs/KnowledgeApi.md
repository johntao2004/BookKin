# KnowledgeApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getBookKnowledgeDraft**](KnowledgeApi.md#getbookknowledgedraft) | **GET** /knowledge/books/{bookId} |  |



## getBookKnowledgeDraft

> KnowledgeDraft getBookKnowledgeDraft(bookId)



Returns the saved evidence-backed knowledge points for the current available file, or an empty draft with its current fingerprint. Requires knowledge.view and reader.read.

### Example

```ts
import {
  Configuration,
  KnowledgeApi,
} from '';
import type { GetBookKnowledgeDraftRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new KnowledgeApi(config);

  const body = {
    // string
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetBookKnowledgeDraftRequest;

  try {
    const data = await api.getBookKnowledgeDraft(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **bookId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**KnowledgeDraft**](KnowledgeDraft.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current knowledge points and source fingerprint |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

