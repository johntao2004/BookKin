# BooklistsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addBooklistBooks**](BooklistsApi.md#addbooklistbooksoperation) | **POST** /booklists/{id}/books |  |
| [**createBooklist**](BooklistsApi.md#createbooklistoperation) | **POST** /booklists |  |
| [**deleteBooklist**](BooklistsApi.md#deletebooklist) | **DELETE** /booklists/{id} |  |
| [**getBooklist**](BooklistsApi.md#getbooklist) | **GET** /booklists/{id} |  |
| [**listBooklistBooks**](BooklistsApi.md#listbooklistbooks) | **GET** /booklists/{id}/books |  |
| [**listBooklists**](BooklistsApi.md#listbooklists) | **GET** /booklists |  |
| [**removeBooklistBook**](BooklistsApi.md#removebooklistbook) | **DELETE** /booklists/{id}/books/{bookId} |  |
| [**reorderBooklistBooks**](BooklistsApi.md#reorderbooklistbooks) | **PUT** /booklists/{id}/order |  |
| [**updateBooklist**](BooklistsApi.md#updatebooklistoperation) | **PATCH** /booklists/{id} |  |



## addBooklistBooks

> BooklistDetail addBooklistBooks(id, addBooklistBooksRequest)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { AddBooklistBooksOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // AddBooklistBooksRequest
    addBooklistBooksRequest: ...,
  } satisfies AddBooklistBooksOperationRequest;

  try {
    const data = await api.addBooklistBooks(body);
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
| **addBooklistBooksRequest** | [AddBooklistBooksRequest](AddBooklistBooksRequest.md) |  | |

### Return type

[**BooklistDetail**](BooklistDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated booklist |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createBooklist

> BooklistDetail createBooklist(createBooklistRequest)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { CreateBooklistOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // CreateBooklistRequest
    createBooklistRequest: ...,
  } satisfies CreateBooklistOperationRequest;

  try {
    const data = await api.createBooklist(body);
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
| **createBooklistRequest** | [CreateBooklistRequest](CreateBooklistRequest.md) |  | |

### Return type

[**BooklistDetail**](BooklistDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Created booklist |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteBooklist

> deleteBooklist(id, revision)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { DeleteBooklistRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // number
    revision: 789,
  } satisfies DeleteBooklistRequest;

  try {
    const data = await api.deleteBooklist(body);
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
| **204** | Booklist relationship removed without deleting books |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getBooklist

> BooklistDetail getBooklist(id)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { GetBooklistRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BooklistsApi();

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetBooklistRequest;

  try {
    const data = await api.getBooklist(body);
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

[**BooklistDetail**](BooklistDetail.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Visible booklist |  -  |
| **404** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listBooklistBooks

> BrowseBookPage listBooklistBooks(id, q, format, cursor, limit)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { ListBooklistBooksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BooklistsApi();

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    q: q_example,
    // BookFormat (optional)
    format: ...,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    limit: 56,
  } satisfies ListBooklistBooksRequest;

  try {
    const data = await api.listBooklistBooks(body);
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
| **q** | `string` |  | [Optional] [Defaults to `undefined`] |
| **format** | `BookFormat` |  | [Optional] [Defaults to `undefined`] [Enum: EPUB, PDF] |
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `36`] |

### Return type

[**BrowseBookPage**](BrowseBookPage.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Visible books in manual list order |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listBooklists

> BooklistList listBooklists(q)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { ListBooklistsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new BooklistsApi();

  const body = {
    // string (optional)
    q: q_example,
  } satisfies ListBooklistsRequest;

  try {
    const data = await api.listBooklists(body);
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

### Return type

[**BooklistList**](BooklistList.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Booklists visible to the current audience |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeBooklistBook

> BooklistDetail removeBooklistBook(id, bookId, revision)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { RemoveBooklistBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // number
    revision: 789,
  } satisfies RemoveBooklistBookRequest;

  try {
    const data = await api.removeBooklistBook(body);
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
| **bookId** | `string` |  | [Defaults to `undefined`] |
| **revision** | `number` |  | [Defaults to `undefined`] |

### Return type

[**BooklistDetail**](BooklistDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated booklist |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## reorderBooklistBooks

> BooklistDetail reorderBooklistBooks(id, reorderBooklistRequest)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { ReorderBooklistBooksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReorderBooklistRequest
    reorderBooklistRequest: ...,
  } satisfies ReorderBooklistBooksRequest;

  try {
    const data = await api.reorderBooklistBooks(body);
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
| **reorderBooklistRequest** | [ReorderBooklistRequest](ReorderBooklistRequest.md) |  | |

### Return type

[**BooklistDetail**](BooklistDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Reordered booklist |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBooklist

> BooklistDetail updateBooklist(id, updateBooklistRequest)



### Example

```ts
import {
  Configuration,
  BooklistsApi,
} from '';
import type { UpdateBooklistOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new BooklistsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateBooklistRequest
    updateBooklistRequest: ...,
  } satisfies UpdateBooklistOperationRequest;

  try {
    const data = await api.updateBooklist(body);
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
| **updateBooklistRequest** | [UpdateBooklistRequest](UpdateBooklistRequest.md) |  | |

### Return type

[**BooklistDetail**](BooklistDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated booklist |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
