# DefaultApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createMetadataTerm**](DefaultApi.md#createmetadataterm) | **POST** /metadata-terms |  |
| [**ensureMetadataTerms**](DefaultApi.md#ensuremetadatatermsoperation) | **POST** /metadata-terms/ensure |  |
| [**previewMetadataTerms**](DefaultApi.md#previewmetadatatermsoperation) | **POST** /ai/metadata-terms |  |
| [**searchMetadataTerms**](DefaultApi.md#searchmetadataterms) | **GET** /metadata-terms |  |
| [**vaultKeyMigratePost**](DefaultApi.md#vaultkeymigratepostoperation) | **POST** /vault/key/migrate | 已通过 2FA 的旧浏览器迁移原内容密钥，验证已有密文，不改动文件及阅读记录 |
| [**vaultKeyOpenPost**](DefaultApi.md#vaultkeyopenpost) | **POST** /vault/key/open | 当前用户通过会话绑定的 2FA 后领取内容密钥，空旧库可原子升级 |



## createMetadataTerm

> createMetadataTerm(metadataTermInput)



Creates or reuses one normalized term. Requires library.edit or library.upload.

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateMetadataTermRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  const body = {
    // MetadataTermInput
    metadataTermInput: ...,
  } satisfies CreateMetadataTermRequest;

  try {
    const data = await api.createMetadataTerm(body);
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
| **metadataTermInput** | [MetadataTermInput](MetadataTermInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Canonical reusable term |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## ensureMetadataTerms

> ensureMetadataTerms(ensureMetadataTermsRequest)



Atomically creates or reuses up to 50 terms in input order; requires library.edit or library.upload.

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { EnsureMetadataTermsOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  const body = {
    // EnsureMetadataTermsRequest
    ensureMetadataTermsRequest: ...,
  } satisfies EnsureMetadataTermsOperationRequest;

  try {
    const data = await api.ensureMetadataTerms(body);
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
| **ensureMetadataTermsRequest** | [EnsureMetadataTermsRequest](EnsureMetadataTermsRequest.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Canonical reusable terms in input order |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## previewMetadataTerms

> previewMetadataTerms(previewMetadataTermsRequest)



Language or explicitly evidenced series suggestions from authorized bounded book text. Does not persist vocabulary until adopted.

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { PreviewMetadataTermsOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  const body = {
    // PreviewMetadataTermsRequest
    previewMetadataTermsRequest: ...,
  } satisfies PreviewMetadataTermsOperationRequest;

  try {
    const data = await api.previewMetadataTerms(body);
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
| **previewMetadataTermsRequest** | [PreviewMetadataTermsRequest](PreviewMetadataTermsRequest.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | At most five value/label suggestions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## searchMetadataTerms

> searchMetadataTerms(kind, q, limit)



Shared vocabulary search; requires library.edit or library.upload.

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SearchMetadataTermsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  const body = {
    // 'LANGUAGE' | 'SERIES' | 'TAG' | 'KNOWLEDGE'
    kind: kind_example,
    // string (optional)
    q: q_example,
    // number (optional)
    limit: 56,
  } satisfies SearchMetadataTermsRequest;

  try {
    const data = await api.searchMetadataTerms(body);
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
| **kind** | `LANGUAGE`, `SERIES`, `TAG`, `KNOWLEDGE` |  | [Defaults to `undefined`] [Enum: LANGUAGE, SERIES, TAG, KNOWLEDGE] |
| **q** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `30`] |

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
| **200** | Matching shared terms |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## vaultKeyMigratePost

> vaultKeyMigratePost(vaultKeyMigratePostRequest)

已通过 2FA 的旧浏览器迁移原内容密钥，验证已有密文，不改动文件及阅读记录

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { VaultKeyMigratePostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  const body = {
    // VaultKeyMigratePostRequest
    vaultKeyMigratePostRequest: ...,
  } satisfies VaultKeyMigratePostOperationRequest;

  try {
    const data = await api.vaultKeyMigratePost(body);
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
| **vaultKeyMigratePostRequest** | [VaultKeyMigratePostRequest](VaultKeyMigratePostRequest.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 已迁移或相同密钥幂等重试，返回与 open 相同的 no-store 密钥响应 |  -  |
| **403** | 无权限或 2FA 授权已失效 |  -  |
| **409** | 原密钥校验失败或配置修订冲突，原数据保留 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## vaultKeyOpenPost

> VaultKeyOpenPost200Response vaultKeyOpenPost()

当前用户通过会话绑定的 2FA 后领取内容密钥，空旧库可原子升级

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { VaultKeyOpenPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new DefaultApi(config);

  try {
    const data = await api.vaultKeyOpenPost();
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

[**VaultKeyOpenPost200Response**](VaultKeyOpenPost200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 只用于当前页面内存，Cache-Control 为 no-store；禁止日志记录响应体 |  -  |
| **401** | 未登录 |  -  |
| **403** | 无权限或当前会话未通过有效的 2FA |  -  |
| **409** | 服务器实例密钥不可用，或非空旧库缺少原内容密钥 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

