# ArticleCollectionsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addArticleCollectionArticles**](ArticleCollectionsApi.md#addarticlecollectionarticles) | **POST** /article-collections/{id}/articles |  |
| [**createArticleCollection**](ArticleCollectionsApi.md#createarticlecollection) | **POST** /article-collections |  |
| [**deleteArticleCollection**](ArticleCollectionsApi.md#deletearticlecollection) | **DELETE** /article-collections/{id} | 仅删除合集和成员关系，保留原文章与阅读记录 |
| [**getArticleCollection**](ArticleCollectionsApi.md#getarticlecollection) | **GET** /article-collections/{id} |  |
| [**listArticleCollections**](ArticleCollectionsApi.md#listarticlecollections) | **GET** /article-collections | 查询当前用户拥有或可见的文章合集，不开放匿名读取 |
| [**removeArticleCollectionArticle**](ArticleCollectionsApi.md#removearticlecollectionarticle) | **DELETE** /article-collections/{id}/articles/{articleId} |  |
| [**reorderArticleCollection**](ArticleCollectionsApi.md#reorderarticlecollection) | **PUT** /article-collections/{id}/order |  |
| [**updateArticleCollection**](ArticleCollectionsApi.md#updatearticlecollectionoperation) | **PUT** /article-collections/{id} |  |



## addArticleCollectionArticles

> ArticleCollectionDetail addArticleCollectionArticles(id, articleCollectionMembership)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { AddArticleCollectionArticlesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ArticleCollectionMembership
    articleCollectionMembership: ...,
  } satisfies AddArticleCollectionArticlesRequest;

  try {
    const data = await api.addArticleCollectionArticles(body);
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
| **articleCollectionMembership** | [ArticleCollectionMembership](ArticleCollectionMembership.md) |  | |

### Return type

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 原子加入所选文章 |  -  |
| **409** | 修订冲突、重复文章、超限或文章不可共享 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createArticleCollection

> ArticleCollectionDetail createArticleCollection(articleCollectionDraft)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { CreateArticleCollectionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // ArticleCollectionDraft
    articleCollectionDraft: ...,
  } satisfies CreateArticleCollectionRequest;

  try {
    const data = await api.createArticleCollection(body);
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
| **articleCollectionDraft** | [ArticleCollectionDraft](ArticleCollectionDraft.md) |  | |

### Return type

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 新建合集 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteArticleCollection

> deleteArticleCollection(revision, id)

仅删除合集和成员关系，保留原文章与阅读记录

### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { DeleteArticleCollectionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // number
    revision: 789,
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteArticleCollectionRequest;

  try {
    const data = await api.deleteArticleCollection(body);
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
| **revision** | `number` |  | [Defaults to `undefined`] |
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
| **204** | 已删除合集 |  -  |
| **409** | 合集已变更 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getArticleCollection

> ArticleCollectionDetail getArticleCollection(id)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { GetArticleCollectionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetArticleCollectionRequest;

  try {
    const data = await api.getArticleCollection(body);
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

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 当前可见文章摘要，不含正文或阅读记录 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listArticleCollections

> ArticleCollectionList listArticleCollections(q)

查询当前用户拥有或可见的文章合集，不开放匿名读取

### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { ListArticleCollectionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string (optional)
    q: q_example,
  } satisfies ListArticleCollectionsRequest;

  try {
    const data = await api.listArticleCollections(body);
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

[**ArticleCollectionList**](ArticleCollectionList.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 可见合集及经过文章权限过滤的计数和预览 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## removeArticleCollectionArticle

> ArticleCollectionDetail removeArticleCollectionArticle(id, articleId, revision)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { RemoveArticleCollectionArticleRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    articleId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // number
    revision: 789,
  } satisfies RemoveArticleCollectionArticleRequest;

  try {
    const data = await api.removeArticleCollectionArticle(body);
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
| **articleId** | `string` |  | [Defaults to `undefined`] |
| **revision** | `number` |  | [Defaults to `undefined`] |

### Return type

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 仅移除合集中的文章关系 |  -  |
| **409** | 合集已变更 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## reorderArticleCollection

> ArticleCollectionDetail reorderArticleCollection(id, articleCollectionMembership)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { ReorderArticleCollectionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ArticleCollectionMembership
    articleCollectionMembership: ...,
  } satisfies ReorderArticleCollectionRequest;

  try {
    const data = await api.reorderArticleCollection(body);
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
| **articleCollectionMembership** | [ArticleCollectionMembership](ArticleCollectionMembership.md) |  | |

### Return type

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 原子保存完整且无重复的文章顺序 |  -  |
| **409** | 修订冲突或排序与当前成员不一致 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateArticleCollection

> ArticleCollectionDetail updateArticleCollection(id, updateArticleCollectionRequest)



### Example

```ts
import {
  Configuration,
  ArticleCollectionsApi,
} from '';
import type { UpdateArticleCollectionOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new ArticleCollectionsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateArticleCollectionRequest
    updateArticleCollectionRequest: ...,
  } satisfies UpdateArticleCollectionOperationRequest;

  try {
    const data = await api.updateArticleCollection(body);
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
| **updateArticleCollectionRequest** | [UpdateArticleCollectionRequest](UpdateArticleCollectionRequest.md) |  | |

### Return type

[**ArticleCollectionDetail**](ArticleCollectionDetail.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 更新合集 |  -  |
| **409** | 修订冲突或共享合集包含私有文章 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

