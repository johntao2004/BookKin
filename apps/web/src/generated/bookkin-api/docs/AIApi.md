# AIApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getAiSettings**](AIApi.md#getaisettings) | **GET** /ai/settings |  |
| [**listAiProviders**](AIApi.md#listaiproviders) | **GET** /ai/providers |  |
| [**updateAiSettings**](AIApi.md#updateaisettings) | **PUT** /ai/settings |  |



## getAiSettings

> AiSettings getAiSettings()



### Example

```ts
import {
  Configuration,
  AIApi,
} from '';
import type { GetAiSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AIApi(config);

  try {
    const data = await api.getAiSettings();
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

[**AiSettings**](AiSettings.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | AI matching settings without secret values |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAiProviders

> AiProviderList listAiProviders()



### Example

```ts
import {
  Configuration,
  AIApi,
} from '';
import type { ListAiProvidersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AIApi(config);

  try {
    const data = await api.listAiProviders();
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

[**AiProviderList**](AiProviderList.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | AI providers available to managers |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateAiSettings

> AiSettings updateAiSettings(aiSettingsRequest)



### Example

```ts
import {
  Configuration,
  AIApi,
} from '';
import type { UpdateAiSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AIApi(config);

  const body = {
    // AiSettingsRequest
    aiSettingsRequest: ...,
  } satisfies UpdateAiSettingsRequest;

  try {
    const data = await api.updateAiSettings(body);
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
| **aiSettingsRequest** | [AiSettingsRequest](AiSettingsRequest.md) |  | |

### Return type

[**AiSettings**](AiSettings.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated AI matching settings without secret values |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
