# AuthApi

All URIs are relative to */api/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**authProfilePut**](AuthApi.md#authprofileputoperation) | **PUT** /auth/profile | 修改当前账户用户名和显示名称 |
| [**bindRecoveryEmail**](AuthApi.md#bindrecoveryemail) | **POST** /auth/recovery-email |  |
| [**changePassword**](AuthApi.md#changepasswordoperation) | **PUT** /auth/password |  |
| [**getCsrf**](AuthApi.md#getcsrf) | **GET** /auth/csrf |  |
| [**getMailSettings**](AuthApi.md#getmailsettings) | **GET** /mail/settings |  |
| [**getPasswordPolicy**](AuthApi.md#getpasswordpolicy) | **GET** /auth/password-policy |  |
| [**getRecoveryEmail**](AuthApi.md#getrecoveryemail) | **GET** /auth/recovery-email |  |
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
