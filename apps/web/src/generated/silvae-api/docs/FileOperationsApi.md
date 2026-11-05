# FileOperationsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**executeFileOperation**](FileOperationsApi.md#executefileoperation) | **POST** /file-operations |  |
| [**getFileOperation**](FileOperationsApi.md#getfileoperation) | **GET** /file-operations/{id} |  |
| [**listContentStorage**](FileOperationsApi.md#listcontentstorage) | **GET** /library-roots/content-storage |  |
| [**listFileOperations**](FileOperationsApi.md#listfileoperations) | **GET** /file-operations |  |
| [**listFileTaskHistory**](FileOperationsApi.md#listfiletaskhistory) | **GET** /file-task-history |  |
| [**listFileVersions**](FileOperationsApi.md#listfileversions) | **GET** /file-operations/book-files/{bookFileId}/versions |  |
| [**listLibraryRoots**](FileOperationsApi.md#listlibraryroots) | **GET** /library-roots |  |
| [**listRecycleBin**](FileOperationsApi.md#listrecyclebin) | **GET** /recycle-bin |  |
| [**previewFileOperation**](FileOperationsApi.md#previewfileoperation) | **POST** /file-operations/preview |  |
| [**previewFileVersionRestore**](FileOperationsApi.md#previewfileversionrestoreoperation) | **POST** /file-operations/versions/{versionId}/restore/preview |  |
| [**purgeRecycleEntry**](FileOperationsApi.md#purgerecycleentry) | **DELETE** /recycle-bin/{id} |  |
| [**restoreFileVersion**](FileOperationsApi.md#restorefileversion) | **POST** /file-operations/versions/{versionId}/restore |  |
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


## listContentStorage

> Array&lt;ListContentStorage200ResponseInner&gt; listContentStorage()



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListContentStorageRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  try {
    const data = await api.listContentStorage();
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

[**Array&lt;ListContentStorage200ResponseInner&gt;**](ListContentStorage200ResponseInner.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Live capacity and last completed read-only directory scan; requires settings.roots.view and exposes no paths or user content. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listFileOperations

> ListFileOperations200Response listFileOperations(limit, page, pageSize)



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
    // number | Legacy bounded recent list when page is omitted (optional)
    limit: 56,
    // number | Zero-based history page (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
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
| **limit** | `number` | Legacy bounded recent list when page is omitted | [Optional] [Defaults to `50`] |
| **page** | `number` | Zero-based history page | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `10`] |

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


## listFileTaskHistory

> ListFileTaskHistory200Response listFileTaskHistory(page, pageSize)



### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListFileTaskHistoryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ListFileTaskHistoryRequest;

  try {
    const data = await api.listFileTaskHistory(body);
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
| **page** | `number` |  | [Optional] [Defaults to `0`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `10`] |

### Return type

[**ListFileTaskHistory200Response**](ListFileTaskHistory200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Unified chronologically merged file operation and book upload history |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listFileVersions

> ListFileVersions200Response listFileVersions(bookFileId)



OWNER/ADMIN with settings.recycle.view can list retained, unexpired file versions.

### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { ListFileVersionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    bookFileId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListFileVersionsRequest;

  try {
    const data = await api.listFileVersions(body);
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
| **bookFileId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**ListFileVersions200Response**](ListFileVersions200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Retained versions |  -  |

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
| **200** | Capabilities for the deployment-configured default book library. Library registration is disabled; legacy registration and registration-preview POSTs return 403 LIBRARY_ROOT_REGISTRATION_DISABLED. |  -  |

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
| **200** | Server-validated preview. Book MOVE requests are disabled and return 403 BOOK_MOVE_DISABLED. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## previewFileVersionRestore

> FileOperationPreview previewFileVersionRestore(versionId, previewFileVersionRestoreRequest)



Requires settings.recycle.restore; validates the current file and archive fingerprints before creating a bound preview.

### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { PreviewFileVersionRestoreOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    versionId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // PreviewFileVersionRestoreRequest
    previewFileVersionRestoreRequest: ...,
  } satisfies PreviewFileVersionRestoreOperationRequest;

  try {
    const data = await api.previewFileVersionRestore(body);
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
| **versionId** | `string` |  | [Defaults to `undefined`] |
| **previewFileVersionRestoreRequest** | [PreviewFileVersionRestoreRequest](PreviewFileVersionRestoreRequest.md) |  | |

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
| **200** | Version restore preview |  -  |

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


## restoreFileVersion

> FileOperation restoreFileVersion(versionId, idempotencyKey, fileOperationExecuteRequest)



Executes a matching preview with settings.recycle.restore; preserves the current file as another retained version.

### Example

```ts
import {
  Configuration,
  FileOperationsApi,
} from '';
import type { RestoreFileVersionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new FileOperationsApi(config);

  const body = {
    // string
    versionId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    idempotencyKey: idempotencyKey_example,
    // FileOperationExecuteRequest
    fileOperationExecuteRequest: ...,
  } satisfies RestoreFileVersionRequest;

  try {
    const data = await api.restoreFileVersion(body);
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
| **versionId** | `string` |  | [Defaults to `undefined`] |
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
| **200** | Queued or existing restore operation |  -  |

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

