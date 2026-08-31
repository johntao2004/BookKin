# DisplayCatalogApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addDisplayBook**](DisplayCatalogApi.md#adddisplaybookoperation) | **POST** /display-books |  |
| [**getDisplayBook**](DisplayCatalogApi.md#getdisplaybook) | **GET** /display-books/{id} |  |
| [**getDisplayBookCover**](DisplayCatalogApi.md#getdisplaybookcover) | **GET** /display-books/{id}/cover |  |
| [**listDisplayBooks**](DisplayCatalogApi.md#listdisplaybooks) | **GET** /display-books |  |
| [**removeDisplayBook**](DisplayCatalogApi.md#removedisplaybook) | **DELETE** /display-books/{id} |  |
| [**reorderDisplayBooks**](DisplayCatalogApi.md#reorderdisplaybooksoperation) | **PUT** /display-books/order |  |
| [**streamDisplayBook**](DisplayCatalogApi.md#streamdisplaybook) | **GET** /display-books/{id}/content |  |



## addDisplayBook

> DisplayBook addDisplayBook(addDisplayBookRequest)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { AddDisplayBookOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DisplayCatalogApi(config);

  const body = {
    // AddDisplayBookRequest
    addDisplayBookRequest: ...,
  } satisfies AddDisplayBookOperationRequest;

  try {
    const data = await api.addDisplayBook(body);
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
| **addDisplayBookRequest** | [AddDisplayBookRequest](AddDisplayBookRequest.md) |  | |

### Return type

[**DisplayBook**](DisplayBook.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Added public book |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDisplayBook

> DisplayBook getDisplayBook(id)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { GetDisplayBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DisplayCatalogApi();

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetDisplayBookRequest;

  try {
    const data = await api.getDisplayBook(body);
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

[**DisplayBook**](DisplayBook.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Public book |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDisplayBookCover

> Blob getDisplayBookCover(id)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { GetDisplayBookCoverRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DisplayCatalogApi();

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetDisplayBookCoverRequest;

  try {
    const data = await api.getDisplayBookCover(body);
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `image/jpeg`, `image/png`, `image/webp`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Public book cover |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listDisplayBooks

> DisplayBookPage listDisplayBooks(q, cursor, limit)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { ListDisplayBooksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DisplayCatalogApi();

  const body = {
    // string (optional)
    q: q_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    limit: 56,
  } satisfies ListDisplayBooksRequest;

  try {
    const data = await api.listDisplayBooks(body);
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
| **q** | `string` |  | [Optional] [Defaults to `undefined`] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `60`] |

### Return type

[**DisplayBookPage**](DisplayBookPage.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Public display catalog |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeDisplayBook

> removeDisplayBook(id, revision)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { RemoveDisplayBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DisplayCatalogApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // number
    revision: 789,
  } satisfies RemoveDisplayBookRequest;

  try {
    const data = await api.removeDisplayBook(body);
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
| **revision** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | Removed from public display catalog |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## reorderDisplayBooks

> DisplayBookPage reorderDisplayBooks(reorderDisplayBooksRequest)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { ReorderDisplayBooksOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DisplayCatalogApi(config);

  const body = {
    // ReorderDisplayBooksRequest
    reorderDisplayBooksRequest: ...,
  } satisfies ReorderDisplayBooksOperationRequest;

  try {
    const data = await api.reorderDisplayBooks(body);
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
| **reorderDisplayBooksRequest** | [ReorderDisplayBooksRequest](ReorderDisplayBooksRequest.md) |  | |

### Return type

[**DisplayBookPage**](DisplayBookPage.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Reordered public books |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## streamDisplayBook

> Blob streamDisplayBook(id, range)



### Example

```ts
import {
  Configuration,
  DisplayCatalogApi,
} from '';
import type { StreamDisplayBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DisplayCatalogApi();

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    range: bytes=0-1048575,
  } satisfies StreamDisplayBookRequest;

  try {
    const data = await api.streamDisplayBook(body);
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
| **range** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**Blob**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/octet-stream`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Public read-only EPUB or PDF |  -  |
| **206** | Partial public content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
