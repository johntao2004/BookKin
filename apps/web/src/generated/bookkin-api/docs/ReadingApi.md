# ReadingApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addReadingTime**](ReadingApi.md#addreadingtime) | **POST** /books/{id}/reading-time |  |
| [**getReadingPosition**](ReadingApi.md#getreadingposition) | **GET** /books/{id}/position |  |
| [**getWeeklyReadingStats**](ReadingApi.md#getweeklyreadingstats) | **GET** /reading-stats/weekly |  |
| [**saveReadingPosition**](ReadingApi.md#savereadingposition) | **PUT** /books/{id}/position |  |
| [**streamBook**](ReadingApi.md#streambook) | **GET** /books/{id}/content |  |



## addReadingTime

> WeeklyReadingStats addReadingTime(id, readingTimeRequest)



### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '';
import type { AddReadingTimeRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReadingTimeRequest
    readingTimeRequest: ...,
  } satisfies AddReadingTimeRequest;

  try {
    const data = await api.addReadingTime(body);
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
| **readingTimeRequest** | [ReadingTimeRequest](ReadingTimeRequest.md) |  | |

### Return type

[**WeeklyReadingStats**](WeeklyReadingStats.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated weekly reading statistics |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getReadingPosition

> ReadingPosition getReadingPosition(id)



### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '';
import type { GetReadingPositionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetReadingPositionRequest;

  try {
    const data = await api.getReadingPosition(body);
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

[**ReadingPosition**](ReadingPosition.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Private position |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getWeeklyReadingStats

> WeeklyReadingStats getWeeklyReadingStats()



### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '';
import type { GetWeeklyReadingStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReadingApi(config);

  try {
    const data = await api.getWeeklyReadingStats();
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

[**WeeklyReadingStats**](WeeklyReadingStats.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current user\&#39;s private weekly reading statistics |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## saveReadingPosition

> ReadingPosition saveReadingPosition(id, readingPositionRequest)



### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '';
import type { SaveReadingPositionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ReadingPositionRequest
    readingPositionRequest: ...,
  } satisfies SaveReadingPositionRequest;

  try {
    const data = await api.saveReadingPosition(body);
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
| **readingPositionRequest** | [ReadingPositionRequest](ReadingPositionRequest.md) |  | |

### Return type

[**ReadingPosition**](ReadingPosition.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Saved position |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## streamBook

> Blob streamBook(id, range)



### Example

```ts
import {
  Configuration,
  ReadingApi,
} from '';
import type { StreamBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReadingApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    range: bytes=0-1048575,
  } satisfies StreamBookRequest;

  try {
    const data = await api.streamBook(body);
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

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/octet-stream`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Complete EPUB or PDF |  -  |
| **206** | Partial content |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
