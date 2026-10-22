# AnnotationsApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**articlesNotesGet**](AnnotationsApi.md#articlesnotesget) | **GET** /articles/notes | 当前用户的文章笔记，独立于图书批注和禁书区 |
| [**bookReviewsIdPut**](AnnotationsApi.md#bookreviewsidputoperation) | **PUT** /book-reviews/{id} | 作者编辑长文；管理员不能代改 |
| [**booksBookIdReviewsGet**](AnnotationsApi.md#booksbookidreviewsget) | **GET** /books/{bookId}/reviews | 读取本人的私密长文和书库共享长文 |
| [**booksBookIdReviewsPost**](AnnotationsApi.md#booksbookidreviewspost) | **POST** /books/{bookId}/reviews | 为当前用户创建独立存储的读后长文 |
| [**createAnnotation**](AnnotationsApi.md#createannotation) | **POST** /annotations |  |
| [**deleteAnnotation**](AnnotationsApi.md#deleteannotation) | **DELETE** /annotations/{id} |  |
| [**exportBookAnnotations**](AnnotationsApi.md#exportbookannotations) | **GET** /annotations/books/{bookId}/export/{format} |  |
| [**listAnnotationBooks**](AnnotationsApi.md#listannotationbooks) | **GET** /annotations/books |  |
| [**listAnnotations**](AnnotationsApi.md#listannotations) | **GET** /annotations |  |



## articlesNotesGet

> Array&lt;ArticlesNotesGet200ResponseInner&gt; articlesNotesGet()

当前用户的文章笔记，独立于图书批注和禁书区

### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { ArticlesNotesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  try {
    const data = await api.articlesNotesGet();
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

[**Array&lt;ArticlesNotesGet200ResponseInner&gt;**](ArticlesNotesGet200ResponseInner.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 可访问文章中的个人笔记分组，不含书签或其他用户记录 |  -  |
| **401** | 需要登录 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bookReviewsIdPut

> BookReview bookReviewsIdPut(id, bookReviewsIdPutRequest)

作者编辑长文；管理员不能代改

### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { BookReviewsIdPutOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // BookReviewsIdPutRequest
    bookReviewsIdPutRequest: ...,
  } satisfies BookReviewsIdPutOperationRequest;

  try {
    const data = await api.bookReviewsIdPut(body);
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
| **bookReviewsIdPutRequest** | [BookReviewsIdPutRequest](BookReviewsIdPutRequest.md) |  | |

### Return type

[**BookReview**](BookReview.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 新版本长文 |  -  |
| **401** | 需要登录 |  -  |
| **404** | 长文不存在或不属于当前用户 |  -  |
| **409** | 版本冲突，原有长文不被覆盖 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## booksBookIdReviewsGet

> Array&lt;BookReview&gt; booksBookIdReviewsGet(bookId)

读取本人的私密长文和书库共享长文

### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { BooksBookIdReviewsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies BooksBookIdReviewsGetRequest;

  try {
    const data = await api.booksBookIdReviewsGet(body);
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
| **bookId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;BookReview&gt;**](BookReview.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 不包含其他用户的私密长文，管理员也不例外 |  -  |
| **401** | 需要登录 |  -  |
| **404** | 书籍不存在 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## booksBookIdReviewsPost

> BookReview booksBookIdReviewsPost(bookId, bookReviewDraft)

为当前用户创建独立存储的读后长文

### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { BooksBookIdReviewsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // BookReviewDraft
    bookReviewDraft: ...,
  } satisfies BooksBookIdReviewsPostRequest;

  try {
    const data = await api.booksBookIdReviewsPost(body);
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
| **bookId** | `string` |  | [Defaults to `undefined`] |
| **bookReviewDraft** | [BookReviewDraft](BookReviewDraft.md) |  | |

### Return type

[**BookReview**](BookReview.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 已保存 |  -  |
| **400** | 标题或正文格式无效 |  -  |
| **401** | 需要登录 |  -  |
| **404** | 书籍不存在 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createAnnotation

> Annotation createAnnotation(annotationRequest)



### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { CreateAnnotationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // AnnotationRequest
    annotationRequest: ...,
  } satisfies CreateAnnotationRequest;

  try {
    const data = await api.createAnnotation(body);
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
| **annotationRequest** | [AnnotationRequest](AnnotationRequest.md) |  | |

### Return type

[**Annotation**](Annotation.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Created annotation |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteAnnotation

> deleteAnnotation(id)



### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { DeleteAnnotationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteAnnotationRequest;

  try {
    const data = await api.deleteAnnotation(body);
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
| **200** | Deleted |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## exportBookAnnotations

> Blob exportBookAnnotations(bookId, format)



### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { ExportBookAnnotationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // 'DOCX' | 'XLSX'
    format: format_example,
  } satisfies ExportBookAnnotationsRequest;

  try {
    const data = await api.exportBookAnnotations(body);
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
| **bookId** | `string` |  | [Defaults to `undefined`] |
| **format** | `DOCX`, `XLSX` |  | [Defaults to `undefined`] [Enum: DOCX, XLSX] |

### Return type

**Blob**

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current user\&#39;s annotations for one book as an Office document |  * Content-Disposition -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAnnotationBooks

> AnnotationBookPage listAnnotationBooks(q, cursor, limit)



### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { ListAnnotationBooksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string (optional)
    q: q_example,
    // string (optional)
    cursor: cursor_example,
    // number (optional)
    limit: 56,
  } satisfies ListAnnotationBooksRequest;

  try {
    const data = await api.listAnnotationBooks(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `36`] |

### Return type

[**AnnotationBookPage**](AnnotationBookPage.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Books containing the current user\&#39;s private annotations |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAnnotations

> ListAnnotations200Response listAnnotations(bookId)



### Example

```ts
import {
  Configuration,
  AnnotationsApi,
} from '';
import type { ListAnnotationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AnnotationsApi(config);

  const body = {
    // string (optional)
    bookId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListAnnotationsRequest;

  try {
    const data = await api.listAnnotations(body);
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
| **bookId** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**ListAnnotations200Response**](ListAnnotations200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current user\&#39;s annotations |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
