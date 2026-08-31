# FileOperationsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**executeFileOperation**](FileOperationsApi.md#executefileoperation) | **POST** /file-operations |  |
| [**getFileOperation**](FileOperationsApi.md#getfileoperation) | **GET** /file-operations/{id} |  |
| [**listFileOperations**](FileOperationsApi.md#listfileoperations) | **GET** /file-operations |  |
| [**listLibraryRoots**](FileOperationsApi.md#listlibraryroots) | **GET** /library-roots |  |
| [**listRecycleBin**](FileOperationsApi.md#listrecyclebin) | **GET** /recycle-bin |  |
| [**previewFileOperation**](FileOperationsApi.md#previewfileoperation) | **POST** /file-operations/preview |  |
| [**purgeRecycleEntry**](FileOperationsApi.md#purgerecycleentry) | **DELETE** /recycle-bin/{id} |  |
| [**restoreRecycleEntry**](FileOperationsApi.md#restorerecycleentry) | **POST** /recycle-bin/{id}/restore |  |



## executeFileOperation

> FileOperation executeFileOperation(idempotencyKey, fileOperationExecuteRequest)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ExecuteFileOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    idempotencyKey: idempotencyKey_example,
    // FileOperationExecuteRequest
    fileOperationExecuteRequest: ...,
  } satisfies ExecuteFileOperationRequest;

  try {
    const data = await api.executeFileOperation(body);
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
| **idempotencyKey** | `string` |  | [Defaults to `undefined`] |
| **fileOperationExecuteRequest** | [FileOperationExecuteRequest](FileOperationExecuteRequest.md) |  | |

### Return type

[**FileOperation**](FileOperation.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Queued or existing idempotent operation |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getFileOperation

> FileOperation getFileOperation(id)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { GetFileOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetFileOperationRequest;

  try {
    const data = await api.getFileOperation(body);
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

[**FileOperation**](FileOperation.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operation |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listFileOperations

> ListFileOperations200Response listFileOperations(limit)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListFileOperationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // number (optional)
    limit: 56,
  } satisfies ListFileOperationsRequest;

  try {
    const data = await api.listFileOperations(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

### Return type

[**ListFileOperations200Response**](ListFileOperations200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operation journal |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listLibraryRoots

> LibraryRootList listLibraryRoots()



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListLibraryRootsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  try {
    const data = await api.listLibraryRoots();
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

[**LibraryRootList**](LibraryRootList.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Root capabilities |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listRecycleBin

> ListRecycleBin200Response listRecycleBin()



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListRecycleBinRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  try {
    const data = await api.listRecycleBin();
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

[**ListRecycleBin200Response**](ListRecycleBin200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Active recycle entries |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## previewFileOperation

> FileOperationPreview previewFileOperation(fileOperationPreviewRequest)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { PreviewFileOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // FileOperationPreviewRequest
    fileOperationPreviewRequest: ...,
  } satisfies PreviewFileOperationRequest;

  try {
    const data = await api.previewFileOperation(body);
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
| **fileOperationPreviewRequest** | [FileOperationPreviewRequest](FileOperationPreviewRequest.md) |  | |

### Return type

[**FileOperationPreview**](FileOperationPreview.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Server-validated preview |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## purgeRecycleEntry

> FileOperation purgeRecycleEntry(id, idempotencyKey, fileOperationExecuteRequest)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { PurgeRecycleEntryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    idempotencyKey: idempotencyKey_example,
    // FileOperationExecuteRequest
    fileOperationExecuteRequest: ...,
  } satisfies PurgeRecycleEntryRequest;

  try {
    const data = await api.purgeRecycleEntry(body);
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
| **fileOperationExecuteRequest** | [FileOperationExecuteRequest](FileOperationExecuteRequest.md) |  | |

### Return type

[**FileOperation**](FileOperation.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Queued permanent purge |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## restoreRecycleEntry

> FileOperation restoreRecycleEntry(id, idempotencyKey, fileOperationExecuteRequest)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { RestoreRecycleEntryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    idempotencyKey: idempotencyKey_example,
    // FileOperationExecuteRequest
    fileOperationExecuteRequest: ...,
  } satisfies RestoreRecycleEntryRequest;

  try {
    const data = await api.restoreRecycleEntry(body);
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
| **fileOperationExecuteRequest** | [FileOperationExecuteRequest](FileOperationExecuteRequest.md) |  | |

### Return type

[**FileOperation**](FileOperation.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Queued restore |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
