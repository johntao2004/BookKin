# ReaderFontsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createReaderFont**](ReaderFontsApi.md#createreaderfontoperation) | **POST** /reader-fonts |  |
| [**getReaderFontContent**](ReaderFontsApi.md#getreaderfontcontent) | **GET** /reader-fonts/{id}/content |  |
| [**listReaderFonts**](ReaderFontsApi.md#listreaderfonts) | **GET** /reader-fonts |  |
| [**updateReaderFontStatus**](ReaderFontsApi.md#updatereaderfontstatus) | **PATCH** /reader-fonts/{id} |  |
| [**uploadReaderFontContent**](ReaderFontsApi.md#uploadreaderfontcontent) | **PUT** /reader-fonts/{id}/content |  |



## createReaderFont

> ReaderFont createReaderFont(createReaderFontRequest)



### Example

```ts
import {
  Configuration,
  ReaderFontsApi,
} from '';
import type { CreateReaderFontOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReaderFontsApi(config);

  const body = {
    // CreateReaderFontRequest
    createReaderFontRequest: ...,
  } satisfies CreateReaderFontOperationRequest;

  try {
    const data = await api.createReaderFont(body);
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
| **createReaderFontRequest** | [CreateReaderFontRequest](CreateReaderFontRequest.md) |  | |

### Return type

[**ReaderFont**](ReaderFont.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Font upload session |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getReaderFontContent

> Blob getReaderFontContent(id)



### Example

```ts
import {
  Configuration,
  ReaderFontsApi,
} from '';
import type { GetReaderFontContentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReaderFontsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetReaderFontContentRequest;

  try {
    const data = await api.getReaderFontContent(body);
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
- **Accept**: `application/octet-stream`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Enabled font file |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listReaderFonts

> ReaderFontList listReaderFonts(includeDisabled)



### Example

```ts
import {
  Configuration,
  ReaderFontsApi,
} from '';
import type { ListReaderFontsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReaderFontsApi(config);

  const body = {
    // boolean (optional)
    includeDisabled: true,
  } satisfies ListReaderFontsRequest;

  try {
    const data = await api.listReaderFonts(body);
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
| **includeDisabled** | `boolean` |  | [Optional] [Defaults to `false`] |

### Return type

[**ReaderFontList**](ReaderFontList.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Enabled reader fonts |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateReaderFontStatus

> ReaderFont updateReaderFontStatus(id, updateReaderFontRequest)



### Example

```ts
import {
  Configuration,
  ReaderFontsApi,
} from '';
import type { UpdateReaderFontStatusRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReaderFontsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateReaderFontRequest
    updateReaderFontRequest: ...,
  } satisfies UpdateReaderFontStatusRequest;

  try {
    const data = await api.updateReaderFontStatus(body);
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
| **updateReaderFontRequest** | [UpdateReaderFontRequest](UpdateReaderFontRequest.md) |  | |

### Return type

[**ReaderFont**](ReaderFont.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated reader font |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadReaderFontContent

> ReaderFont uploadReaderFontContent(id, body)



### Example

```ts
import {
  Configuration,
  ReaderFontsApi,
} from '';
import type { UploadReaderFontContentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ReaderFontsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // Blob
    body: BINARY_DATA_HERE,
  } satisfies UploadReaderFontContentRequest;

  try {
    const data = await api.uploadReaderFontContent(body);
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

[**ReaderFont**](ReaderFont.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/octet-stream`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Font stored after validation |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
