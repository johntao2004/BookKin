# BookUploadsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**aiMatchBookUpload**](BookUploadsApi.md#aimatchbookupload) | **POST** /book-uploads/{id}/ai-match |  |
| [**cancelBookUpload**](BookUploadsApi.md#cancelbookupload) | **DELETE** /book-uploads/{id} |  |
| [**commitBookUpload**](BookUploadsApi.md#commitbookuploadoperation) | **POST** /book-uploads/{id}/commit |  |
| [**createBookUpload**](BookUploadsApi.md#createbookuploadoperation) | **POST** /book-uploads |  |
| [**enrichBookUpload**](BookUploadsApi.md#enrichbookupload) | **POST** /book-uploads/{id}/enrich |  |
| [**getBookUpload**](BookUploadsApi.md#getbookupload) | **GET** /book-uploads/{id} |  |
| [**getBookUploadCover**](BookUploadsApi.md#getbookuploadcover) | **GET** /book-uploads/{id}/cover |  |
| [**listBookUploads**](BookUploadsApi.md#listbookuploads) | **GET** /book-uploads |  |
| [**selectBookUploadCover**](BookUploadsApi.md#selectbookuploadcoveroperation) | **POST** /book-uploads/{id}/cover-selection |  |
| [**updateBookUploadMetadata**](BookUploadsApi.md#updatebookuploadmetadata) | **PATCH** /book-uploads/{id}/metadata |  |
| [**uploadBookContent**](BookUploadsApi.md#uploadbookcontent) | **PUT** /book-uploads/{id}/content |  |
| [**uploadBookCover**](BookUploadsApi.md#uploadbookcover) | **PUT** /book-uploads/{id}/cover |  |



## aiMatchBookUpload

> BookUpload aiMatchBookUpload(id, aiMatchRequest)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { AiMatchBookUploadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AiMatchRequest (optional)
    aiMatchRequest: ...,
  } satisfies AiMatchBookUploadRequest;

  try {
    const data = await api.aiMatchBookUpload(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **aiMatchRequest** | [AiMatchRequest](AiMatchRequest.md) |  | [Optional] |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | AI metadata candidates added for manual review |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cancelBookUpload

> cancelBookUpload(id)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { CancelBookUploadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies CancelBookUploadRequest;

  try {
    const data = await api.cancelBookUpload(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Upload cancelled |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## commitBookUpload

> BookUpload commitBookUpload(id, idempotencyKey, commitBookUploadRequest)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { CommitBookUploadOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    idempotencyKey: idempotencyKey_example,
    // CommitBookUploadRequest (optional)
    commitBookUploadRequest: ...,
  } satisfies CommitBookUploadOperationRequest;

  try {
    const data = await api.commitBookUpload(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **idempotencyKey** | `string` |  | [Defaults to `undefined`] |
| **commitBookUploadRequest** | [CommitBookUploadRequest](CommitBookUploadRequest.md) |  | [Optional] |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Upload atomically committed |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createBookUpload

> BookUpload createBookUpload(createBookUploadRequest)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { CreateBookUploadOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // CreateBookUploadRequest
    createBookUploadRequest: ...,
  } satisfies CreateBookUploadOperationRequest;

  try {
    const data = await api.createBookUpload(body);
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
| **createBookUploadRequest** | [CreateBookUploadRequest](CreateBookUploadRequest.md) |  | |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Created staging session |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## enrichBookUpload

> BookUpload enrichBookUpload(id)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { EnrichBookUploadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies EnrichBookUploadRequest;

  try {
    const data = await api.enrichBookUpload(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Online enrichment retried |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getBookUpload

> BookUpload getBookUpload(id)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { GetBookUploadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetBookUploadRequest;

  try {
    const data = await api.getBookUpload(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Upload state |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getBookUploadCover

> Blob getBookUploadCover(id)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { GetBookUploadCoverRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetBookUploadCoverRequest;

  try {
    const data = await api.getBookUploadCover(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

**Blob**

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `image/jpeg`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current staged cover |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listBookUploads

> ListBookUploads200Response listBookUploads()



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { ListBookUploadsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  try {
    const data = await api.listBookUploads();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**ListBookUploads200Response**](ListBookUploads200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Upload queue owned by the current manager |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## selectBookUploadCover

> BookUpload selectBookUploadCover(id, selectBookUploadCoverRequest)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { SelectBookUploadCoverOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // SelectBookUploadCoverRequest
    selectBookUploadCoverRequest: ...,
  } satisfies SelectBookUploadCoverOperationRequest;

  try {
    const data = await api.selectBookUploadCover(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **selectBookUploadCoverRequest** | [SelectBookUploadCoverRequest](SelectBookUploadCoverRequest.md) |  | |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Provider cover downloaded and selected |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBookUploadMetadata

> BookUpload updateBookUploadMetadata(id, bookMetadataDraft)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { UpdateBookUploadMetadataRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // BookMetadataDraft
    bookMetadataDraft: ...,
  } satisfies UpdateBookUploadMetadataRequest;

  try {
    const data = await api.updateBookUploadMetadata(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **bookMetadataDraft** | [BookMetadataDraft](BookMetadataDraft.md) |  | |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Reviewed metadata saved |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadBookContent

> BookUpload uploadBookContent(id, body)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { UploadBookContentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Blob
    body: BINARY_DATA_HERE,
  } satisfies UploadBookContentRequest;

  try {
    const data = await api.uploadBookContent(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **body** | `Blob` |  | |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/octet-stream`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | File received and queued for inspection |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadBookCover

> BookUpload uploadBookCover(id, body)



### Example

```ts
import {
  Configuration,
  BookUploadsApi,
} from '';
import type { UploadBookCoverRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BookUploadsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Blob
    body: BINARY_DATA_HERE,
  } satisfies UploadBookCoverRequest;

  try {
    const data = await api.uploadBookCover(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **body** | `Blob` |  | |

### Return type

[**BookUpload**](BookUpload.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `image/jpeg`, `image/png`, `image/webp`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Cover normalized and selected |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
