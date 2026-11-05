# UsersApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**changeUserRole**](UsersApi.md#changeuserroleoperation) | **PATCH** /users/{id}/role |  |
| [**createUser**](UsersApi.md#createuseroperation) | **POST** /users |  |
| [**listUsers**](UsersApi.md#listusers) | **GET** /users |  |
| [**resetTemporaryPassword**](UsersApi.md#resettemporarypassword) | **POST** /users/{id}/temporary-password |  |
| [**revokeUserSessions**](UsersApi.md#revokeusersessions) | **POST** /users/{id}/sessions/revoke |  |
| [**toggleUserStatus**](UsersApi.md#toggleuserstatus) | **PATCH** /users/{id}/status |  |
| [**usersVaultPolicyGet**](UsersApi.md#usersvaultpolicyget) | **GET** /users/vault-policy | 查看禁书区开关及 2FA 服务配置状态 |
| [**usersVaultPolicyPut**](UsersApi.md#usersvaultpolicyputoperation) | **PUT** /users/vault-policy | 主人配置禁书区开关，关闭或重新启用均使旧 2FA 授权失效 |



## changeUserRole

> ManagedUser changeUserRole(id, changeUserRoleRequest)



Owner only. Changes ADMIN or MEMBER with expectedRole concurrency validation. OWNER cannot be assigned or demoted.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { ChangeUserRoleOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ChangeUserRoleRequest
    changeUserRoleRequest: ...,
  } satisfies ChangeUserRoleOperationRequest;

  try {
    const data = await api.changeUserRole(body);
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
| **changeUserRoleRequest** | [ChangeUserRoleRequest](ChangeUserRoleRequest.md) |  | |

### Return type

[**ManagedUser**](ManagedUser.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated account |  -  |
| **403** | Owner required or immutable owner role |  -  |
| **409** | User role changed concurrently |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createUser

> CreateUser200Response createUser(createUserRequest)



### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { CreateUserOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // CreateUserRequest
    createUserRequest: ...,
  } satisfies CreateUserOperationRequest;

  try {
    const data = await api.createUser(body);
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
| **createUserRequest** | [CreateUserRequest](CreateUserRequest.md) |  | |

### Return type

[**CreateUser200Response**](CreateUser200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | User and one-time password |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listUsers

> ListUsers200Response listUsers()



### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { ListUsersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  try {
    const data = await api.listUsers();
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

[**ListUsers200Response**](ListUsers200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Managed users |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## resetTemporaryPassword

> ResetTemporaryPassword200Response resetTemporaryPassword(id)



### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { ResetTemporaryPasswordRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ResetTemporaryPasswordRequest;

  try {
    const data = await api.resetTemporaryPassword(body);
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

[**ResetTemporaryPassword200Response**](ResetTemporaryPassword200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | One-time password |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## revokeUserSessions

> revokeUserSessions(id)



### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { RevokeUserSessionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies RevokeUserSessionsRequest;

  try {
    const data = await api.revokeUserSessions(body);
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
| **200** | Sessions revoked |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## toggleUserStatus

> ManagedUser toggleUserStatus(id)



### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { ToggleUserStatusRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ToggleUserStatusRequest;

  try {
    const data = await api.toggleUserStatus(body);
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

[**ManagedUser**](ManagedUser.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated user |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## usersVaultPolicyGet

> VaultPolicy usersVaultPolicyGet()

查看禁书区开关及 2FA 服务配置状态

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersVaultPolicyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  try {
    const data = await api.usersVaultPolicyGet();
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

[**VaultPolicy**](VaultPolicy.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 管理员与主人可查看 |  -  |
| **403** | 无安全设置查看权限 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## usersVaultPolicyPut

> VaultPolicy usersVaultPolicyPut(usersVaultPolicyPutRequest)

主人配置禁书区开关，关闭或重新启用均使旧 2FA 授权失效

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UsersVaultPolicyPutOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new UsersApi(config);

  const body = {
    // UsersVaultPolicyPutRequest
    usersVaultPolicyPutRequest: ...,
  } satisfies UsersVaultPolicyPutOperationRequest;

  try {
    const data = await api.usersVaultPolicyPut(body);
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
| **usersVaultPolicyPutRequest** | [UsersVaultPolicyPutRequest](UsersVaultPolicyPutRequest.md) |  | |

### Return type

[**VaultPolicy**](VaultPolicy.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 已保存 |  -  |
| **403** | 仅主人可修改 |  -  |
| **409** | 修订冲突或服务器未配置加密密钥 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

