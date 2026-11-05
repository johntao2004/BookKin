# AuthApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authProfilePut**](AuthApi.md#authprofileputoperation) | **PUT** /auth/profile | 修改当前账户用户名和显示名称 |
| [**authTwoFactorConfirmPost**](AuthApi.md#authtwofactorconfirmpostoperation) | **POST** /auth/two-factor/confirm | 验证 6 位动态码并完成绑定，生成 10 条一次性备用码 |
| [**authTwoFactorEnrollmentPost**](AuthApi.md#authtwofactorenrollmentpostoperation) | **POST** /auth/two-factor/enrollment | 验证当前登录密码，获取 10 分钟有效的 TOTP 二维码资料 |
| [**authTwoFactorLockPost**](AuthApi.md#authtwofactorlockpost) | **POST** /auth/two-factor/lock | 撤销当前会话的禁书区访问授权，不退出普通登录 |
| [**authTwoFactorRenewPost**](AuthApi.md#authtwofactorrenewpost) | **POST** /auth/two-factor/renew | 为仍已验证的可见阅读会话续期，不能恢复已锁定或已到期的授权 |
| [**authTwoFactorResetPost**](AuthApi.md#authtwofactorresetpostoperation) | **POST** /auth/two-factor/reset | 同时验证登录密码与动态码或备用码后解除旧绑定，要求重新绑定并使所有旧授权失效 |
| [**authTwoFactorStatusGet**](AuthApi.md#authtwofactorstatusget) | **GET** /auth/two-factor/status | 当前用户身份验证器绑定与本会话的禁书区授权状态 |
| [**authTwoFactorVerifyPost**](AuthApi.md#authtwofactorverifypost) | **POST** /auth/two-factor/verify | 使用动态码或一次性备用码验证，授予当前会话 5 分钟禁书区访问权限 |
| [**bindRecoveryEmail**](AuthApi.md#bindrecoveryemail) | **POST** /auth/recovery-email |  |
| [**changePassword**](AuthApi.md#changepasswordoperation) | **PUT** /auth/password |  |
| [**getCsrf**](AuthApi.md#getcsrf) | **GET** /auth/csrf |  |
| [**getEffectivePermissions**](AuthApi.md#geteffectivepermissions) | **GET** /auth/permissions |  |
| [**getMailSettings**](AuthApi.md#getmailsettings) | **GET** /mail/settings |  |
| [**getPasswordPolicy**](AuthApi.md#getpasswordpolicy) | **GET** /auth/password-policy |  |
| [**getRecoveryEmail**](AuthApi.md#getrecoveryemail) | **GET** /auth/recovery-email |  |
| [**getRolePermissionPolicy**](AuthApi.md#getrolepermissionpolicy) | **GET** /role-permissions |  |
| [**getSession**](AuthApi.md#getsession) | **GET** /auth/session |  |
| [**getSetupStatus**](AuthApi.md#getsetupstatus) | **GET** /auth/setup-status |  |
| [**login**](AuthApi.md#loginoperation) | **POST** /auth/login |  |
| [**logout**](AuthApi.md#logout) | **POST** /auth/logout |  |
| [**requestPasswordReset**](AuthApi.md#requestpasswordreset) | **POST** /auth/recovery/request |  |
| [**resetPasswordByEmail**](AuthApi.md#resetpasswordbyemail) | **POST** /auth/recovery/reset |  |
| [**saveMailSettings**](AuthApi.md#savemailsettings) | **PUT** /mail/settings |  |
| [**savePasswordPolicy**](AuthApi.md#savepasswordpolicy) | **PUT** /users/password-policy |  |
| [**sendTestMail**](AuthApi.md#sendtestmail) | **POST** /mail/test |  |
| [**setupOwner**](AuthApi.md#setupowner) | **POST** /auth/setup |  |
| [**updateRolePermissionPolicy**](AuthApi.md#updaterolepermissionpolicy) | **PUT** /role-permissions |  |
| [**verifyRecoveryEmail**](AuthApi.md#verifyrecoveryemail) | **POST** /auth/recovery/verify |  |



## authProfilePut

> authProfilePut(authProfilePutRequest)

修改当前账户用户名和显示名称

需要当前密码；用户名变化时撤销旧身份会话并重建当前会话。

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthProfilePutOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // AuthProfilePutRequest
    authProfilePutRequest: ...,
  } satisfies AuthProfilePutOperationRequest;

  try {
    const data = await api.authProfilePut(body);
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
| **authProfilePutRequest** | [AuthProfilePutRequest](AuthProfilePutRequest.md) |  | |

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
| **200** | 更新后的当前会话用户 |  -  |
| **400** | 输入格式不正确 |  -  |
| **403** | 当前密码不正确或没有登录 |  -  |
| **409** | 用户名已存在 |  -  |
| **429** | 操作过于频繁 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorConfirmPost

> AuthTwoFactorConfirmPost200Response authTwoFactorConfirmPost(authTwoFactorConfirmPostRequest)

验证 6 位动态码并完成绑定，生成 10 条一次性备用码

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorConfirmPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // AuthTwoFactorConfirmPostRequest
    authTwoFactorConfirmPostRequest: ...,
  } satisfies AuthTwoFactorConfirmPostOperationRequest;

  try {
    const data = await api.authTwoFactorConfirmPost(body);
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
| **authTwoFactorConfirmPostRequest** | [AuthTwoFactorConfirmPostRequest](AuthTwoFactorConfirmPostRequest.md) |  | |

### Return type

[**AuthTwoFactorConfirmPost200Response**](AuthTwoFactorConfirmPost200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 备用码仅返回一次，并授予本会话 5 分钟禁书区访问权限 |  -  |
| **400** | 动态码无效 |  -  |
| **409** | 绑定过期或已完成 |  -  |
| **429** | 验证尝试过于频繁 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorEnrollmentPost

> AuthTwoFactorEnrollmentPost200Response authTwoFactorEnrollmentPost(authTwoFactorEnrollmentPostRequest)

验证当前登录密码，获取 10 分钟有效的 TOTP 二维码资料

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorEnrollmentPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // AuthTwoFactorEnrollmentPostRequest
    authTwoFactorEnrollmentPostRequest: ...,
  } satisfies AuthTwoFactorEnrollmentPostOperationRequest;

  try {
    const data = await api.authTwoFactorEnrollmentPost(body);
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
| **authTwoFactorEnrollmentPostRequest** | [AuthTwoFactorEnrollmentPostRequest](AuthTwoFactorEnrollmentPostRequest.md) |  | |

### Return type

[**AuthTwoFactorEnrollmentPost200Response**](AuthTwoFactorEnrollmentPost200Response.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 仅本次返回绑定种子，禁止缓存 |  -  |
| **400** | 登录密码不正确 |  -  |
| **403** | 功能未启用或无权限 |  -  |
| **409** | 已绑定或未配置服务器密钥 |  -  |
| **429** | 验证尝试过于频繁 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorLockPost

> authTwoFactorLockPost()

撤销当前会话的禁书区访问授权，不退出普通登录

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorLockPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.authTwoFactorLockPost();
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

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | 已锁定 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorRenewPost

> TwoFactorStatus authTwoFactorRenewPost()

为仍已验证的可见阅读会话续期，不能恢复已锁定或已到期的授权

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorRenewPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.authTwoFactorRenewPost();
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

[**TwoFactorStatus**](TwoFactorStatus.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 新的授权到期时间 |  -  |
| **403** | 尚未验证、已锁定、已到期或功能被关闭 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorResetPost

> authTwoFactorResetPost(authTwoFactorResetPostRequest)

同时验证登录密码与动态码或备用码后解除旧绑定，要求重新绑定并使所有旧授权失效

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorResetPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // AuthTwoFactorResetPostRequest
    authTwoFactorResetPostRequest: ...,
  } satisfies AuthTwoFactorResetPostOperationRequest;

  try {
    const data = await api.authTwoFactorResetPost(body);
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
| **authTwoFactorResetPostRequest** | [AuthTwoFactorResetPostRequest](AuthTwoFactorResetPostRequest.md) |  | |

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
| **204** | 旧绑定与剩余备用码已失效，书籍密文未改变 |  -  |
| **400** | 密码或验证码不正确 |  -  |
| **429** | 验证尝试过于频繁 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorStatusGet

> TwoFactorStatus authTwoFactorStatusGet()

当前用户身份验证器绑定与本会话的禁书区授权状态

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.authTwoFactorStatusGet();
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

[**TwoFactorStatus**](TwoFactorStatus.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 不返回种子或备用码 |  -  |
| **403** | 当前角色没有禁书区权限 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## authTwoFactorVerifyPost

> TwoFactorStatus authTwoFactorVerifyPost(twoFactorVerification)

使用动态码或一次性备用码验证，授予当前会话 5 分钟禁书区访问权限

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { AuthTwoFactorVerifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // TwoFactorVerification
    twoFactorVerification: ...,
  } satisfies AuthTwoFactorVerifyPostRequest;

  try {
    const data = await api.authTwoFactorVerifyPost(body);
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
| **twoFactorVerification** | [TwoFactorVerification](TwoFactorVerification.md) |  | |

### Return type

[**TwoFactorStatus**](TwoFactorStatus.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 当前授权状态 |  -  |
| **400** | 验证码无效、过期或已使用 |  -  |
| **403** | 功能关闭、无角色权限或尚未绑定 |  -  |
| **429** | 验证尝试过于频繁 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## bindRecoveryEmail

> bindRecoveryEmail(recoveryBindInput)



验证当前密码并发送邮箱确认链接

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { BindRecoveryEmailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // RecoveryBindInput
    recoveryBindInput: ...,
  } satisfies BindRecoveryEmailRequest;

  try {
    const data = await api.bindRecoveryEmail(body);
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
| **recoveryBindInput** | [RecoveryBindInput](RecoveryBindInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## changePassword

> SessionUser changePassword(changePasswordRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ChangePasswordOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // ChangePasswordRequest
    changePasswordRequest: ...,
  } satisfies ChangePasswordOperationRequest;

  try {
    const data = await api.changePassword(body);
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
| **changePasswordRequest** | [ChangePasswordRequest](ChangePasswordRequest.md) |  | |

### Return type

[**SessionUser**](SessionUser.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated session |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getCsrf

> CsrfToken getCsrf()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetCsrfRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  try {
    const data = await api.getCsrf();
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

[**CsrfToken**](CsrfToken.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | CSRF token |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getEffectivePermissions

> PermissionSnapshot getEffectivePermissions()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetEffectivePermissionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.getEffectivePermissions();
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

[**PermissionSnapshot**](PermissionSnapshot.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current database role and effective grants |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getMailSettings

> getMailSettings()



主人读取 SMTP 配置；密码不返回

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetMailSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.getMailSettings();
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

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getPasswordPolicy

> PasswordPolicy getPasswordPolicy()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetPasswordPolicyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  try {
    const data = await api.getPasswordPolicy();
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

[**PasswordPolicy**](PasswordPolicy.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 当前密码规则 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getRecoveryEmail

> getRecoveryEmail()



读取当前用户已验证的找回邮箱

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetRecoveryEmailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.getRecoveryEmail();
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

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getRolePermissionPolicy

> RolePermissionPolicy getRolePermissionPolicy()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetRolePermissionPolicyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.getRolePermissionPolicy();
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

[**RolePermissionPolicy**](RolePermissionPolicy.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Owner-only role policy |  -  |
| **403** | Owner required |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getSession

> SessionUser getSession()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetSessionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.getSession();
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

[**SessionUser**](SessionUser.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Current user |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getSetupStatus

> SetupStatus getSetupStatus()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { GetSetupStatusRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  try {
    const data = await api.getSetupStatus();
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

[**SetupStatus**](SetupStatus.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Whether owner initialization has already completed |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## login

> SessionUser login(loginRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { LoginOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // LoginRequest
    loginRequest: ...,
  } satisfies LoginOperationRequest;

  try {
    const data = await api.login(body);
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
| **loginRequest** | [LoginRequest](LoginRequest.md) |  | |

### Return type

[**SessionUser**](SessionUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Authenticated session |  -  |
| **401** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## logout

> logout()



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { LogoutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.logout();
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

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Logged out |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## requestPasswordReset

> requestPasswordReset(recoveryEmailInput)



申请重置链接；未知邮箱也返回相同响应

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { RequestPasswordResetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RecoveryEmailInput
    recoveryEmailInput: ...,
  } satisfies RequestPasswordResetRequest;

  try {
    const data = await api.requestPasswordReset(body);
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
| **recoveryEmailInput** | [RecoveryEmailInput](RecoveryEmailInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## resetPasswordByEmail

> resetPasswordByEmail(recoveryResetInput)



重置密码并撤销全部旧会话

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ResetPasswordByEmailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RecoveryResetInput
    recoveryResetInput: ...,
  } satisfies ResetPasswordByEmailRequest;

  try {
    const data = await api.resetPasswordByEmail(body);
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
| **recoveryResetInput** | [RecoveryResetInput](RecoveryResetInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## saveMailSettings

> saveMailSettings(mailSettings)



主人保存 SMTP 配置；空密码保留原值

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { SaveMailSettingsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // MailSettings
    mailSettings: ...,
  } satisfies SaveMailSettingsRequest;

  try {
    const data = await api.saveMailSettings(body);
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
| **mailSettings** | [MailSettings](MailSettings.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## savePasswordPolicy

> PasswordPolicy savePasswordPolicy(passwordPolicy)



仅主人可修改，对新设置的密码生效，不拒绝已有密码登录。

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { SavePasswordPolicyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // PasswordPolicy
    passwordPolicy: ...,
  } satisfies SavePasswordPolicyRequest;

  try {
    const data = await api.savePasswordPolicy(body);
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
| **passwordPolicy** | [PasswordPolicy](PasswordPolicy.md) |  | |

### Return type

[**PasswordPolicy**](PasswordPolicy.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 已保存 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## sendTestMail

> sendTestMail(recoveryEmailInput)



主人发送测试邮件

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { SendTestMailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // RecoveryEmailInput
    recoveryEmailInput: ...,
  } satisfies SendTestMailRequest;

  try {
    const data = await api.sendTestMail(body);
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
| **recoveryEmailInput** | [RecoveryEmailInput](RecoveryEmailInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## setupOwner

> SessionUser setupOwner(setupRequest)



### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { SetupOwnerRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // SetupRequest
    setupRequest: ...,
  } satisfies SetupOwnerRequest;

  try {
    const data = await api.setupOwner(body);
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
| **setupRequest** | [SetupRequest](SetupRequest.md) |  | |

### Return type

[**SessionUser**](SessionUser.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Owner session |  -  |
| **409** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateRolePermissionPolicy

> RolePermissionPolicy updateRolePermissionPolicy(rolePermissionPolicy)



Owner only. Complete ADMIN and MEMBER grants; OWNER authority is immutable. Validate role ceilings and page prerequisites. Uses optimistic revision and records an audit event.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { UpdateRolePermissionPolicyRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: sessionCookie
    apiKey: "YOUR API KEY",
  });
  const api = new AuthApi(config);

  const body = {
    // RolePermissionPolicy
    rolePermissionPolicy: ...,
  } satisfies UpdateRolePermissionPolicyRequest;

  try {
    const data = await api.updateRolePermissionPolicy(body);
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
| **rolePermissionPolicy** | [RolePermissionPolicy](RolePermissionPolicy.md) |  | |

### Return type

[**RolePermissionPolicy**](RolePermissionPolicy.md)

### Authorization

[sessionCookie](../README.md#sessionCookie)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Updated policy |  -  |
| **400** | Invalid or incomplete policy or dependency |  -  |
| **403** | Owner required or grant outside role ceiling |  -  |
| **409** | Policy revision conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## verifyRecoveryEmail

> verifyRecoveryEmail(recoveryTokenInput)



确认绑定邮箱；仅显式 POST 消耗链接

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { VerifyRecoveryEmailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // RecoveryTokenInput
    recoveryTokenInput: ...,
  } satisfies VerifyRecoveryEmailRequest;

  try {
    const data = await api.verifyRecoveryEmail(body);
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
| **recoveryTokenInput** | [RecoveryTokenInput](RecoveryTokenInput.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 操作成功 |  -  |
| **400** | RFC 9457 problem |  -  |
| **403** | RFC 9457 problem |  -  |
| **429** | RFC 9457 problem |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

